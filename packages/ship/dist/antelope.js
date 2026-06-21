import { Bytes, Serializer } from "@wharfkit/antelope";
export function deserializeEosioType(type, data, abi, _checkLength = true) {
    const dataArray = typeof data === "string"
        ? Uint8Array.from(Buffer.from(data, "hex"))
        : new Uint8Array(data);
    const bytes = Bytes.from(dataArray);
    const decoded = Serializer.decode({ data: bytes, abi, type });
    return Serializer.objectify(decoded);
}
export function serializeEosioType(type, value, abi) {
    const encoded = Serializer.encode({ object: value, abi, type });
    return encoded.array;
}
export function getActionAbiType(abi, contract, action) {
    for (const row of abi.actions) {
        if (String(row.name) === action) {
            return row.type;
        }
    }
    throw new Error(`Type for action not found ${contract}:${action}`);
}
export function getTableAbiType(abi, contract, table) {
    for (const row of abi.tables) {
        if (String(row.name) === table) {
            return row.type;
        }
    }
    throw new Error(`Type for table not found ${contract}:${table}`);
}
export function extractShipTraces(data) {
    const result = [];
    for (const transaction of data) {
        if (transaction[0] !== "transaction_trace_v0") {
            throw new Error(`Unsupported transaction response received: ${transaction[0]}`);
        }
        if (transaction[1].status !== 0) {
            continue;
        }
        const txId = transaction[1].id;
        for (const actionTrace of transaction[1].action_traces) {
            if (actionTrace[0] !== "action_trace_v0" &&
                actionTrace[0] !== "action_trace_v1") {
                throw new Error(`Unsupported action trace type ${actionTrace[0]}`);
            }
            if (actionTrace[1].receiver !== actionTrace[1].act.account) {
                continue;
            }
            result.push({
                txId,
                trace: {
                    action_ordinal: actionTrace[1].action_ordinal,
                    creator_action_ordinal: actionTrace[1].creator_action_ordinal,
                    global_sequence: actionTrace[1].receipt[1].global_sequence,
                    account_ram_deltas: actionTrace[1].account_ram_deltas,
                    act: {
                        account: actionTrace[1].act.account,
                        name: actionTrace[1].act.name,
                        authorization: actionTrace[1].act.authorization,
                        data: actionTrace[1].act.data,
                    },
                    trx_id: txId,
                },
            });
        }
    }
    return result.sort((left, right) => {
        return (Number.parseInt(left.trace.global_sequence, 10) -
            Number.parseInt(right.trace.global_sequence, 10));
    });
}
export function extractShipTableRows(deltas) {
    const result = [];
    for (const delta of deltas) {
        if (delta[0] !== "table_delta_v0") {
            throw new Error(`Unsupported table delta type ${delta[0]}`);
        }
        if (delta[1].name !== "contract_row") {
            continue;
        }
        for (const rowDelta of delta[1].rows) {
            const contractRow = rowDelta.data;
            if (contractRow[0] !== "contract_row_v0") {
                continue;
            }
            result.push({
                present: rowDelta.present,
                code: contractRow[1].code,
                scope: contractRow[1].scope,
                table: contractRow[1].table,
                primary_key: contractRow[1].primary_key,
                payer: contractRow[1].payer,
                value: contractRow[1].value,
            });
        }
    }
    return result;
}
export function toBlockTimestamp(block) {
    return block.timestamp;
}
//# sourceMappingURL=antelope.js.map