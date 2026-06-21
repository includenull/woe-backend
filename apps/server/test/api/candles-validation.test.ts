import { describe, expect, it } from "vitest";
import { validateCandlesQuery } from "../../utils/apiValidation.js";

describe("candle query validation", () => {
  it("rejects missing required query params", () => {
    expect(validateCandlesQuery({ duration: "1m" })).toEqual({
      valid: false,
      error: "Missing params!"
    });
  });
});
