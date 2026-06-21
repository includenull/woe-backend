import { ABI } from "@wharfkit/antelope";
import type { RawWaxActionTrace, ShipBlockResponse, ShipTableDelta, ShipTableRow, ShipTransactionTrace } from "./types.js";
export type ExtractedShipTrace = {
    trace: RawWaxActionTrace<string | Uint8Array>;
    txId: string;
};
export declare function deserializeEosioType(type: string, data: Uint8Array | string, abi: ABI, _checkLength?: boolean): unknown;
export declare function serializeEosioType(type: string, value: unknown, abi: ABI): Uint8Array;
export declare function getActionAbiType(abi: ABI, contract: string, action: string): string;
export declare function getTableAbiType(abi: ABI, contract: string, table: string): string;
export declare function extractShipTraces(data: ShipTransactionTrace[]): ExtractedShipTrace[];
export declare function extractShipTableRows(deltas: ShipTableDelta[]): ShipTableRow[];
export declare function toBlockTimestamp(block: ShipBlockResponse["block"]): string | undefined;
//# sourceMappingURL=antelope.d.ts.map