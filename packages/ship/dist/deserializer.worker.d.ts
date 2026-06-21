type DeserializeRow = {
    type: string;
    data: Uint8Array | string | null;
    abi?: unknown;
};
export default function deserializeRows(rows: DeserializeRow[]): unknown[];
export {};
//# sourceMappingURL=deserializer.worker.d.ts.map