import type { TokenRef } from "@waxonedge/api-contracts";

export function parseTokenRef(value: string): TokenRef {
  const separatorIndex = value.indexOf("_");

  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new Error("Token references must use SYMBOL_contract format");
  }

  return {
    ticker: value.slice(0, separatorIndex).trim(),
    contract: value.slice(separatorIndex + 1).trim(),
  };
}
