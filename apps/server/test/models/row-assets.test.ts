import { describe, expect, it } from "vitest";
import LiquidityRow from "../../bin/Models/Rows/Liquidity.js";
import SwapOrderRow from "../../bin/Models/Rows/SwapOrder.js";
import SwapVThreeOrderRow from "../../bin/Models/Rows/SwapVThreeOrder.js";

const baseRow = {
  trx_id: "ABCDEF",
  src: "test",
  mode: "head",
  action_ordinal: 1,
  pair_id: "1",
  block_num: 123,
  global_sequence: 456,
  trx_time: "2024-01-02T03:04:05.000"
};

describe("row asset parsing", () => {
  it("parses swap order asset fields", () => {
    const row = new SwapOrderRow({
      ...baseRow,
      maker: "maker.wam",
      quantity_in: "1.2345 WAX",
      quantity_out: "2.00000000 USDT",
      reserveA: "10.0000 WAX",
      reserveB: "20.00000000 USDT"
    });

    expect(row.amount_in).toBe(1.2345);
    expect(row.code_in).toBe("WAX");
    expect(row.precision_in).toBe(4);
    expect(row.amount_reserveB).toBe(20);
    expect(row.code_reserveB).toBe("USDT");
    expect(row.precision_reserveB).toBe(8);
  });

  it("parses v3 swap order asset fields", () => {
    const row = new SwapVThreeOrderRow({
      ...baseRow,
      sender: "sender.wam",
      recipient: "recipient.wam",
      tokenA: "-1.2345 WAX",
      tokenB: "2.00000000 USDT",
      sqrtPriceX64: "1",
      liquidity: "100",
      tick: 1,
      reserveA: "10.0000 WAX",
      reserveB: "20.00000000 USDT"
    });

    expect(row.amountA).toBe(1.2345);
    expect(row.negativeA).toBe(true);
    expect(row.amountB).toBe(2);
    expect(row.codeA).toBe("WAX");
    expect(row.precisionB).toBe(8);
    expect(row.reserveA).toBe(10);
  });

  it("parses liquidity extended-asset-like fields", () => {
    const row = new LiquidityRow({
      ...baseRow,
      actname: "liquiditylog",
      extAssetA: { quantity: "10.0000 WAX", contract: "eosio.token" },
      extAssetB: { quantity: "20.00000000 USDT", contract: "usdt.alcor" }
    });

    expect(row.amount_reserveA).toBe(10);
    expect(row.code_reserveA).toBe("WAX");
    expect(row.precision_reserveA).toBe(4);
    expect(row.amount_reserveB).toBe(20);
    expect(row.code_reserveB).toBe("USDT");
    expect(row.precision_reserveB).toBe(8);
  });
});
