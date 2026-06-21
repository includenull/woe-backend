export type QueryValue = string | string[] | undefined;
export type QueryParams = Record<string, QueryValue>;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const hasParams = (query: QueryParams, params: string[]) =>
  params.every((param) => Object.prototype.hasOwnProperty.call(query, param));

const toFiniteNumber = (value: QueryValue) => {
  if (Array.isArray(value)) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

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

  const amountIn = toFiniteNumber(query.amount_in);
  if (amountIn === null) {
    return { valid: false, error: "Amount in must be a valid number" };
  }

  if (amountIn <= 0) {
    return { valid: false, error: "Amount in must be positive" };
  }

  const slippage = toFiniteNumber(query.slippage);
  if (slippage === null) {
    return { valid: false, error: "Slippage must be a valid number" };
  }

  if (slippage > 10000) {
    return { valid: false, error: "Slippage can't be over 10000" };
  }

  const splitMaxRoutes = toFiniteNumber(query.split_max_routes);
  if (splitMaxRoutes === null) {
    return { valid: false, error: "Split max routes must be a valid number" };
  }

  if (splitMaxRoutes > 10) {
    return { valid: false, error: "Split max routes can't be over 10" };
  }

  return { valid: true };
}
