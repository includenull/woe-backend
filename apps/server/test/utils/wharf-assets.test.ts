import { describe, expect, it } from "vitest";
import {
  getAssetAmount,
  getAssetCode,
  getAssetPrecision,
} from "../../utils/wharfAssets.js";

describe("wharf asset helpers", () => {
  it("parses positive assets", () => {
    expect(getAssetAmount("1.2345 WAX")).toBe(1.2345);
    expect(getAssetCode("1.2345 WAX")).toBe("WAX");
    expect(getAssetPrecision("1.2345 WAX")).toBe(4);
  });

  it("parses negative assets", () => {
    expect(getAssetAmount("-1.2345 WAX")).toBe(-1.2345);
    expect(getAssetCode("-1.2345 WAX")).toBe("WAX");
    expect(getAssetPrecision("-1.2345 WAX")).toBe(4);
  });

  it("parses zero assets", () => {
    expect(getAssetAmount("0.00000000 WAX")).toBe(0);
    expect(getAssetCode("0.00000000 WAX")).toBe("WAX");
    expect(getAssetPrecision("0.00000000 WAX")).toBe(8);
  });

  it("parses extended-asset-like objects", () => {
    const value = { quantity: "12.3456 WAX", contract: "eosio.token" };

    expect(getAssetAmount(value)).toBe(12.3456);
    expect(getAssetCode(value)).toBe("WAX");
    expect(getAssetPrecision(value)).toBe(4);
  });
});
