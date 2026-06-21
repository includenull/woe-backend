import { ABI } from "@wharfkit/antelope";
import { describe, expect, it } from "vitest";

import {
  extractShipTraces,
  extractShipTableRows,
  getActionAbiType,
  getTableAbiType,
} from "./antelope.js";
import type { ShipTableDelta, ShipTransactionTrace } from "./types.js";

const abi = ABI.from({
  version: "eosio::abi/1.1",
  types: [],
  structs: [
    {
      name: "transfer_args",
      base: "",
      fields: [{ name: "memo", type: "string" }],
    },
    {
      name: "orders_row",
      base: "",
      fields: [{ name: "id", type: "uint64" }],
    },
  ],
  actions: [
    {
      name: "transfer",
      type: "transfer_args",
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
} as any);

describe("antelope helpers", () => {
  it("finds action ABI types", () => {
    expect(getActionAbiType(abi, "swap.test", "transfer")).toBe(
      "transfer_args",
    );
  });

  it("finds table ABI types", () => {
    expect(getTableAbiType(abi, "swap.test", "orders")).toBe("orders_row");
  });

  it("throws clear errors for missing ABI definitions", () => {
    expect(() => getActionAbiType(abi, "swap.test", "missing")).toThrow(
      "Type for action not found swap.test:missing",
    );
    expect(() => getTableAbiType(abi, "swap.test", "missing")).toThrow(
      "Type for table not found swap.test:missing",
    );
  });

  it("sorts extracted traces by large uint64 global sequences", () => {
    const transaction: ShipTransactionTrace = [
      "transaction_trace_v0",
      {
        id: "trx",
        status: 0,
        cpu_usage_us: 1,
        net_usage_words: 1,
        elapsed: "1",
        net_usage: "1",
        scheduled: false,
        action_traces: [
          [
            "action_trace_v0",
            {
              action_ordinal: 2,
              creator_action_ordinal: 0,
              receipt: [
                "action_receipt_v0",
                {
                  receiver: "swap.test",
                  act_digest: "digest",
                  global_sequence: "9007199254740993",
                  recv_sequence: "1",
                  auth_sequence: [],
                  code_sequence: 1,
                  abi_sequence: 1,
                },
              ],
              receiver: "swap.test",
              act: {
                account: "swap.test",
                name: "swap",
                authorization: [],
                data: "00",
              },
              context_free: false,
              elapsed: "0",
              console: "",
              account_ram_deltas: [],
              except: null,
              error_code: null,
            },
          ],
          [
            "action_trace_v0",
            {
              action_ordinal: 1,
              creator_action_ordinal: 0,
              receipt: [
                "action_receipt_v0",
                {
                  receiver: "swap.test",
                  act_digest: "digest",
                  global_sequence: "9007199254740992",
                  recv_sequence: "1",
                  auth_sequence: [],
                  code_sequence: 1,
                  abi_sequence: 1,
                },
              ],
              receiver: "swap.test",
              act: {
                account: "swap.test",
                name: "swap",
                authorization: [],
                data: "00",
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

    expect(
      extractShipTraces([transaction]).map(
        ({ trace }) => trace.global_sequence,
      ),
    ).toEqual(["9007199254740992", "9007199254740993"]);
  });

  it("keeps action traces with a receiver different from the action account", () => {
    const transaction: ShipTransactionTrace = [
      "transaction_trace_v0",
      {
        id: "trx",
        status: 0,
        cpu_usage_us: 1,
        net_usage_words: 1,
        elapsed: "1",
        net_usage: "1",
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
                  receiver: "notify.test",
                  act_digest: "digest",
                  global_sequence: "10",
                  recv_sequence: "1",
                  auth_sequence: [],
                  code_sequence: 1,
                  abi_sequence: 1,
                },
              ],
              receiver: "notify.test",
              act: {
                account: "swap.test",
                name: "swap",
                authorization: [],
                data: "00",
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

    expect(extractShipTraces([transaction])).toMatchObject([
      {
        trace: {
          act: {
            account: "swap.test",
            name: "swap",
          },
        },
      },
    ]);
  });

  it("extracts present and deleted contract rows", () => {
    const deltas: ShipTableDelta[] = [
      [
        "table_delta_v0",
        {
          name: "resource_usage",
          rows: [
            {
              present: true,
              data: ["resource_usage_v0", {}],
            },
          ],
        },
      ],
      [
        "table_delta_v0",
        {
          name: "contract_row",
          rows: [
            {
              present: true,
              data: [
                "contract_row_v0",
                {
                  code: "swap.test",
                  scope: "swap.test",
                  table: "orders",
                  primary_key: "10",
                  payer: "payer",
                  value: "00",
                },
              ],
            },
            {
              present: false,
              data: [
                "contract_row_v0",
                {
                  code: "swap.test",
                  scope: "swap.test",
                  table: "orders",
                  primary_key: "11",
                  payer: "payer",
                  value: "",
                },
              ],
            },
          ],
        },
      ],
    ];

    expect(extractShipTableRows(deltas)).toEqual([
      {
        present: true,
        code: "swap.test",
        scope: "swap.test",
        table: "orders",
        primary_key: "10",
        payer: "payer",
        value: "00",
      },
      {
        present: false,
        code: "swap.test",
        scope: "swap.test",
        table: "orders",
        primary_key: "11",
        payer: "payer",
        value: "",
      },
    ]);
  });
});
