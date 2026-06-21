import { describe, expect, it } from "vitest";
import { parseCandlesQuery } from "../../utils/apiValidation.js";

const validQuery = {
  duration: "1m",
  src: "markets",
  pair_id: "123",
  is_reversed: "false",
  startAt: "1000",
  endAt: "2000",
  countBack: "300",
};

describe("candle query validation", () => {
  it("rejects missing required query params", () => {
    expect(parseCandlesQuery({ duration: "1m" })).toEqual({
      valid: false,
      error: "Missing params!",
    });
  });

  it("parses wire query strings into the CandleQuery contract", () => {
    expect(parseCandlesQuery(validQuery)).toEqual({
      valid: true,
      value: {
        duration: "1m",
        src: "markets",
        pair_id: "123",
        is_reversed: false,
        startAt: 1000,
        endAt: 2000,
        countBack: 300,
      },
    });
  });

  it("rejects invalid is_reversed values", () => {
    expect(parseCandlesQuery({ ...validQuery, is_reversed: "yes" })).toEqual({
      valid: false,
      error: "is_reversed must be true or false",
    });
  });

  it("rejects invalid numeric values", () => {
    expect(parseCandlesQuery({ ...validQuery, countBack: "many" })).toEqual({
      valid: false,
      error: "countBack must be a valid number",
    });
  });
});
