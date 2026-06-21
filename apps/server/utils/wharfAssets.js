import { Asset } from '@wharfkit/antelope'

export const parseAsset = (value) => {
  if(value?.quantity !== undefined)
    return Asset.from(value.quantity)

  return Asset.from(value)
}

const unitsToDecimalNumber = (units, precision) => {
  const unitsString = units.toString()
  const negative = unitsString.startsWith('-')
  const unsignedUnits = negative ? unitsString.slice(1) : unitsString

  if(precision === 0)
    return Number(unitsString)

  const paddedUnits = unsignedUnits.padStart(precision + 1, '0')
  const whole = paddedUnits.slice(0, -precision)
  const fractional = paddedUnits.slice(-precision)
  return Number(`${negative ? '-' : ''}${whole}.${fractional}`)
}

export const getAssetAmount = (value) => {
  const parsed = parseAsset(value)
  return unitsToDecimalNumber(parsed.units, parsed.symbol.precision)
}

export const getAssetCode = (value) => {
  return parseAsset(value).symbol.code.toString()
}

export const getAssetPrecision = (value) => {
  return parseAsset(value).symbol.precision
}
