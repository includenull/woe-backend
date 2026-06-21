export type QueryValue = string | string[] | undefined;
export type QueryParams = Record<string, QueryValue>;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const hasParams = (query: QueryParams, params: string[]) =>
  params.every((param) => Object.prototype.hasOwnProperty.call(query, param));

export const candleQueryParams = [
  "duration",
  "src",
  "pair_id",
  "is_reversed",
  "startAt",
  "endAt",
  "countBack"
] as const;

export const swapRouteQueryParams = [
  "token_in",
  "token_out",
  "amount_in",
  "slippage",
  "receiver",
  "split_max_routes",
  "filter_exchange",
  "filter_type"
] as const;

export function validateCandlesQuery(query: QueryParams): ValidationResult {
  if (!hasParams(query, [...candleQueryParams])) {
    return { valid: false, error: "Missing params!" };
  }

  return { valid: true };
}

export function validateSwapRoutesQuery(query: QueryParams): ValidationResult {
  if (!hasParams(query, [...swapRouteQueryParams])) {
    return { valid: false, error: "Missing params!" };
  }

  if (Number(query.amount_in) <= 0) {
    return { valid: false, error: "Amount in must be positive" };
  }

  if (Number(query.slippage) > 10000) {
    return { valid: false, error: "Slippage can't be over 10000" };
  }

  if (Number(query.split_max_routes) > 10) {
    return { valid: false, error: "Split max routes can't be over 10" };
  }

  return { valid: true };
}
