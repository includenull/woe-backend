import { ABI } from "@wharfkit/antelope";
import { workerData } from "node:worker_threads";
import { deserializeEosioType } from "./antelope.js";
const args = workerData;
const shipAbi = ABI.from(args.abi);
export default function deserializeRows(rows) {
    return rows.map((row) => {
        if (row.data === null) {
            throw new Error("Empty data received on deserialize worker");
        }
        if (row.abi) {
            const rowAbi = ABI.from(row.abi);
            return deserializeEosioType(row.type, row.data, rowAbi);
        }
        return deserializeEosioType(row.type, row.data, shipAbi);
    });
}
//# sourceMappingURL=deserializer.worker.js.map