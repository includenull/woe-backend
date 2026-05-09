class Route {
	constructor(src_types, path) {
		this.path = (path !== undefined) ? path : []
		this.src_types = src_types // all src type in route
	}

	add(hash, isReversed, tokenIn, tokenOut, srcType) {
		this.path.push([hash, isReversed, tokenIn, tokenOut, srcType])
	}

	concat(route) {
		this.path = this.path.concat(route.path)
	}
}

export default Route