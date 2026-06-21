import { ABI, Name } from "@wharfkit/antelope";
import {
  deserializeEosioType,
  extractShipTableRows,
  extractShipTraces,
  getActionAbiType,
  getTableAbiType,
  type ShipBlockResponse,
  type ShipTableRow,
} from "@blocdraig/ship";

import { fetchAbi, type ChainAbi } from "./utils.js";

export interface ActionInterest {
  account: string;
  actname: string;
}

export interface TableInterest {
  code: string;
  table: string;
}

export interface DecodedReaderAction {
  transaction_id: string;
  account: string;
  name: string;
  authorization: Array<{ actor: string; permission: string }>;
  data: unknown;
  action_ordinal: number;
  global_sequence: string;
  account_ram_deltas: Array<{ account: string; delta: number }>;
  creator_action_ordinal: number;
}

export interface DecodedReaderRow {
  chain_id: string;
  block_num: number;
  block_id: string;
  present: boolean;
  code: string;
  scope: string;
  table: string;
  primary_key: string;
  payer: string;
  value: unknown;
}

type FetchAbi = (accountName: string) => Promise<{
  account_name: string;
  abi: ChainAbi;
}>;

export function leapNameToUint(name: string): string {
  return Name.from(name).value.toString();
}

function actionMatchesInterest(
  action: { account: string; name: string },
  actionsInterest: ActionInterest[],
): boolean {
  return actionsInterest.some(
    (interest) =>
      interest.account === action.account &&
      (interest.actname === action.name || interest.actname === "*"),
  );
}

function tableMatchesInterest(
  row: Pick<ShipTableRow, "code" | "table">,
  tablesInterest: TableInterest[],
): boolean {
  return tablesInterest.some(
    (interest) =>
      (interest.code === row.code || interest.code === "*") &&
      interest.table === row.table,
  );
}

export class ShipReaderAdapter {
  private readonly abiCache = new Map<string, Promise<ABI>>();

  constructor(private readonly abiFetcher: FetchAbi = fetchAbi) {}

  async getAbi(contract: string): Promise<ABI> {
    let abiPromise = this.abiCache.get(contract);

    if (!abiPromise) {
      abiPromise = this.abiFetcher(contract)
        .then(({ abi }) => ABI.from(abi as any))
        .catch((error) => {
          this.abiCache.delete(contract);
          throw error;
        });
      this.abiCache.set(contract, abiPromise);
    }

    return abiPromise;
  }

  async decodeMatchingActions(
    shipBlock: ShipBlockResponse,
    actionsInterest: ActionInterest[],
  ): Promise<DecodedReaderAction[]> {
    const decodedActions: DecodedReaderAction[] = [];

    for (const { trace, txId } of extractShipTraces(shipBlock.traces)) {
      const action = {
        account: trace.act.account,
        name: trace.act.name,
      };

      if (!actionMatchesInterest(action, actionsInterest)) {
        continue;
      }

      const abi = await this.getAbi(action.account);
      const actionType = getActionAbiType(abi, action.account, action.name);

      decodedActions.push({
        transaction_id: txId,
        account: action.account,
        name: action.name,
        authorization: trace.act.authorization ?? [],
        data: deserializeEosioType(actionType, trace.act.data, abi),
        action_ordinal: trace.action_ordinal,
        global_sequence: trace.global_sequence,
        account_ram_deltas: trace.account_ram_deltas,
        creator_action_ordinal: trace.creator_action_ordinal,
      });
    }

    return decodedActions;
  }

  async decodeMatchingTableRows(
    shipBlock: ShipBlockResponse,
    tablesInterest: TableInterest[],
  ): Promise<DecodedReaderRow[]> {
    const decodedRows: DecodedReaderRow[] = [];

    for (const row of extractShipTableRows(shipBlock.deltas)) {
      if (!tableMatchesInterest(row, tablesInterest)) {
        continue;
      }

      const value = row.present
        ? await this.decodeTableRowValue(row)
        : { id: row.primary_key };

      decodedRows.push({
        chain_id: "",
        block_num: shipBlock.this_block.block_num,
        block_id: shipBlock.this_block.block_id,
        present: row.present,
        code: row.code,
        scope: row.scope,
        table: row.table,
        primary_key: row.primary_key,
        payer: row.payer,
        value,
      });
    }

    return decodedRows;
  }

  private async decodeTableRowValue(row: ShipTableRow): Promise<unknown> {
    const abi = await this.getAbi(row.code);
    const tableType = getTableAbiType(abi, row.code, row.table);
    return deserializeEosioType(tableType, row.value, abi);
  }
}
