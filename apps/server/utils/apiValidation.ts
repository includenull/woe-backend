import type { CandleQuery } from "@waxonedge/api-contracts";

export type QueryValue = string | string[] | undefined;
export type QueryParams = Record<string, QueryValue>;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export type ParseResult<T> =
  | { valid: true; value: T }
  | { valid: false; error: string };

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
  "countBack",
] as const;

export const swapRouteQueryParams = [
  "token_in",
  "token_out",
  "amount_in",
  "slippage",
  "receiver",
  "split_max_routes",
  "filter_exchange",
  "filter_type",
] as const;

export function validateCandlesQuery(query: QueryParams): ValidationResult {
  if (!hasParams(query, [...candleQueryParams])) {
    return { valid: false, error: "Missing params!" };
  }

  return { valid: true };
}

const toStringValue = (value: QueryValue) =>
  Array.isArray(value) ? null : value;

export function parseCandlesQuery(
  query: QueryParams,
): ParseResult<CandleQuery> {
  const validation = validateCandlesQuery(query);
  if (!validation.valid) {
    return { valid: false, error: validation.error ?? "Invalid params" };
  }

  const duration = toStringValue(query.duration);
  const src = toStringValue(query.src);
  const pairId = toStringValue(query.pair_id);

  if (duration === null || src === null || pairId === null) {
    return { valid: false, error: "Candle params must be single values" };
  }

  if (query.is_reversed !== "true" && query.is_reversed !== "false") {
    return { valid: false, error: "is_reversed must be true or false" };
  }

  const startAt = toFiniteNumber(query.startAt);
  if (startAt === null) {
    return { valid: false, error: "startAt must be a valid number" };
  }

  const endAt = toFiniteNumber(query.endAt);
  if (endAt === null) {
    return { valid: false, error: "endAt must be a valid number" };
  }

  const countBack = toFiniteNumber(query.countBack);
  if (countBack === null) {
    return { valid: false, error: "countBack must be a valid number" };
  }

  return {
    valid: true,
    value: {
      duration,
      src,
      pair_id: pairId,
      is_reversed: query.is_reversed === "true",
      startAt,
      endAt,
      countBack,
    },
  };
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
