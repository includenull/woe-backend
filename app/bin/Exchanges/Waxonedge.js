import config from '@root/config.js';
import {precise} from '../../utils/utils.js'

export default class Waxonedge {
	static makeSwapAction({bid, minimum, tokenA, tokenB, route}) {
    let poolPath = ''

    for(const srcPath of route.srcedPath) {
      if(srcPath.type === 'pools')
        poolPath += route[srcPath.type][srcPath.index].pairid+'@'+route[srcPath.type][srcPath.index].src.substr(0, 1)+'-'
      else if(srcPath.type === 'poolsV3') {
        // for pools v3 add 2 after source letter
        poolPath += route[srcPath.type][srcPath.index].id+'@'+route[srcPath.type][srcPath.index].src.substr(0, 1)+'2-'
      }
      else if(srcPath.type === 'markets'){
        // alcormarket = ad
        poolPath += route[srcPath.type][srcPath.index].id+'@ad-'
      }
      else if(srcPath.type === 'poolsspecial') {
        if(route[srcPath.type][srcPath.index].src === 'waxfusion') {
          poolPath += 'LSWAX@wf-'
        }
      }
    }

    poolPath = poolPath.substr(0, poolPath.length - 1)

    const ask = precise(minimum * Math.pow(10, tokenB.symbol.precision), 0)

    return {
      to: config.waxonedge_contract,
      quantity: precise(bid, tokenA.symbol.precision)+' '+tokenA.symbol.ticker,
      //swap,0,MOON@moonmoonmoon|1@a-NEFWAX@t
      memo: 'swap,'+ask+','+tokenB.symbol.ticker+'@'+tokenB.contract+'|'+poolPath
    }
  }
}