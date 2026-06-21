import { describe, expect, it, vi } from "vitest";

import StateHistoryBlockReader from "./reader.js";
import type { ShipBlockResponse, ShipTableDelta } from "./types.js";

function createReader(): StateHistoryBlockReader {
  return new StateHistoryBlockReader("ws://example.invalid", {
    ds_threads: 0,
  });
}

function minimalBlockResponse(): ShipBlockResponse {
  return {
    head: { block_num: 12, block_id: "head" },
    last_irreversible: { block_num: 10, block_id: "lib" },
    this_block: { block_num: 11, block_id: "block" },
    prev_block: { block_num: 10, block_id: "prev" },
    block: {
      block_num: 11,
      block_id: "block",
      head: { block_num: 12, block_id: "head" },
      last_irreversible: { block_num: 10, block_id: "lib" },
    },
    traces: [],
    deltas: [],
  };
}

describe("StateHistoryBlockReader", () => {
  it("builds responses with traces and deltas when signed block payload is absent", async () => {
    const reader = createReader() as any;
    const deltas: ShipTableDelta[] = [
      [
        "table_delta_v0",
        {
          name: "contract_row",
          rows: [],
        },
      ],
    ];
    reader.deserializeParallel = vi.fn(async (type: string) => {
      if (type === "transaction_trace[]") {
        return [];
      }

      if (type === "table_delta[]") {
        return deltas;
      }

      throw new Error(`Unexpected deserialize type ${type}`);
    });

    const block = await reader.buildBlockResponse("get_blocks_result_v0", {
      head: { block_num: 12, block_id: "head" },
      last_irreversible: { block_num: 10, block_id: "lib" },
      this_block: { block_num: 11, block_id: "block" },
      prev_block: { block_num: 10, block_id: "prev" },
      traces: "serialized-traces",
      deltas: "serialized-deltas",
    });

    expect(block).toMatchObject({
      this_block: { block_num: 11, block_id: "block" },
      block: { block_num: 11, block_id: "block" },
      traces: [],
      deltas,
    });
    expect(reader.deserializeParallel).toHaveBeenCalledWith(
      "transaction_trace[]",
      "serialized-traces",
    );
    expect(reader.deserializeParallel).toHaveBeenCalledWith(
      "table_delta[]",
      "serialized-deltas",
    );
  });

  it("does not acknowledge a block when the consumer throws", async () => {
    const reader = createReader() as any;
    reader.buildBlockResponse = vi.fn(async () => minimalBlockResponse());
    reader.flushAcksIfNeeded = vi.fn();
    reader.consume(async () => {
      throw new Error("consumer failed");
    });

    await expect(
      reader.enqueueBlockResult("get_blocks_result_v0", {}),
    ).rejects.toThrow("consumer failed");

    expect(reader.ackPending).toBe(0);
    expect(reader.flushAcksIfNeeded).not.toHaveBeenCalled();
  });
});
