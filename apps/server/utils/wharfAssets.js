import { Asset } from '@wharfkit/antelope'

export const parseAsset = (value) => {
  if(value?.quantity !== undefined)
    return Asset.from(value.quantity)

  return Asset.from(value)
}

export const getAssetAmount = (value) => {
  const parsed = parseAsset(value)
  return parsed.units.toNumber() / Math.pow(10, parsed.symbol.precision)
}

export const getAssetCode = (value) => {
  return parseAsset(value).symbol.code.toString()
}

export const getAssetPrecision = (value) => {
  return parseAsset(value).symbol.precision
}
