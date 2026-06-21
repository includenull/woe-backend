import { ABI } from "@wharfkit/antelope";
import { describe, expect, it } from "vitest";

import {
  extractShipTableRows,
  getActionAbiType,
  getTableAbiType,
} from "./antelope.js";
import type { ShipTableDelta } from "./types.js";

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
