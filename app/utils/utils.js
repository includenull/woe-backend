const forceStrTwoDigit = (digit) => {
  digit = ''+digit
  return (digit.length > 1) ? digit : '0'+digit
}

export const isPairReverted = (pair) => {
  // List of tokens that must stay denominator, by order of priority
  const revert_tokens = [
    { ticker: 'USDT', contract: 'usdt.alcor'},
    { ticker: 'WAXUSDT', contract: 'eth.token'},
    { ticker: 'WAXUSDC', contract: 'eth.token'},
    { ticker: 'WAXDAI', contract: 'eth.token'},
    { ticker: 'WAXBUSD', contract: 'eth.token'},
    { ticker: 'WAXWBTC', contract: 'eth.token'},
    { ticker: 'ARBTC', contract: 's.architect'},
    { ticker: 'WAXRBTC', contract: 'eth.token'},
    { ticker: 'WAXWETH', contract: 'eth.token'},
    { ticker: 'WAX', contract: 'eosio.token'}
  ];

  for(const rtoken of revert_tokens)
    if(pair.token1.symbol.ticker === rtoken.ticker && rtoken.contract === pair.token1.contract)
      return true;
    else if(pair.token0.symbol.ticker === rtoken.ticker && rtoken.contract === pair.token0.contract)
      return false;

  return false;
}

//export const precise = (x, y = 4) => Number.parseFloat(x).toFixed(y);
export const precise = (price, precision) => {
  let additionalExposant = 0
  let numStr = price.toString();
  if (numStr.includes('e')) {
    const parts = numStr.split('e');
    additionalExposant = Number(parts[1])
    price = Number(parts[0])
  }

  const rounded = Number(Math.floor(price + "e" + precision) + "e-" + (precision-additionalExposant) )
  return rounded.toFixed(precision);
}
export const littleEndianToDesimal = (string) => {
  if (typeof string === 'string' && string.startsWith('0x')) {
    const boundary = string.length / 2
    const lengthMinusTwo = string.length - 2
    const littleEndian = []

    for (let i = 0; i < boundary; i++) {
      const readIndex = lengthMinusTwo - 2 * i
      littleEndian[i] = string.substring(readIndex, readIndex + 2)
    }

    const bigEndian = littleEndian.join('').substring(0, lengthMinusTwo)

    return parseInt(bigEndian, 16)
  }

  return string
}
export const delay = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}
export const getBlockTimestamp = (block_num) => {
  const firstBlockTimeStamp = 1559696400000;
  const delta = 1769752000 + 3893000// why this difference, did blockchain stopped ? 
  return (1*block_num-1)*500 + firstBlockTimeStamp + delta
}
export const getBlockNumFromTimestamp = (timestamp) => {
  const firstBlockTimeStamp = 1559696400000;
  const delta = 1769752000 + 3893000;
  return Math.floor((timestamp - firstBlockTimeStamp - delta) / 500) + 1;
}
export const makeDateForSmartcontract = (timestamp) => {
  const d = new Date(timestamp)
  const date = d.getUTCFullYear()+'-'+forceStrTwoDigit(1+d.getUTCMonth())+'-'+forceStrTwoDigit(d.getUTCDate())
  const hours = forceStrTwoDigit(d.getUTCHours())+':'+forceStrTwoDigit(d.getUTCMinutes())+':'+forceStrTwoDigit(d.getUTCSeconds())

  return date+'T'+hours+'.'+((d.getUTCMilliseconds() === 0) ? '000' : '500')
}
export const parseDateFromSmartcontract = (string) => {
  //2022-08-13T08:22:14.500
  
  // separate date from hours
  let split = string.split('T')
  const YearMonthDay = split[0].split('-')
  // separate milliseconds
  split = split[1].split('.')
  const Ms = split[1]
  const HoursMinutesSeconds = split[0].split(':')

  let d = new Date();
  d.setUTCFullYear(YearMonthDay[0])
  d.setUTCMonth(YearMonthDay[1]-1)
  d.setUTCDate(YearMonthDay[2])
  d.setUTCHours(HoursMinutesSeconds[0], HoursMinutesSeconds[1], HoursMinutesSeconds[2], Ms)

  return d
}
export const consoleSwapShort = (swap) => {
  const d = new Date(swap.updated_at_time)
  const hours = d.getUTCHours() + ':' + d.getUTCMinutes() + ':' + d.getUTCSeconds() + ':' + d.getUTCMilliseconds()
  const date = d.getUTCFullYear() +'/'+ (1+d.getUTCMonth()) +'/'+ d.getUTCDate() +' '+ hours
  console.log('[mode:'+swap.mode+'][block:'+swap.created_at_block+'][time:'+date+'] '+swap.maker+' on '+swap.src+' swapped '+swap.quantity_in+' for '+swap.quantity_out)
}
export const consoleLiquidityShort = (position) => {
  const d = new Date(position.updated_at_time)
  const hours = d.getUTCHours() + ':' + d.getUTCMinutes() + ':' + d.getUTCSeconds() + ':' + d.getUTCMilliseconds()
  const date = d.getUTCFullYear() +'/'+ (1+d.getUTCMonth()) +'/'+ d.getUTCDate() +' '+ hours
  console.log('[block:'+position.created_at_block+'][time:'+date+'] On '+position.src+' in pool '+position.pairid+' reserve0 '+position.reserve0+' reserve1 '+position.reserve1)
}