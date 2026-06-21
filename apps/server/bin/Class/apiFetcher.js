const indexerApi = 'http://indexer:8200';
const klinesIndexerApi = 'http://klinesindexer:8210'
const lastStatsApi = 'http://laststatsindexer:8220'

const fetchApi = async (url, path, attempt = 0) => {
	try {
		let response = await fetch(url+path)
		const data = await response.text();
		try {
			return await JSON.parse(data)
		}
		catch(e) {
			return data;
		}
	}
	catch(err) {
		console.log('Error while fetching api: '+url+path)
		if(err?.cause?.code === 'UND_ERR_SOCKET') {
			++attempt
			if(attempt < 5) {
				console.log('SocketError: other side closed retrying... attempt #'+attempt)
				return await fetchApi(url, path, attempt)
			}
			else
				console.log('SocketError: other side closed')
		}

		return undefined
	}	
}

export const fetchIndexerApi = async (path) => {
	return await fetchApi(indexerApi, path)
}

export const fetchKlinesIndexerApi = async (path) => {
	return await fetchApi(klinesIndexerApi, path)
}

export const fetchLastStatsApi = async (path) => {
	return await fetchApi(lastStatsApi, path)
}