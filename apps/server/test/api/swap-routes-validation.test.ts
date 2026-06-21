import { describe, expect, it } from "vitest";
import { validateSwapRoutesQuery } from "../../utils/apiValidation.js";

const validQuery = {
  token_in: "WAX_eosio.token",
  token_out: "USDT_usdt.alcor",
  amount_in: "1",
  slippage: "50",
  receiver: "receiver.wam",
  split_max_routes: "2",
  filter_exchange: "",
  filter_type: ""
};

describe("swap route query validation", () => {
  it("rejects missing params", () => {
    expect(validateSwapRoutesQuery({}).valid).toBe(false);
  });

  it("rejects non-positive amount_in", () => {
    expect(validateSwapRoutesQuery({ ...validQuery, amount_in: "0" })).toEqual({
      valid: false,
      error: "Amount in must be positive"
    });
  });

  it("rejects non-numeric amount_in", () => {
    expect(validateSwapRoutesQuery({ ...validQuery, amount_in: "abc" })).toEqual({
      valid: false,
      error: "Amount in must be a valid number"
    });
  });

  it("rejects slippage over 10000", () => {
    expect(validateSwapRoutesQuery({ ...validQuery, slippage: "10001" })).toEqual({
      valid: false,
      error: "Slippage can't be over 10000"
    });
  });

  it("rejects non-finite slippage", () => {
    expect(validateSwapRoutesQuery({ ...validQuery, slippage: "Infinity" })).toEqual({
      valid: false,
      error: "Slippage must be a valid number"
    });
  });

  it("rejects split_max_routes over 10", () => {
    expect(validateSwapRoutesQuery({ ...validQuery, split_max_routes: "11" })).toEqual({
      valid: false,
      error: "Split max routes can't be over 10"
    });
  });

  it("rejects array split_max_routes values", () => {
    expect(validateSwapRoutesQuery({ ...validQuery, split_max_routes: ["2"] })).toEqual({
      valid: false,
      error: "Split max routes must be a valid number"
    });
  });
});
