import { filter } from 'rxjs/internal/operators/filter.js'
import { Name } from '@wharfkit/antelope';
import {
  createEosioShipReader,
  EosioReaderAbisMap,
  EosioReaderActionFilter,
  EosioReaderConfig,
  EosioReaderTableRowFilter,
  ShipTableDeltaName,
} from '@waxonedge/antelope-ship-reader';

import AppConfig from '../../config.js'

import { fetchAbi, getInfo, eosioApi } from './utils.js';

function leapNameToUint(name: string): string {
	return Name.from(name).value.toString();
}

export default class StreamReaderrows {
  tables_interest: any[];
  eosioReader: any;
	onProcessedData: any;
	info: any;

  constructor(
  	tables_interest, onProcessedData
	) {
    this.tables_interest = tables_interest;
    this.eosioReader = null;
		this.onProcessedData = onProcessedData;

		this.info = null;
  }

  async loadReader() {
    const table_rows_whitelist: () => EosioReaderTableRowFilter[] = () => 
    	this.tables_interest.map((ti: any) => ({
        code: ti.code,
        table: ti.table,
      }));

    const actions_whitelist: () => EosioReaderActionFilter[] = () => [];

		this.info = await getInfo()
  	
  	const unique_contract_names = [...new Set(table_rows_whitelist().map((row) => row.code))].filter(account_name => account_name !== '*')
  	const abisArr = await Promise.all(unique_contract_names.map((account_name) => fetchAbi(account_name)))

	  const contract_abis: () => EosioReaderAbisMap = () => {
	    const numap = new Map()
	    abisArr.forEach(({ account_name, abi }) => numap.set(account_name, abi))
	    return numap
	  }

	  const delta_whitelist: () => ShipTableDeltaName[] = () => [
	    'account_metadata',
	    'contract_table',
	    'contract_row',
	    'contract_index64',
	    'resource_usage',
	    'resource_limits_state',
	  ]

	  const eosioReaderConfig: EosioReaderConfig = {
	    ws_url: 'ws://'+AppConfig.waxnode_endpoint+':'+AppConfig.waxnode_ws_port,
	    rpc_url: eosioApi,
	    ds_threads: 6,
	    ds_experimental: false,
	    delta_whitelist,
	    table_rows_whitelist,
	    actions_whitelist,
	    contract_abis,
	    request: {
	      start_block_num: this.info.head_block_num + 10,
	      end_block_num: 0xffffffff,
	      max_messages_in_flight: 500,
	      have_positions: [],
	      irreversible_only: false,
	      fetch_block: true,
	      fetch_traces: false,
	      fetch_deltas: true,
	    },
	    auto_start: true,
	  }

	  this.eosioReader = await createEosioShipReader(eosioReaderConfig)

	  return this.eosioReader
	}

	async connect() {
		console.log('STREAM READER ROWS connecting')
	  const { close$, rows$ } = await this.loadReader()

	  // filter ship socket messages stream by type (string for abi and )
	  const existingRows$ = rows$.pipe(filter((row: any) => Boolean(row.present)))
	  const deletedRows$ = rows$.pipe(filter((row: any) => !Boolean(row.present)))

	  existingRows$.subscribe((row) => {
	  	console.log('['+row.block_num+']Received row for '+row.code+' - '+row.table)
	    row.scope = leapNameToUint(row.scope)
      this.onProcessedData(row)
	  })

	  deletedRows$.subscribe((row) => {
	  	console.log('['+row.block_num+']Deleted row for '+row.code+' - '+row.table)
	    row.scope = leapNameToUint(row.scope)
      this.onProcessedData(row)
	  })

	  close$.subscribe(() => console.log('connection closed'))
	}
}
