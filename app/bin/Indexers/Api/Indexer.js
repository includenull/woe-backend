import express from 'express'
import Tokens from '@models/Tokens.js'
import PoolV3 from '@models/PoolV3.js'
import RouteMap from '@models/RouteMap.js';
import SwapRoutes from '@models/SwapRoutes.js';

class ApiIndexer {
	constructor(getRpcIndexer, getRowsIndexer) {
		this.getRpcIndexer = getRpcIndexer
		this.getRowsIndexer = getRowsIndexer
		this.isReady = false
		this.api = undefined
	}

	setReady(bool) {
		this.isReady = bool
	}

	async start() {
		this.api = express()

		this.api.use(function(req, res, next) {
		  res.header("Access-Control-Allow-Origin", "*");
		  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
		  next();
		});

		this.api.get('/status', async (req, res) => {
			res.send({'ready': this.isReady})
		});

		this.api.get('/pools', async (req, res) => {
			const pools = this.getRpcIndexer().poolMap.getAllPools()
			res.send(pools)
		});

		this.api.get('/pool/:src/:id', async (req, res) => {
			const pool = this.getRpcIndexer().poolMap.getPool(req.params.src, req.params.id)
			res.send(pool)
		});

		this.api.get('/markets', async(req, res) => {
			const markets = this.getRpcIndexer().marketMap.getAllMarkets()
			res.send(markets)
		});

		this.api.get('/market/:src/:id', async(req, res) => {
			const market = this.getRpcIndexer().marketMap.getMarket(req.params.src, req.params.id)
			res.send(market)
		});

		this.api.get('/poolsv3', async(req, res) => {
			const pools = this.getRpcIndexer().poolV3Map.getAllPools()
			res.send(pools)
		});

		this.api.get('/poolv3/:src/:id', async(req, res) => {
			const pool = this.getRpcIndexer().poolV3Map.getPool(req.params.src, req.params.id)
			res.send(pool)
		});

		this.api.get('/get_indexed_rows/:code/:scopes', async(req, res) => {
			const scopes = req.params.scopes.split(',')
			const rows = this.getRowsIndexer().getRowsFromCodeScopes(req.params.code, scopes)

			res.send(rows)
		})

		this.api.get('/get_mapped_rows/:field/:code/:table', async(req, res) => {
			const rows = this.getRowsIndexer().getRowsForMappedField(req.params.field, req.params.code, req.params.table)
			res.send(rows)
		})
		this.api.get('/get_mapped_rows/:field/:code', async(req, res) => {
			const rows = this.getRowsIndexer().getRowsForMappedField(req.params.field, req.params.code)
			res.send(rows)
		})
		this.api.get('/get_mapped_rows/:field', async(req, res) => {
			const rows = this.getRowsIndexer().getRowsForMappedField(req.params.field)
			res.send(rows)
		})

		this.api.get('/tokens', async (req, res) => {
			let tokens = await Tokens.getTokens({ minimalData: (req.query.minimaldata !== undefined && req.query.minimaldata === 'true')})

			if(req.query.nolptoken !== undefined && req.query.nolptoken === 'true')
				tokens = tokens.filter(t => !['alcorammswap', 'lptoken.box', 'swap.taco', 'swap.adex', 'lp.nefty'].includes(t.contract))

			res.send(tokens)
		});

		this.api.get('/wax_price/:contract/:ticker', async(req, res) => {
	    let wax_price = null

	    const contract = req.params.contract
	    const ticker = req.params.ticker

	    if(contract == 'eosio.token' && ticker == 'WAX')
	      wax_price = 1
	    else {
	      let waxPool = this.getRpcIndexer().poolMap.getDeepestWaxPool(contract, ticker)

	      if(waxPool !== null && waxPool.reserve0 > 0 && waxPool.reserve1 > 0) {
	        if(waxPool.token0.contract == 'eosio.token' && waxPool.token0.symbol.ticker == 'WAX')
	          wax_price = waxPool.reserve0 / waxPool.reserve1
	        else
	          wax_price = waxPool.reserve1 / waxPool.reserve0
	      }
	      else {
	        waxPool = this.getRpcIndexer().poolV3Map.getDeepestWaxPool(contract, ticker)

	        if(waxPool !== null) {
	          let price = PoolV3.getPrice(waxPool)

	          if(waxPool.token0.contract != 'eosio.token' && waxPool.token0.symbol.ticker != 'WAX')
	            wax_price = price
	          else
	            wax_price = (price > 0) ? 1/price : 0
	        }
	      }
	    }

	    res.send({ wax_price: wax_price })
		});

		this.api.get('/routes/:tokenIn/:tokenOut', async (req, res) => {
			const routeMap = new RouteMap(this.getRpcIndexer)
			await routeMap.init()

			let tokenIn = req.params.tokenIn.split('_')
			let tokenOut = req.params.tokenOut.split('_')

			if(tokenIn.length < 2 || tokenOut.length < 2) {
				res.send([])
				return;
			}

			tokenIn = {contract: tokenIn[1], symbol: {ticker: tokenIn[0]}}
			tokenOut = {contract: tokenOut[1], symbol: {ticker: tokenOut[0]}}

			const routes = await routeMap.getRoutes(tokenIn, tokenOut)

			res.send(routes)
		});

		this.api.get('/pairDirectSources/:tokenA/:tokenB', async (req, res) => {
			if(!this.isReady) {
				res.send([])
				return false;
			}

			let tokenA = req.params.tokenA.split('_')
			let tokenB = req.params.tokenB.split('_')

			if(tokenA.length < 2 || tokenB.length < 2) {
				res.status(400).json({ error: 'Bad tokens' });
				return false;
			}

			tokenA = this.getRpcIndexer().tokens.tokens.find(t => t.contract === tokenA[1] && t.symbol.ticker === tokenA[0])
			tokenB = this.getRpcIndexer().tokens.tokens.find(t => t.contract === tokenB[1] && t.symbol.ticker === tokenB[0])

			if(tokenA === undefined || tokenB === undefined) {
				res.status(400).json({ error: 'Bad tokens' });
				return false;
			}

			res.send(this.getRpcIndexer().getPairDirectSources(tokenA, tokenB))
		})

		/**
		 * 
		 * GET token_in: ticker_contract of token in
		 * GET token_out: ticker_contract of token out
		 * GET amount_in: amount sent by user to get amountOut of swap
		 * GET slippage: 50 slippage = 0.5%
		**/
		this.api.get('/swapRoutes', async (req, res) => {
			if(!this.isReady) {
				res.send([])
				return false;
			}

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

			let tokenIn = req.query.token_in.split('_')
			let tokenOut = req.query.token_out.split('_')

			if(tokenIn.length < 2 || tokenOut.length < 2) {
				res.send([])
				return;
			}

			tokenIn = this.getRpcIndexer().tokens.tokens.find(t => t.contract === tokenIn[1] && t.symbol.ticker === tokenIn[0])
			tokenOut = this.getRpcIndexer().tokens.tokens.find(t => t.contract === tokenOut[1] && t.symbol.ticker === tokenOut[0])

			if(tokenIn === undefined || tokenOut === undefined) {
				res.send([])
				return;
			}

			const swapRoutes = new SwapRoutes(this.getRpcIndexer, this.getRowsIndexer)
			const swap_routes = await swapRoutes.getSwapRoutes({
				token_in: tokenIn,
				token_out: tokenOut,
				amount_in: req.query.amount_in,
				slippage: Math.max(0, Number(req.query.slippage)),
				receiver: req.query.receiver,
				split_max_routes: Math.max(0, Number(req.query.split_max_routes)),
				filter_exchange: (req.query.filter_exchange !== '') ? req.query.filter_exchange.split(',') : null,
				filter_type: (req.query.filter_type !== '') ? req.query.filter_type.split(',') : null,
				limit: (req.query.limit !== undefined) ? Number(req.query.limit) : undefined,
			})

			res.send(swap_routes)
		});

		this.api.listen(8200, () => {
			console.log('Indexer Api listening on port 8200!')
		});
	}
}

export default ApiIndexer;