class LiquidityPosition {
	constructor(position) {
		this.src = position.src
		this.updated_at_time = position.updated_at_time
		this.created_at_block = position.created_at_block
		this.pairid = position.pairid
		this.reserve0 = position.reserve0
		this.reserve1 = position.reserve1
		this.global_sequence = position.global_sequence
	}
}

export default LiquidityPosition