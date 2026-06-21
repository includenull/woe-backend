import { ABI } from "@wharfkit/antelope";
import {
  serializeEosioType,
  type ShipBlockResponse,
  type ShipTableDelta,
  type ShipTransactionTrace,
} from "@blocdraig/ship";
import { describe, expect, it, vi } from "vitest";

import { ShipReaderAdapter } from "../../bin/Readers/shipAdapter.js";

const rawAbi = {
  version: "eosio::abi/1.1",
  types: [],
  structs: [
    {
      name: "swap_args",
      base: "",
      fields: [
        { name: "pair_id", type: "uint64" },
        { name: "maker", type: "name" },
      ],
    },
    {
      name: "orders_row",
      base: "",
      fields: [
        { name: "id", type: "uint64" },
        { name: "owner", type: "name" },
      ],
    },
  ],
  actions: [
    {
      name: "swap",
      type: "swap_args",
      ricardian_contract: "",
    },
  ],
  tables: [
    {
      name: "orders",
      type: "orders_row",
      index_type: "i64",
      key_names: [],
      key_types: [],
    },
  ],
  ricardian_clauses: [],
  error_messages: [],
  abi_extensions: [],
  variants: [],
};

const abi = ABI.from(rawAbi as any);

function blockWith({
  traces = [],
  deltas = [],
}: {
  traces?: ShipTransactionTrace[];
  deltas?: ShipTableDelta[];
}): ShipBlockResponse {
  return {
    head: { block_num: 2, block_id: "head" },
    last_irreversible: { block_num: 1, block_id: "lib" },
    this_block: { block_num: 10, block_id: "block-id" },
    prev_block: { block_num: 9, block_id: "prev-id" },
    block: {
      block_num: 10,
      block_id: "block-id",
      head: { block_num: 2, block_id: "head" },
      last_irreversible: { block_num: 1, block_id: "lib" },
    },
    traces,
    deltas,
  };
}

function actionTrace(account: string, name: string): ShipTransactionTrace {
  return [
    "transaction_trace_v0",
    {
      id: "trx",
      status: 0,
      cpu_usage_us: 1,
      net_usage_words: 2,
      elapsed: "3",
      net_usage: "4",
      scheduled: false,
      action_traces: [
        [
          "action_trace_v0",
          {
            action_ordinal: 1,
            creator_action_ordinal: 0,
            receipt: [
              "action_receipt_v0",
              {
                receiver: account,
                act_digest: "digest",
                global_sequence: "7",
                recv_sequence: "1",
                auth_sequence: [],
                code_sequence: 1,
                abi_sequence: 1,
              },
            ],
            receiver: account,
            act: {
              account,
              name,
              authorization: [{ actor: "alice", permission: "active" }],
              data: serializeEosioType(
                "swap_args",
                { pair_id: 55, maker: "alice" },
                abi,
              ),
            },
            context_free: false,
            elapsed: "0",
            console: "",
            account_ram_deltas: [],
            except: null,
            error_code: null,
          },
        ],
      ],
      account_ram_delta: null,
      except: null,
      error_code: null,
      failed_dtrx_trace: null,
      partial: [
        "partial_transaction_v0",
        {
          expiration: "",
          ref_block_num: 0,
          ref_block_prefix: 0,
          max_net_usage_words: 0,
          max_cpu_usage_ms: 0,
          delay_sec: 0,
          transaction_extensions: [],
          signatures: [],
          context_free_data: [],
        },
      ],
    },
  ];
}

function contractRowDelta(
  code: string,
  table: string,
  present = true,
): ShipTableDelta {
  return [
    "table_delta_v0",
    {
      name: "contract_row",
      rows: [
        {
          present,
          data: [
            "contract_row_v0",
            {
              code,
              scope: code,
              table,
              primary_key: "55",
              payer: "payer",
              value: present
                ? serializeEosioType(
                    "orders_row",
                    { id: 55, owner: "alice" },
                    abi,
                  )
                : "",
            },
          ],
        },
      ],
    },
  ];
}

describe("ShipReaderAdapter", () => {
  it("filters and decodes matching actions", async () => {
    const fetchAbi = vi.fn(async (account_name: string) => ({
      account_name,
      abi: rawAbi,
    }));
    const adapter = new ShipReaderAdapter(fetchAbi);
    const block = blockWith({
      traces: [
        actionTrace("swap.test", "swap"),
        actionTrace("swap.test", "ignored"),
      ],
    });

    const actions = await adapter.decodeMatchingActions(block, [
      { account: "swap.test", actname: "swap" },
    ]);

    expect(actions).toMatchObject([
      {
        transaction_id: "trx",
        account: "swap.test",
        name: "swap",
        data: { pair_id: 55, maker: "alice" },
        action_ordinal: 1,
        global_sequence: "7",
      },
    ]);
  });

  it("caches fetched ABIs", async () => {
    const fetchAbi = vi.fn(async (account_name: string) => ({
      account_name,
      abi: rawAbi,
    }));
    const adapter = new ShipReaderAdapter(fetchAbi);

    await adapter.decodeMatchingActions(
      blockWith({ traces: [actionTrace("swap.test", "swap")] }),
      [{ account: "swap.test", actname: "swap" }],
    );
    await adapter.decodeMatchingActions(
      blockWith({ traces: [actionTrace("swap.test", "swap")] }),
      [{ account: "swap.test", actname: "swap" }],
    );

    expect(fetchAbi).toHaveBeenCalledTimes(1);
  });

  it("supports exact and wildcard table filtering", async () => {
    const fetchAbi = vi.fn(async (account_name: string) => ({
      account_name,
      abi: rawAbi,
    }));
    const adapter = new ShipReaderAdapter(fetchAbi);
    const block = blockWith({
      deltas: [
        contractRowDelta("swap.test", "orders"),
        contractRowDelta("other.test", "orders"),
      ],
    });

    await expect(
      adapter.decodeMatchingTableRows(block, [
        { code: "swap.test", table: "orders" },
      ]),
    ).resolves.toMatchObject([
      {
        code: "swap.test",
        table: "orders",
        value: { id: 55, owner: "alice" },
      },
    ]);

    await expect(
      adapter.decodeMatchingTableRows(block, [{ code: "*", table: "orders" }]),
    ).resolves.toHaveLength(2);
  });

  it("keeps deleted rows processable by primary key", async () => {
    const fetchAbi = vi.fn(async (account_name: string) => ({
      account_name,
      abi: rawAbi,
    }));
    const adapter = new ShipReaderAdapter(fetchAbi);

    await expect(
      adapter.decodeMatchingTableRows(
        blockWith({ deltas: [contractRowDelta("swap.test", "orders", false)] }),
        [{ code: "swap.test", table: "orders" }],
      ),
    ).resolves.toMatchObject([
      {
        present: false,
        primary_key: "55",
        value: { id: "55" },
      },
    ]);
  });
});
