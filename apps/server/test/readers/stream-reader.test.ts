import { describe, expect, it } from "vitest";

import StreamReader from "../../bin/Readers/Stream.js";

function createReader(actionsInterest: any[]): StreamReader {
  return new StreamReader(
    actionsInterest,
    () => {},
    () => {},
    () => {},
    () => {},
    () => {},
  );
}

describe("StreamReader", () => {
  it("resolves wildcard action interests with the concrete action name", () => {
    const reader = createReader([
      {
        account: "swap.test",
        actname: "*",
        classname: "LiquidityRow",
        src: "alcorv2",
      },
    ]);

    expect(
      reader.getSourceActionInterest({
        account: "swap.test",
        name: "logmint",
      }),
    ).toMatchObject({
      account: "swap.test",
      actname: "logmint",
      classname: "LiquidityRow",
      src: "alcorv2",
    });
  });

  it("prefers exact action interests over wildcard interests", () => {
    const reader = createReader([
      {
        account: "swap.test",
        actname: "*",
        classname: "LiquidityRow",
        src: "wildcard",
      },
      {
        account: "swap.test",
        actname: "swap",
        classname: "SwapOrderRow",
        src: "exact",
      },
    ]);

    expect(
      reader.getSourceActionInterest({
        account: "swap.test",
        name: "swap",
      }),
    ).toMatchObject({
      actname: "swap",
      classname: "SwapOrderRow",
      src: "exact",
    });
  });

  it("returns null when no action interest matches", () => {
    const reader = createReader([
      {
        account: "swap.test",
        actname: "*",
      },
    ]);

    expect(
      reader.getSourceActionInterest({
        account: "other.test",
        name: "swap",
      }),
    ).toBeNull();
  });

  it("skips unmatched actions while processing a block", async () => {
    const reader = createReader([
      {
        account: "swap.test",
        actname: "swap",
      },
    ]) as any;
    reader.info = { last_irreversible_block_num: 100 };

    await expect(
      reader.processBlock({
        block_num: 10,
        timestamp: "2024-01-02T03:04:05.000",
        actions: [
          {
            account: "other.test",
            name: "swap",
          },
        ],
      }),
    ).resolves.toEqual([]);
  });
});
