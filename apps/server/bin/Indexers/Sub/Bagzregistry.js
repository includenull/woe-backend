import SubIndexer from '@indexers/Sub/SubIndexer.js';
import logger from '@utils/logger.js';

export default class BagzregistrySubIndexer extends SubIndexer {
	constructor(getRpcIndexer, updateSync) {
		super(getRpcIndexer, updateSync)
	}

	isRowStructValid(row_value) {
		const fields = [
			'code',
			'is_tradeable',
			'tx_fees'
		]

		// If field is missing from row_value
		for(const field of fields)
			if(row_value[field] === undefined)
				return false

		// If there are more field than expected in row_value
		for(const field of Object.keys(row_value))
			if(!fields.includes(field))
				return false

		return true
	}

	async fetchAccountRows(account) {
		const ret = {}

		if(ret[account] === undefined)
			ret[account] = {}

		if(ret[account]['configs'] === undefined)
			ret[account]['configs'] = {}

		ret[account]['configs']['*'] = { rows: await this.fetchCodeTableScope(account, 'configs', '*') };

		return ret;
	}

	async fetchRows() {
		const resp = await fetch('https://aa.neftyblocks.com/launchbagz/v1/tokens?page=1&limit=1000')
		let bagzregistry_accounts;
		 const bagzregistry_accounts_text = await resp.text();
  try {
    bagzregistry_accounts = JSON.parse(bagzregistry_accounts_text);
  } catch (e) {
    bagzregistry_accounts = null;
    logger.info('failed to load bagzregistry_accounts');
  			}

		// bluemobwally is not bagzregistry anymore 
    if(bagzregistry_accounts !== null)
	bagzregistry_accounts = bagzregistry_accounts?.data?.filter(
      a => a.contract === 'bagzregistry' && a.token_contract != 'bluemobwally'
    ).map(ba => ba.token_contract);

		const ret = {}

		if(bagzregistry_accounts !== null)
		for(const account of bagzregistry_accounts) {
			if(ret[account] === undefined)
				ret[account] = {}

			if(ret[account]['configs'] === undefined)
				ret[account]['configs'] = {}

			ret[account]['configs']['*'] = { rows: await this.fetchCodeTableScope(account, 'configs', '*')};
		}

		return ret;
	}
}
