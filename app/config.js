import * as dotenv from 'dotenv'
dotenv.config()

export default {
	rpc_endpoints: [
		process.env.WAXRPC_ENDPOINT,
		/* 'https://hyperion.wax.blacklusion.io/',
		'https://wax.blokcrafters.io',
		'https://api-wax-mainnet.wecan.dev',
		'https://wax.eosdac.io',
		'https://wax-public1.neftyblocks.com',
		'https://wax.pink.gg', /**/
	],
	rpc_hammer: true, // don't ban failed rpc
	rpc_delay: 150,
	rpc_delay_error: 2000,

	waxonedge_contract: 'swap.we',

	waxnode_endpoint: process.env.WAXNODE_ENDPOINT, // Own wax node
	waxnode_http_port: process.env.WAXNODE_HTTP_PORT, // Port for http rpc
	waxnode_ws_port: process.env.WAXNODE_WS_PORT, // Port for state history stream
	hyperion_endpoint: process.env.HYPERION_ENDPOINT, // full history ?
	hyperion_delay: 2000, // delay between hyperion requests
	history_loop_delay: 5000, // Refresh irreversible history every x ms

	mongodb_endpoint: 'mongodb://swaplog:swaplog@mongo:27017',
	mongodb_db: 'swaplog',

	rabbitmq_endpoint: 'amqp://swaplog:swaplog@rabbitmq',
	redis_endpoint: 'redis://:woeredisswaplog@redis:6379',

	// Cache routes on api
	enableRouteMapCache: true, // Bug if pool is deleted or added, must add something to invalidate cache in this case

	// Delay between loop fetch pools on rpcIndexer strategy
	rpcIndexer_loop_delay: 2000,
	// Delay between each refresh of pool list on reader + indexer strategy
	indexer_refresh_delay: 1800000, // 30m

	klinesIndexer_worker_catchup: process.env.KLINESINDEXER_WORKER_CATCHUP || 1, // Process running to update old klines tables
	klinesIndexer_totalWorkBeforeRestart: process.env.KLINESINDEXER_TOTALWORKBEFORERESTART || -1,
	klinesIndexer_doc_endpoint: process.env.KLINESINDEXER_DOC_ENDPOINT,

	knexConfig: {
    client: 'postgresql',
    connection: {
      //host : 'db',
      host : process.env.POSTGRESQL_HOST,
      port : process.env.POSTGRESQL_PORT,
      user : process.env.POSTGRESQL_USER,
      password : process.env.POSTGRESQL_PASSWORD,
      database : process.env.POSTGRESQL_DATABASE,
    },
    pool: {
    	min: 0,
    	max: ((process.env.POSTGRESQL_MAX_POOL !== undefined) ? Number(process.env.POSTGRESQL_MAX_POOL) : 50)
    }
	},
	// noswap contract, exists on platform but removed from smart order routing
	noswap_contracts: [
		'token.worlds',
    'agmxo.wam' // Token has fee, will be restored once fee are fixed
	],
	// Blacklist of pools (hardcode while taco contract is bugged, only supports uni v2 pool)
	pools_blacklist: [
		{src: 'taco', id: 'WAXWAXF'}
	],
	// Contracts blacklisted from volume counting in analytics
	novolume_contracts: [
    'futureusd.gm',
		'waxlord.gm',
		'swap.taco',
		'bmpm.gm',
		'bobocoin.gm',
		'hype.gm'
	],
	start_block: 432580669,//106903731, // don't index under this block, override firstblock
	// List of table to listen delta to keep state into memory
	tables_interest: [
	// tables_interest without rowsSubIndexer are not indexed in memory but detla qstream is still read by readerrows
	{
		code: 'alcordexmain',
		table: 'sellorder',
		rowsSubIndexer: 'orderbooks',
		rowsMapping: 'account', // map account field to their orders inside each scope / order index
		qstream: 'marketOrderbooks_rows_indexer',
	},{
  	code: 'alcordexmain',
  	table: 'buyorder' ,
  	rowsSubIndexer: 'orderbooks',
  	rowsMapping: 'account', // map account field to their orders inside each scope / order index
  	qstream: 'marketOrderbooks_rows_indexer',
	},{
		code: 'alcordexmain',
		table: 'markets',
		src: 'alcormarket',
		qstream: 'marketMatches_rows_indexer',
	},{
		code: 'swap.alcor',
		table: 'pools',
		qstream: 'swapVThreeOrders_rows_indexer',
	},{
		code: 'swap.alcor',
		table: 'positions',
		rowsSubIndexer: 'swapVThreeOrdersAlcorPositions',
		rowsMapping: 'owner',
		qstream: 'swapVThreeAlcorPositions_rows_indexer',
	},{
		code: 'swap.alcor',
		table: 'ticks',
		rowsSubIndexer: 'swapVThreeOrdersAlcorTicks',
		qstream: 'swapVThreeAlcorTicks_rows_indexer',
	},{
		code: 'swap.box',
		table: 'pairs',
		src: 'defibox',
		qstream: 'swapOrders_rows_indexer',
	},{
		code: 'swap.taco',
		table: 'pairs',
		src: 'taco',
		qstream: 'swapOrders_rows_indexer',
	},{
		code: 'swap.adex',
		table: 'pools',
		src: 'adex',
		qstream: 'swapOrders_rows_indexer',
	},{
		code: 'swap.nefty',
		table: 'pairs',
		src: 'neftyblocks',
		qstream: 'swapOrders_rows_indexer',
	},{
    code: 'dapp.fusion',
    table: 'global',
    src: 'waxfusion',
    qstream: 'poolsSpecial_rows_indexer'
  },{
		code: "*",
		table: 'configs',
		rowsSubIndexer: 'bagzregistry',
		qstream: 'bagzregistry_configs_indexer',
	}],
	// List of actions to register into database
	actions_interest: [
    /**
     * If filter by actname is true it will check synced last block by src + table + actname instead of only src + table
     * Usefull when several actions are feeding the same table
    **/
    /**** Limit order ****/
    {
      src: 'neftyblocks',
      account: 'calcormining',
      actname: 'logcancel',
      firstblock: 337548024,
      filterByActname: false,
      classname: 'LimitLogOrderCloseRow',
      table: 'limitLogOrderClose'
    },
    {
      src: 'neftyblocks',
      account: 'calcormining',
      actname: 'orderreceipt',
      firstblock: 337548024,
      filterByActname: false,
      // If order has 0 bid left it will be inserted in both limitLogOrderFill and limitLogOrderClose table
      classname: 'LimitLogOrderFillRow',
      table: 'limitLogOrderFill'
    },
		/**** Swap events ****/
		{
			src: 'neftyblocks',
			account: 'swap.nefty',
			actname: 'logswap',
			firstblock: 315839039,
			filterByActname: false,
			classname: 'SwapOrderRow',
		  table: 'swapOrders',
		},
		{
		  src: 'taco',
		  account: 'swap.taco',
		  actname: 'exchangelog',
		  // block of first tx made on contract for historyReader
		  firstblock: 189036743,
		  filterByActname: false,
		  classname: 'SwapOrderRow',
		  table: 'swapOrders',
		},{
			src: 'alcorv2',
			account: 'swap.alcor',
			actname: 'logswap',
			// block of first tx made on contract for historyReader
			firstblock: 242564140,
			filterByActname: false,
			classname: 'SwapVThreeOrderRow',
			table: 'swapVThreeOrders'
		},{
		  src: 'defibox',
		  account: 'swap.box',
		  actname: 'swaplog',
		  // block of first tx made on contract for historyReader
		  firstblock: 161350059,
		  filterByActname: false,
		  classname: 'SwapOrderRow',
		  table: 'swapOrders',
		},{
			src: 'alcor_sell',
			account: 'alcordexmain',
			actname: 'sellmatch',
			firstblock: 46429362,
			filterByActname: false,
			classname: 'MarketMatchRow',
			table: 'marketMatches'
		},{
			src: 'alcor_buy',
			account: 'alcordexmain',
			actname: 'buymatch',
			firstblock: 46148165,
			filterByActname: false,
			classname: 'MarketMatchRow',
			table: 'marketMatches'
		},
		/**** Create / Delete pools & liquidity events ****/
		{
			src: 'neftyblocks',
			account: 'swap.nefty',
			actname: 'lognewpair',
			firstblock: 315839039,
			classname: 'ListingEventRow',
		  table: 'listingEvents',
		},
		{
		  src: 'taco',
		  account: 'swap.taco',
		  actname: 'liquiditylog',
		  // block of first tx made on contract for historyReader
		  firstblock: 189036743,
			filterByActname: true,
			classname: 'LiquidityRow',
		  table: 'liquidity'
		},
		{
		  src: 'taco',
		  account: 'swap.taco',
		  actname: 'inittoken',
		  // block of first tx made on contract for historyReader
		  firstblock: 189036743,
		  classname: 'ListingEventRow',
		  table: 'listingEvents'
		},
		{
			src: 'defibox',
			account: 'swap.box',
			actname: 'createlog',
			firstblock: 161350059,
			classname: 'ListingEventRow',
			table: 'listingEvents'
		},
		{
			src: 'alcorv2',
			account: 'swap.alcor',
			actname: 'createpool',
			firstblock: 242564140,
			classname: 'ListingEventRow',
			table: 'listingEvents'
		},
		{
			src: 'adex',
			account: 'swap.adex',
			actname: 'createpool',
			firstblock: 301352696,
			classname: 'ListingEventRow',
			table: 'listingEvents'
		},
		{
			src: 'alcorv2',
			account: 'swap.alcor',
			actname: 'logmint', // addliquid
			// block of first tx made on contract for historyReader
			firstblock: 242564140,
			filterByActname: true,
			classname: 'LiquidityRow',
			table: 'liquidity'
		},
		{
			src: 'alcorv2',
			account: 'swap.alcor',
			actname: 'logburn', // subliquid
			// block of first tx made on contract for historyReader
			firstblock: 242564140,
			filterByActname: true,
			classname: 'LiquidityRow',
			table: 'liquidity'
		},
		{
			src: 'alcorv2',
			account: 'swap.alcor',
			actname: 'logcollect',
			// block of first tx made on contract for historyReader
			firstblock: 242564140,
			filterByActname: true,
			classname: 'LiquidityRow',
			table: 'liquidity'
		},
		{
			src: 'alcorv2',
			account: 'swap.alcor',
			actname: 'logpool',
			firstblock: 242564140,
			filterByActname: false,
			classname: 'LogpoolRow',
			table: 'logpool'
		},
		{
		  src: 'defibox',
		  account: 'swap.box',
		  actname: 'liquiditylog',
		  // block of first tx made on contract for historyReader
		  firstblock: 161350059,
			filterByActname: true,
			classname: 'LiquidityRow',
		  table: 'liquidity'
		}
	],
}
