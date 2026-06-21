/***

Index and keep rows of a table into memory

rows {
	code: {
		table: {
			scope: rows[]
		}
	}
}

***/
import SubIndexer from './Sub/SubIndexer.js'
import OrderbooksSubIndexer from './Sub/Orderbooks.js'
import AlcorTicksSubIndexer from './Sub/AlcorTicks.js'
import AlcorPositionsSubIndexer from './Sub/AlcorPositions.js'
import BagzregistrySubIndexer from '@indexers/Sub/Bagzregistry.js';
import logger from '@utils/logger.js';

export default class RowsIndexer {
	constructor(getRpcIndexer) {
		this.getRpcIndexer = getRpcIndexer;
		this.rows = {}
		this.rows_map = {}
		this.rows_map_map = {} // Map which field value was mapped with code table scope
		this.rowsSync = {} // store state of sync of rows to keep table synced
		this.subIndexer = new SubIndexer(
			this.getRpcIndexer,
			(code, table, scope, is_syncing = null, is_updated = null) => this.updateSync(code, table, scope, is_syncing, is_updated)
		);
		this.indexers = {
			'bagzregistry': new BagzregistrySubIndexer(
				this.getRpcIndexer,
				(code, table, scope, is_syncing = null, is_updated = null) => this.updateSync(code, table, scope, is_syncing, is_updated)
			),
			'orderbooks': new OrderbooksSubIndexer(
				this.getRpcIndexer,
				(code, table, scope, is_syncing = null, is_updated = null) => this.updateSync(code, table, scope, is_syncing, is_updated)
			),
			'swapVThreeOrdersAlcorTicks': new AlcorTicksSubIndexer(
				this.getRpcIndexer,
				(code, table, scope, is_syncing = null, is_updated = null) => this.updateSync(code, table, scope, is_syncing, is_updated)
			),
			'swapVThreeOrdersAlcorPositions': new AlcorPositionsSubIndexer(
				this.getRpcIndexer,
				(code, table, scope, is_syncing = null, is_updated = null) => this.updateSync(code, table, scope, is_syncing, is_updated)
			),
		}
	}

	getIndexersOfWildcardTable(table) {
		const indexers = []
		for(const indexer_name of Object.keys(this.indexers)) {
			if(this.indexers[indexer_name].tables_interest.find(ti => ti.code === '*' && ti.table === table) !== undefined) {
				indexers.push(indexer_name)
			}
		}

		return indexers
	}

	updateSync(code, table, scope, is_syncing = null, is_updated = null) {
		if(this.rowsSync[code] === undefined)
			this.rowsSync[code] = {}
		if(this.rowsSync[code][table] === undefined)
			this.rowsSync[code][table] = {}
		if(this.rowsSync[code][table][scope] === undefined)
			this.rowsSync[code][table][scope] = {}
		
		if(is_syncing !== null && undefined !== is_syncing)
			this.rowsSync[code][table][scope].is_syncing = is_syncing
		if(is_updated !== null && undefined !== is_updated)
			this.rowsSync[code][table][scope].is_updated = is_updated
	}

	findRowIndex(row) {
		return this.rows[row.code][row.table][row.scope].findIndex(r => r.id == row.value.id)		
	}

	updateRow(row) {
		const rowIndex = this.findRowIndex(row)
		
		if(rowIndex === -1) {
			//console.log(row.code+' '+row.table+' '+row.scope, 'addRow')
			this.rows[row.code][row.table][row.scope].push(row.value)
		}
		else {
			//console.log(row.code+' '+row.table+' '+row.scope, 'editRow')
			this.rows[row.code][row.table][row.scope][rowIndex] = row.value
		}

		// Debug rmx wax market on alcor market
		/* if(row.code === 'alcordexmain' && row.scope == 383) {
			logger.info(this.rows[row.code][row.table][row.scope])
		} */
	}

	deleteRow(row) {
		const rowIndex = this.findRowIndex(row)

		if(rowIndex === -1) {
			logger.info('warning row code:'+row.code+' table:'+row.table+' scope:'+row.scope+' to delete doesn\'t exists doing another init for this code table scope');
			this.initCodeTableScope(row.code, row.table, row.scope)
		}
		else {
			this.rows[row.code][row.table][row.scope].splice(rowIndex, 1)
			//console.log(row.code+' '+row.table+' '+row.scope, 'deleteRow')
		}

		// Debug rmx wax market on alcor market
		/* if(row.code === 'alcordexmain' && row.scope == 383) {
			logger.info(this.rows[row.code][row.table][row.scope])
		} */
	}

	getRowsFromCodeScopes(code, scopes) {
		const ret = {}
		ret[code] = {}

		if(this.rows[code] === undefined)
			return {}

		for(const table of Object.keys(this.rows[code])) {
			const validScopes = Object.keys(this.rows[code][table]).filter(s => scopes.indexOf(s) !== -1)

			for(const scope of validScopes) {
				if(ret[code][scope] === undefined)
					ret[code][scope] = {}

				ret[code][scope][table] = this.rows[code][table][scope]
			}
		}

		return ret;
	}

	getRowsFromCodeTableScope(code, table, scope) {
		if(this.rows[code] === undefined)
			return [];
		if(this.rows[code][table] === undefined)
			return [];
		if(this.rows[code][table][scope] === undefined)
			return [];

		return this.rows[code][table][scope];
	}

	getRowsForMappedField(field, code_filter, table_filter) {
		const ret = {}

		//console.log(field)
		//console.dir(this.rows_map[field], { depth: null })

		if(this.rows_map[field] === undefined)
			return;

		for(const code in this.rows_map[field]) {
			if([undefined, null].includes(code_filter) || code_filter === code) {
				if(ret[code] === undefined)
					ret[code] = {}

				for(const table in this.rows_map[field][code]) {
					if([undefined, null].includes(table_filter) || table_filter === table) {
						if(ret[code][table] === undefined)
							ret[code][table] = {}

						for(const scope in this.rows_map[field][code][table]) {
							ret[code][table][scope] = this.rows_map[field][code][table][scope]
						} // for scope
					} // if
				} // for table
			} // if
		} // for code

		return ret;
	}

	async initRows(tables_interest) {
		for(const ti of tables_interest) {
			this.indexers[ti.rowsSubIndexer].addTableInterest(ti)
		}

		await this.connectReaderrows();

		for(const subIndexer of Object.keys(this.indexers) ) {
			logger.info(subIndexer + ' subIndexer first init start')
			const indexerRows = await this.indexers[subIndexer].fetchRows()

			for(const code of Object.keys(indexerRows)) {
				if(this.rows[code] === undefined)
					this.rows[code] = {}
				for(const table of Object.keys(indexerRows[code])) {
					if(this.rows[code][table] === undefined)
						this.rows[code][table] = {}
					for(const scope of Object.keys(indexerRows[code][table])) {
						this.rows[code][table][scope] = indexerRows[code][table][scope].rows
						this.make_mapping(code, table, scope)
						if(this.rowsSync[code][table][scope].is_updated === true) {
							// The row has been updated while fetching, we need to fetch it again
							this.initCodeTableScope(code, table, scope)
						}
						else
							this.updateSync(code, table, scope, false)
					} // for scope
				} // for table
			} // for code
			logger.info(subIndexer + ' subIndexer first init done')
		}
	}

	async make_mapping(code, table, scope) {
		// Auto find mapped field
		let field = undefined
		for(const subIndexer in this.indexers) {
			const current_table_interest = this.indexers[subIndexer].getTableInterestForTable(table)

			if(current_table_interest?.code !== code)
				continue;

			if(current_table_interest?.rowsMapping !== undefined) {
				field = current_table_interest?.rowsMapping
			}
		}
		if([undefined, null].includes(field))
			return false;

		//console.log('Mapping field '+field+' for '+code+':'+table+':'+scope)

		// Reset previous mapping
		let updatedRowsMap = { ...this.rows_map }; // Create a copy to modify
		if(this.rows_map_map[code+'_'+table+'_'+scope] !== undefined) {
			for(const mapped_value of this.rows_map_map[code+'_'+table+'_'+scope]) {
				//console.log(mapped_value)
				//console.dir(this.rows_map[mapped_value], { depth: null })
				try {
					delete updatedRowsMap[mapped_value][code][table][scope];
				}
				catch(e) {
					logger.error(e)
				}

				try {
			    if (!Object.keys(updatedRowsMap[mapped_value][code][table]).length)
			      delete updatedRowsMap[mapped_value][code][table];
				}
				catch(e) {
					logger.error(e)
				}

		    try {
			    if (!Object.keys(updatedRowsMap[mapped_value][code]).length)
			      delete updatedRowsMap[mapped_value][code];
		    }
		    catch(e) {
		    	logger.error(e)
		    }

		    try {
			    if (!Object.keys(updatedRowsMap[mapped_value]).length)
			      delete updatedRowsMap[mapped_value];
		    }
		    catch(e) {
		    	logger.error(e)
		    }
		  }

		  try {
		  	delete this.rows_map_map[code + '_' + table + '_' + scope];
		  }
		  catch(e) {
		  	logger.error(e)
		  }
		}

		// Do mapping
		const updated_values = []
		if(this.rows[code][table][scope] !== null) {
			for(let i = 0; i < this.rows[code][table][scope].length; ++i) {
				const row = this.rows[code][table][scope][i];
			
				if (updatedRowsMap[row[field]] === undefined)
		      updatedRowsMap[row[field]] = {};

		    if (updatedRowsMap[row[field]][code] === undefined)
		      updatedRowsMap[row[field]][code] = {};
		    if (updatedRowsMap[row[field]][code][table] === undefined)
		      updatedRowsMap[row[field]][code][table] = {};
		    if (updatedRowsMap[row[field]][code][table][scope] === undefined)
		      updatedRowsMap[row[field]][code][table][scope] = [];

		    updatedRowsMap[row[field]][code][table][scope].push(row);

				// Save registered field for this code table scope to be able to reset
		    if (this.rows_map_map[code + '_' + table + '_' + scope] === undefined)
		      this.rows_map_map[code + '_' + table + '_' + scope] = [];

		    if (!this.rows_map_map[code + '_' + table + '_' + scope].includes(row[field]))
		      this.rows_map_map[code + '_' + table + '_' + scope].push(row[field]);

		    if(!updated_values.includes[row[field]])
		    	updated_values.push(row[field])
			}
		}

		// Assign the updated values back to this
		for(const mapped_value of updated_values) {
			if(this.rows_map[mapped_value] === undefined)
				this.rows_map[mapped_value] = {}
			if(this.rows_map[mapped_value][code] === undefined)
				this.rows_map[mapped_value][code] = {}
			if(this.rows_map[mapped_value][code][table] === undefined)
				this.rows_map[mapped_value][code][table] = {}
			if(this.rows_map[mapped_value][code][table][scope] === undefined)
				this.rows_map[mapped_value][code][table][scope] = []

			this.rows_map[mapped_value][code][table][scope] = updatedRowsMap[mapped_value][code][table][scope]
		}
	}

	async initCodeTableScope(code, table, scope) {
		//console.log(code+' '+table+' '+scope, 'initCodeTableScope')
		this.rows[code][table][scope] = null
		this.rows[code][table][scope] = await this.subIndexer.fetchCodeTableScope(code, table, scope)

		if(this.rowsSync[code][table][scope].is_updated === true) {
			// The row has been updated while fetching, we need to fetch it again
			this.initCodeTableScope(code, table, scope)
		}
		else
			this.updateSync(code, table, scope, false)
	}

	async connectReaderrows() {
		logger.info('connectReaderrows')
		// Extract qstreams to listen to
		let qstreams = []
		for(const subIndexer of Object.keys(this.indexers) )
			for(const ti of this.indexers[subIndexer].tables_interest)
				qstreams.push(ti.qstream)
		// Remove doublons
		qstreams = [...new Set(qstreams)];

		// Connect to qstreams
		for(const qstream of qstreams)
			await this.subIndexer.readQstream(qstream, (row) => this.onUpdateReaderrows(row))
	}

	async onUpdateReaderrows(row) {
		const wildcard_indexers_name = this.getIndexersOfWildcardTable(row.table);
		// fix because in this case the scope might not be correct
		if(wildcard_indexers_name.length)
			row.scope = '*'

		// set is_updated to true
		this.updateSync(row.code, row.table, row.scope, null, true)

		// wait for table to be initialized (is_updated already set to true)
		if(this.rows[row.code] === undefined || undefined === this.rows[row.code][row.table]) {
			// Or download table if it's wildcard
			if(wildcard_indexers_name.length) {
				const indexer_name = wildcard_indexers_name.find(indexer_name => this.indexers[indexer_name].isRowStructValid(row.value));
				if(indexer_name !== undefined) {
					// Init table
					const indexerRows = await this.indexers[indexer_name].fetchAccountRows(row.code)

					for(const code of Object.keys(indexerRows)) {
						if(this.rows[code] === undefined)
							this.rows[code] = {}

						for(const table of Object.keys(indexerRows[code])) {
							if(this.rows[code][table] === undefined)
								this.rows[code][table] = {}
							for(const scope of Object.keys(indexerRows[code][table])) {
								this.rows[code][table][scope] = indexerRows[code][table][scope].rows
								if(this.rowsSync[code][table][scope].is_updated === true) {
									// The row has been updated while fetching, we need to fetch it again
									this.initCodeTableScope(code, table, scope)
								}
								else
									this.updateSync(code, table, scope, false)
							} // for scope
						} // for table
					} // for code
				}
			}

			return;
		}

		// wait for sync to be done before doing any update
		if(this.rowsSync[row.code][row.table][row.scope] !== undefined && this.rowsSync[row.code][row.table][row.scope].is_syncing === true)
			return;

		// If rows are not present for scope
		if(!(this.rows[row.code][row.table][row.scope] !== undefined && null !== this.rows[row.code][row.table][row.scope])) {
			logger.info({ row }, 'warning rows not present onUpdateReaderrows')
			this.initCodeTableScope(row.code, row.table, row.scope)
			return;
		}

		if(row.present)
			this.updateRow(row)
		else
			this.deleteRow(row)

		this.make_mapping(row.code, row.table, row.scope)
	}
}
