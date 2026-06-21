import { ABI } from "@wharfkit/antelope";
import { workerData } from "node:worker_threads";

import { deserializeEosioType } from "./antelope.js";

type DeserializeRow = {
  type: string;
  data: Uint8Array | string | null;
  abi?: unknown;
};

const args = workerData as { abi: unknown };
const shipAbi = ABI.from(args.abi as Parameters<typeof ABI.from>[0]);

export default function deserializeRows(rows: DeserializeRow[]): unknown[] {
  return rows.map((row) => {
    if (row.data === null) {
      throw new Error("Empty data received on deserialize worker");
    }

    if (row.abi) {
      const rowAbi = ABI.from(row.abi as Parameters<typeof ABI.from>[0]);
      return deserializeEosioType(row.type, row.data, rowAbi);
    }

    return deserializeEosioType(row.type, row.data, shipAbi);
  });
}
