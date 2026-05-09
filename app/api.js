import express from 'express'
import bodyParser from 'body-parser'
import zlib from 'zlib';
import { v4 as uuidv4 } from 'uuid';
import { createProxyMiddleware } from 'http-proxy-middleware';

import getRedis from '@connectors/RedisConnector.js';

import {KlineRows} from './bin/Models/Rows/Kline.js';
import MarketMatch from './bin/Models/Rows/MarketMatch.js';
import SwapOrder from './bin/Models/Rows/SwapOrder.js';
import SwapVThreeOrder from './bin/Models/Rows/SwapVThreeOrder.js'
import ListingEventRow from '@models/Rows/ListingEvent.js';
import LimitLogOrderFillRow from '@models/Rows/LimitLogOrderFill.js';
import LimitLogOrderCloseRow from '@models/Rows/LimitLogOrderClose.js';

import {delay} from './utils/utils.js';
import { fetchIndexerApi, fetchKlinesIndexerApi, fetchLastStatsApi } from '@class/apiFetcher.js';
import { getInfo } from '@connectors/RpcConnector.js';

const resGzipJson = (json, res) => {
	const jsonData = JSON.stringify(json);

  // Compress the JSON data using gzip
  zlib.gzip(jsonData, (err, compressedData) => {
    if (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
      return;
    }

    // Set appropriate headers for compressed data
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Encoding', 'gzip');
    res.end(compressedData);
  });
}

const app = express()
const redis = await getRedis()

app.disable('x-powered-by');
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// tokens images
const imgRouter = express.Router();
imgRouter.use(express.static('tokens_logo'))
app.use('/tokens_logo', imgRouter);

app.get('/status', async (req, res) => {
	const indexerApiStatus = await fetchIndexerApi('/status');
	const klinesIndexerApiStatus = await fetchKlinesIndexerApi('/status');
	const lastStatsIndexerApiStatus = await fetchLastStatsApi('/status');
	const rpc_info = await getInfo();
	const reader_block_num = await redis.get('READER_BLOCK_NUM')

	res.send({
		//'indexer': {
			'running': indexerApiStatus !== undefined,
			'ready': (indexerApiStatus !== undefined && ((Number(reader_block_num) + 120) >= Number(rpc_info?.head_block_num)) ) ? indexerApiStatus.ready : false,
		//},
		services: {
			'klinesindexer': {
				'running': klinesIndexerApiStatus !== undefined,
				'ready': (klinesIndexerApiStatus !== undefined) ? klinesIndexerApiStatus.ready : false,
			},
			'laststatsindexer': {
				'running': lastStatsIndexerApiStatus !== undefined,
				'ready': (lastStatsIndexerApiStatus !== undefined) ? lastStatsIndexerApiStatus.ready : false,
			},
		},
		'reader': {
			block_num: reader_block_num
		},
		rpc_info: rpc_info
	});
});

app.get('/pools', async (req, res) => {
	const pools = await fetchIndexerApi('/pools')
	resGzipJson(pools, res)
});
app.get('/pool/:src/:id', async (req, res) => {
	const pool = await fetchIndexerApi('/pool/'+req.params.src+'/'+req.params.id)
	resGzipJson(pool, res)
});
app.get('/markets', async (req, res) => {
	const markets = await fetchIndexerApi('/markets')
	resGzipJson(markets, res)
});
app.get('/market/:src/:id', async (req, res) => {
	const market = await fetchIndexerApi('/market/'+req.params.src+'/'+req.params.id)
	resGzipJson(market, res)
});

app.get('/poolsv3', async (req, res) => {
	const pools = await fetchIndexerApi('/poolsv3')
	resGzipJson(pools, res)
});
app.get('/poolv3/:src/:id', async (req, res) => {
	const pool = await fetchIndexerApi('/poolv3/'+req.params.src+'/'+req.params.id)
	resGzipJson(pool, res)
});

app.get('/get_indexed_rows/:code/:scopes', async (req, res) => {
	const rows = await fetchIndexerApi('/get_indexed_rows/'+req.params.code+'/'+req.params.scopes)
	resGzipJson(rows, res)
});

app.get('/get_mapped_rows/:field/:code/:table', async (req, res) => {
	const rows = await fetchIndexerApi('/get_mapped_rows/'+req.params.field+'/'+req.params.code+'/'+req.params.table)
	resGzipJson(rows, res)
});
app.get('/get_mapped_rows/:field/:code', async (req, res) => {
	const rows = await fetchIndexerApi('/get_mapped_rows/'+req.params.field+'/'+req.params.code)
	resGzipJson(rows, res)
});
app.get('/get_mapped_rows/:field', async (req, res) => {
	const rows = await fetchIndexerApi('/get_mapped_rows/'+req.params.field)
	resGzipJson(rows, res)
});

app.get('/lastVolumes', async (req, res) => {
	const lastVolumes = await fetchLastStatsApi('/lastVolumes')
	resGzipJson(lastVolumes, res)
});
app.get('/lastVolumes/:srcType', async (req, res) => {
	if(req.params.srcType !== undefined) {
		const lastVolumes = await fetchLastStatsApi('/lastVolumes/'+req.params.srcType)
		resGzipJson(lastVolumes, res)
	} else {
		const lastVolumes = await fetchLastStatsApi('/lastVolumes')
		resGzipJson(lastVolumes, res)
	}
});
app.get('/lastPriceChanges', async (req, res) => {
	const lastPriceChanges = await fetchLastStatsApi('/lastPriceChanges')
	resGzipJson(lastPriceChanges, res)
});
app.get('/lastPriceChanges/:srcType', async (req, res) => {
	if(req.params.srcType !== undefined) {
		const lastPriceChanges = await fetchLastStatsApi('/lastPriceChanges/'+req.params.srcType)
		resGzipJson(lastPriceChanges, res)
	} else {
		const lastPriceChanges = await fetchLastStatsApi('/lastPriceChanges')
		resGzipJson(lastPriceChanges, res)
	}
});

app.get('/tokens', async (req, res) => {
	let queryPath = '/tokens?'

	if(req.query.nolptoken)
		queryPath += '&nolptoken=true'

	if(req.query.minimaldata)
		queryPath += '&minimaldata=true'

	let tokens = await fetchIndexerApi(queryPath)
  resGzipJson(tokens, res)
});

app.get('/wax_price/:contract/:ticker', async(req, res) => {
	const fetched = await fetchIndexerApi('/wax_price/'+req.params.contract+'/'+req.params.ticker)
	res.send({ wax_price: fetched.wax_price })
})

app.get('/candles', async(req, res, next) => {
	const params = ['duration', 'src', 'pair_id', 'is_reversed', 'startAt', 'endAt', 'countBack']
	
	if(!params.every(param => Object.keys(req.query).includes(param))) {
		res.status(400).json({ error: 'Missing params!' });
		return false;
	}

	/*console.log(req.query)
	console.log('startAt', new Date(1*req.query.startAt))
	console.log('endAt', new Date(1*req.query.endAt))*/

	// Fetch candles
	let candles = []
	try {
		candles = await KlineRows.fetchRows({
			duration: req.query.duration,
			src: req.query.src,
			pair_id: req.query.pair_id,
			startAt: 1*req.query.startAt,
			endAt: 1*req.query.endAt,
			//limit: req.query.countBack // No limit -> In the unlikely case that the number of bars in the requested range is larger than the countBack value, then you should return all the bars in that range instead of truncating it to the countBack length.
		})
		//console.log('initial candles length', candles.length)
	}
	catch(e) {
		res.status(e.code).json({error: e.message})
		return false;
	}

	// If the number of bars in the requested range is less than the countBack value, you should include earlier bars until the countBack count is reached. For example, the chart requests 300 bars in the range [2019-06-01T00:00:00..2020-01-01T00:00:00), and your backend have only 250 bars in the requested period. Return these 250 bars and 50 bars prior to 2019-06-01T00:00:00.
	if(candles.length < req.query.countBack) {
		const leftCandles = await KlineRows.fetchRows({
			duration: req.query.duration,
			src: req.query.src,
			pair_id: req.query.pair_id,
			endAt: req.query.startAt,
			limit: req.query.countBack - candles.length,
			orderBy: 'DESC' // we want last candles of the range so desc order is required
		})
		// put back into asc order
		leftCandles.sort((a, b) => 1*a.updated_at_time - 1*b.updated_at_time)
		candles = leftCandles.concat(candles)
	}

	if(req.query.is_reversed === 'true')
		candles = KlineRows.reverseCandles(candles)

	resGzipJson(candles, res)
});

/** 
 * HTTPS get params : 
 * src_type String [Required] markets or pools or poolsv3
 * src String [Optional] source name of the market or pool or poolv3
 * pair_id String [Optional] pool id or market id
 * wallet string [Optional] bidder / asker or maker
 * status	String	[Optional] NOT USED
 * side	String	[Optional] buy or sell - only works with market
 * code1 String [Optional] filter ticker of one of two used tokens in the swap
 * code2 String [Optional] filter ticker of one of two used tokens in the swap
 * startAt	long	[Optional] Start time (milisecond)
 * endAt	long	[Optional] End time (milisecond)
 * limit int default 100 min 1 max 1000
 * offset (not used YET, need to do pagination for marketMatches and swapRows)
**/
app.post('/trades', bodyParser.json(), async (req, res, next) => {
	if(req.body === undefined) {
		res.status(400).json({ error: 'no body' });
    return false;
	}

  if (!req.body.src_type) {
    res.status(400).json({ error: 'src_type is required!' });
    return false;
  }

  let trades = [];

  if (req.body.limit !== undefined)
    if (req.body.limit > 1000) {
      res.status(400).json({ error: 'Limit must be under 1000, use startAt/endAt or min_global_sequence/max_global_sequence for pagination' });
    }

  try {
    let pairIdSrcArray = req.body.pairIdSrcArray;

    if (req.body.src_type === 'markets') {
      trades = await MarketMatch.fetchRows({
        src: req.body.src || null,
        pair_id: req.body.pair_id || null,
        pairIdSrcArray,
        wallet: req.body.wallet || null,
        wallets: req.body.wallets || null,
        side: req.body.side || null,
        min_global_sequence: req.body.min_global_sequence || null,
        max_global_sequence: req.body.max_global_sequence || null,
        code1: req.body.code1 || null,
        code2: req.body.code2 || null,
        startAt: req.body.startAt || null,
        endAt: req.body.endAt || null,
        limit: req.body.limit || null,
      });
    } else if (req.body.src_type === 'pools') {
      trades = await SwapOrder.fetchRows({
        src: req.body.src || null,
        pair_id: req.body.pair_id || null,
        pairIdSrcArray,
        wallet: req.body.wallet || null,
        wallets: req.body.wallets || null,
        min_global_sequence: req.body.min_global_sequence || null,
        max_global_sequence: req.body.max_global_sequence || null,
        code1: req.body.code1 || null,
        code2: req.body.code2 || null,
        startAt: req.body.startAt || null,
        endAt: req.body.endAt || null,
        limit: req.body.limit || null,
      });
    } else if (req.body.src_type === 'poolsv3') {
      if (req.body.side !== undefined) {
        req.status(400).json({ error: 'side params not compatible with poolsv3' });
        return false;
      }

      trades = await SwapVThreeOrder.fetchRows({
        src: req.body.src || null,
        pair_id: req.body.pair_id || null,
        pairIdSrcArray,
        sender: req.body.wallet || null,
        senders: req.body.wallets || null,
        min_global_sequence: req.body.min_global_sequence || null,
        max_global_sequence: req.body.max_global_sequence || null,
        code1: req.body.code1 || null,
        code2: req.body.code2 || null,
        startAt: req.body.startAt || null,
        endAt: req.body.endAt || null,
        limit: req.body.limit || null,
      });
    } else {
      res.status(400).json({ error: 'Unsupported src_type' });
      return false;
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
    return false;
  }

  resGzipJson(trades, res);
});


/** 
 * HTTPS get params :
 * min_global_sequence
 * max_global_sequence
 * limit int default 100 min 1 max 1000
**/
app.get('/listingevents', async(req, res) => {
	const listingevents = await ListingEventRow.fetchRows({
		min_global_sequence: req.query.min_global_sequence || null,
    max_global_sequence: req.query.max_global_sequence || null,
	  limit: req.query.limit || null,
	});

	resGzipJson(listingevents, res)
})

app.get('/limitlogorderfill', async(req, res) => {
  const rows = await LimitLogOrderFillRow.fetchRows({
    owner: req.query.owner || null,
    ask_contract: req.query.ask_contract || null, 
    ask_code: req.query.ask_code || null,
    bid_contract: req.query.bid_contract || null,
    bid_code: req.query.bid_code || null,
    min_global_sequence: req.query.min_global_sequence || null,
    max_global_sequence: req.query.max_global_sequence || null,
    limit: req.query.limit || null
  });

  resGzipJson(rows, res)
});

app.get('/limitlogorderclose', async(req, res) => {
  const rows = await LimitLogOrderCloseRow.fetchRows({
    owner: req.query.owner || null,
    ask_contract: req.query.ask_contract || null, 
    ask_code: req.query.ask_code || null,
    bid_contract: req.query.bid_contract || null,
    bid_code: req.query.bid_code || null,
    min_global_sequence: req.query.min_global_sequence || null,
    max_global_sequence: req.query.max_global_sequence || null,
    limit: req.query.limit || null
  });

  resGzipJson(rows, res);
});

app.get('/routes/:tokenIn/:tokenOut', async (req, res) => {
	const fetchRoutes = await fetchIndexerApi('/routes/'+req.params.tokenIn+'/'+req.params.tokenOut)
	resGzipJson(fetchRoutes, res)
});

app.get('/pairDirectSources/:tokenA/:tokenB', async(req, res) => {
const fetchRoutes = await fetchIndexerApi('/pairDirectSources/'+req.params.tokenA+'/'+req.params.tokenB)
	resGzipJson(fetchRoutes, res)
});

/**
 * 
 * GET token_in: ticker_contract of token in
 * GET token_out: ticker_contract of token out
 * GET amount_in: amount sent by user to get amountOut of swap
 * GET slippage: 50 slippage = 0.5%
**/
app.get('/swapRoutes', async (req, res) => {
	const params = [
		'token_in',
		'token_out',
		'amount_in',
		'slippage',
		'receiver',
		'split_max_routes',
		'filter_exchange',
		'filter_type'
	]
	
	if(!params.every(param => Object.keys(req.query).includes(param))) {
		res.status(400).json({ error: 'Missing params!' });
		return false;
	}

	if(Number(req.query.amount_in) <= 0) {
		res.status(400).json({ error: 'Amount in must be positive' });
		return false;	
	}

	if(Number(req.query.slippage) > 10000) {
		res.status(400).json({ error: 'Slippage can\'t be over 10000' });
		return false;	
	}

	if(Number(req.query.split_max_routes) > 10) {
		res.status(400).json({ error: 'Split max routes can\'t be over 10' });
		return false;	
	}

	let query = '?'
	for(const p of params)
		query += p+'='+req.query[p]+'&'

	if(req.query.limit !== undefined)
		query += 'limit='+req.query.limit+'&'

	query = query.slice(0, -1) // remove last &

	const fetchSwapRoutes = await fetchIndexerApi('/swapRoutes'+query)
	resGzipJson(fetchSwapRoutes, res)
})

app.post('/socket-session-token', bodyParser.json(), async (req, res) => {
  const { uuid } = req.body;
  if (!uuid) {
    return res.status(400).send('UUID is required');
  }
  const token = uuidv4();
  await redis.set('socket-session-token_'+token, uuid, 'EX', 3600);
  res.json({ token });
});

app.listen(8000, () => {
	console.log('Api listening on port 8000!')
});