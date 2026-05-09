import axios from 'axios'
import { Token as AlcorToken, Pool as AlcorPool } from '@alcorexchange/alcor-swap-sdk'

import BackgroundWorker from '../Models/BackgroundWorker.js'
import LiquidityRow from '../Models/Rows/Liquidity.js'
import LogpoolRow from '../Models/Rows/Logpool.js'
import SwapVThreeOrderRow from '../Models/Rows/SwapVThreeOrder.js'
import {delay} from '../../utils/utils.js'

const indexerApi = 'http://indexer:8200';

const fetchApi = async (path) => {
	try {
		const response = await axios.get(indexerApi+path)
		return response.data
	}
	catch(err) {
		console.log(err)
		console.log('Error while fetching indexer api')
		return ''
	}
}

class ApiFetcher {
	constructor() {
		this.data = {}
	}

	getData(path) {
		return (this.data[path] !== undefined) ? this.data[path] : [];
	}

	async fetchOrGetData(path) {
		if(this.data[path] === undefined || !this.data[path].length)
			return await this.fetchData(path)

		return this.data[path]
	}

	async fetchData(path) {
		this.data[path] = await fetchApi(path)
		return this.data[path]
	}
}

function getPrice(pool, swaplogRow) {
	// No need to create real token, only need price
	const dumtickerA = 'dmtckrA'
	const dumtickerB = 'dmtckrB'
	const dummycontract = 'dumcontract'
  const tokenA = new AlcorToken(
    dummycontract,
   	8,
    dumtickerA.toUpperCase(),
    (dumtickerA + '-' + dummycontract).toLowerCase()
  );
  const tokenB = new AlcorToken(
    dummycontract,
   	8,
    dumtickerB.toUpperCase(),
    (dumtickerB + '-' + dummycontract).toLowerCase()
  );

  const alcorPool = new AlcorPool({
    id: pool.id,
    tokenA,
    tokenB,
    fee: pool.fee * 100,
    sqrtPriceX64: swaplogRow.sqrtPriceX64,
    liquidity: 0,
    tickCurrent: 1*swaplogRow.tick,
    feeGrowthGlobalAX64: 0,
    feeGrowthGlobalBX64: 0
  });

  return 1*alcorPool.tokenAPrice.toFixed(18)
}

export default class LiquidityPricesIndexer {
	constructor() {
		this.worker = new BackgroundWorker(
			'liquidity_price_indexer_worker',
			1,
			async(id) => await this.doPriceFillWork(id)
		)
		this.apiFetcher = new ApiFetcher()
		this.errorCpt = {} // count error to avoid reprocessing rows
	}

	async start() {
		console.log('LiquidityPricesIndexer start');
		this.worker.start()
	}

	async doPriceFillWork() {
		// Find all null liquidity rows
		const rows = await LiquidityRow.fetchRows({
			tokenA_price: null,
			limit: 1000
		})
		console.log(rows.length + ' liquidity rows with null price')

		// Loop and compute price
		for(const row of rows) {
			if(this.errorCpt[row.global_sequence] !== undefined && this.errorCpt[row.global_sequence] > 50)
				continue;

			let price = null
			if(row.src === 'alcorv2') {
				// Find last swap right before this global_sequence
				let lastSwapRow = await SwapVThreeOrderRow.fetchRows({
					src: row.src,
					pair_id: row.pair_id,
					max_global_sequence: row.global_sequence,
					limit: 1
				})
				if(!lastSwapRow.length) {
					// look for logpool action with same trx_id
					const logpoolRow = await LogpoolRow.fetchRows({
						trx_id: row.trx_id,
						src: row.src,
						pair_id: row.pair_id,
						limit: 1
					})

					if(logpoolRow.length) {
						lastSwapRow = [{
							sqrtPriceX64: logpoolRow[0].sqrtPriceX64,
							tick: logpoolRow[0].tick,
						}]
					}
				}

				if(!lastSwapRow.length) {
					console.log('Warning no lastSwapRow found for row', row)
					if(this.errorCpt[row.global_sequence] === undefined)
						this.errorCpt[row.global_sequence] = 0

					this.errorCpt[row.global_sequence] += 1
					continue;
				}

				lastSwapRow = lastSwapRow[0]

				const pool = await this.apiFetcher.fetchData('/poolv3/'+row.src+'/'+row.pair_id)

				if(pool === '') 
					console.log('Warning pool '+row.src+' '+row.pair_id+' not in indexer')
				else {
					price = getPrice(pool, lastSwapRow)
				}
			}
			else {
				price = (1*row.amount_reserveB)/(1*row.amount_reserveA)
			}

			await LiquidityRow.updateTokenAPrice(row.trx_id, row.action_ordinal, price)
		}

		// Update price in db

		await delay(5000)
	}
}