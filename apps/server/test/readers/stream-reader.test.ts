import { describe, expect, it } from "vitest";

import StreamReader from "../../bin/Readers/Stream.js";
import {
  getBlockTimestamp,
  makeDateForSmartcontract,
} from "../../utils/utils.js";

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

  it("uses a block-number timestamp fallback when signed block metadata is missing", async () => {
    const reader = createReader([]) as any;
    reader.shipAdapter = {
      decodeMatchingActions: async () => [],
    };

    await expect(
      reader.toReaderBlock({
        head: { block_num: 101, block_id: "head" },
        last_irreversible: { block_num: 99, block_id: "lib" },
        this_block: { block_num: 100, block_id: "block" },
        prev_block: { block_num: 99, block_id: "prev" },
        block: {
          block_num: 100,
          block_id: "block",
          head: { block_num: 101, block_id: "head" },
          last_irreversible: { block_num: 99, block_id: "lib" },
        },
        traces: [],
        deltas: [],
      }),
    ).resolves.toMatchObject({
      timestamp: makeDateForSmartcontract(getBlockTimestamp(100)),
      producer: "",
    });
  });
});
