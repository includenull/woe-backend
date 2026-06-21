import { ABI } from "@wharfkit/antelope";
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

  it("does not process or acknowledge later blocks after a queued block fails", async () => {
    const reader = createReader() as any;
    const consumer = vi.fn();
    const failedBlock = new Error("bad block");
    reader.buildBlockResponse = vi.fn().mockRejectedValueOnce(failedBlock);
    reader.flushAcksIfNeeded = vi.fn();
    reader.consume(consumer);

    await expect(
      reader.enqueueBlockResult("get_blocks_result_v0", {}),
    ).rejects.toThrow("bad block");
    await expect(
      reader.enqueueBlockResult("get_blocks_result_v0", {}),
    ).rejects.toThrow("bad block");

    expect(reader.buildBlockResponse).toHaveBeenCalledTimes(1);
    expect(consumer).not.toHaveBeenCalled();
    expect(reader.ackPending).toBe(0);
    expect(reader.currentArgs.start_block_num).toBeUndefined();
  });

  it("waits for in-flight processing before reconnect cleanup", async () => {
    const reader = createReader() as any;
    let signalProcessingStarted: (() => void) | undefined;
    let finishProcessing: (() => void) | undefined;
    const processingStarted = new Promise<void>((resolve) => {
      signalProcessingStarted = resolve;
    });
    const processingFinished = new Promise<void>((resolve) => {
      finishProcessing = resolve;
    });
    reader.processingChain = (async () => {
      signalProcessingStarted?.();
      await processingFinished;
    })();
    reader.deserializeWorkers = { destroy: vi.fn(async () => {}) };
    reader.stopped = false;

    const closePromise = reader.onClose();
    await processingStarted;
    await Promise.resolve();

    expect(reader.reconnectTimer).toBeUndefined();

    finishProcessing?.();
    await closePromise;

    expect(reader.reconnectTimer).toBeDefined();
    reader.clearReconnectTimer();
  });

  it("flushes pending acknowledgements before clearing close state", async () => {
    const reader = createReader() as any;
    reader.ackPending = 3;
    reader.ws = {};
    reader.shipAbi = {};
    reader.send = vi.fn();
    reader.stopped = true;

    await reader.onClose();

    expect(reader.send).toHaveBeenCalledWith([
      "get_blocks_ack_request_v0",
      { num_messages: 3 },
    ]);
    expect(reader.ackPending).toBe(0);
    expect(reader.ws).toBeNull();
    expect(reader.shipAbi).toBeNull();
  });

  it("does not send websocket requests when the socket is not open", () => {
    const reader = createReader() as any;
    const ws = {
      readyState: 3,
      send: vi.fn(),
    };
    reader.ws = ws;
    reader.shipAbi = {};

    reader.send(["get_blocks_ack_request_v0", { num_messages: 1 }]);

    expect(ws.send).not.toHaveBeenCalled();
  });

  it("acknowledges consumed messages that are skipped", () => {
    const reader = createReader() as any;
    reader.flushAcksIfNeeded = vi.fn();

    reader.acknowledgeConsumedMessage();

    expect(reader.ackPending).toBe(1);
    expect(reader.flushAcksIfNeeded).toHaveBeenCalledOnce();
  });

  it("initializes deserialize workers from TypeScript sources", async () => {
    const reader = new StateHistoryBlockReader("ws://example.invalid", {
      ds_threads: 1,
    }) as any;
    reader.shipAbi = ABI.from({
      version: "eosio::abi/1.1",
      types: [],
      structs: [],
      actions: [],
      tables: [],
      ricardian_clauses: [],
      error_messages: [],
      abi_extensions: [],
      variants: [],
    } as any);

    await reader.initializeDeserializeWorkers();

    expect(reader.deserializeWorkers).toBeDefined();
    await reader.deserializeWorkers.destroy();
  });

  it("does not terminate a stale websocket while blocks are queued for processing", () => {
    const reader = createReader() as any;
    const ws = {
      readyState: 1,
      ping: vi.fn(),
      terminate: vi.fn(),
    };
    reader.ws = ws;
    reader.connected = true;
    reader.processingBacklog = 1;
    reader.lastShipMessageAt = 0;

    reader.checkConnectionHealth();

    expect(ws.ping).toHaveBeenCalledOnce();
    expect(ws.terminate).not.toHaveBeenCalled();
    expect(reader.lastShipMessageAt).toBeGreaterThan(0);
  });
});
