class Token {
	constructor(token) {
		if(token instanceof Token) {
			this.contract = token.contract
			this.symbol = token.symbol
			//this.symbol.ticker = token.symbol.ticker
			//this.symbol.precision = token.symbol.precision
			this.amount = token.amount || 0
		}
		else if(token.quantity !== undefined)
			this.constructFromAsset(token)
		else
			this.constructFromExtSymb(token)
	}

	constructFromAsset(asset) {
		let quantity = ''
		let contract = ''
		if(asset.quantity.units !== undefined) {
			// ext asset from wharfkit get rows
			contract = asset.contract.toString()
			quantity = asset.quantity.toString()
		}
		else {
			//{ "quantity": "1380616.2661 TLM", "contract": "alien.worlds" }
			contract = asset.contract
			quantity = asset.quantity.split(' ')
		}
		this.symbol = {}
		this.symbol.ticker = quantity[1]
		quantity = quantity[0]
		this.amount = 1* quantity
		const precision = quantity.split('.')
		this.symbol.precision = (precision.length > 1) ? precision[1].length : 0
		this.contract = contract
	}

	constructFromExtSymb(extSym) {
		// { sym: '4,USDT', contract: 'usdt.alcor' }
		const sym = extSym.sym.split(',')

		this.symbol = {}
		this.symbol.ticker = sym[1]
		this.symbol.precision = Number(sym[0])
		this.amount = null
		this.contract = extSym.contract
	}

	getHash() {
		return this.getTicker()+'_'+this.contract
	}

	static getHashStatic(token) {
		return Token.getTickerStatic(token)+'_'+token.contract
	}

	static getHashFromContractTickerStatic(contract, ticker) {
		return ticker+'_'+contract
	}

	getQuantity() {
		return this.amount+' '+this.ticker
	}

	getPrecision() {
		return this.symbol.precision
	}

	getTicker() {
		return this.symbol.ticker
	}

	static getTickerStatic(token) {
		return token.symbol.ticker
	}

	getCopy() {
		return new Token(this)
	}
}

export default Token