import { describe, expect, it } from "vitest";
import { parseTokenRef } from "../../utils/assetParsing.js";

describe("parseTokenRef", () => {
  it("handles SYMBOL_contract values", () => {
    expect(parseTokenRef("WAX_eosio.token")).toEqual({
      ticker: "WAX",
      contract: "eosio.token",
    });
  });

  it("trims token reference parts", () => {
    expect(parseTokenRef(" WAX _ eosio.token ")).toEqual({
      ticker: "WAX",
      contract: "eosio.token",
    });
  });
});
