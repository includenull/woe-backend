export interface ShipReaderLogger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export type WaxAuthorization = {
  actor: string;
  permission: string;
};

export type RawWaxActionTrace<T = string | Uint8Array | unknown> = {
  action_ordinal: number;
  creator_action_ordinal: number;
  global_sequence: string;
  account_ram_deltas: Array<{ account: string; delta: number }>;
  act: {
    account: string;
    name: string;
    authorization?: WaxAuthorization[];
    data: T;
  };
  trx_id?: string;
};

export type WaxActionTrace<T = unknown> = RawWaxActionTrace<T> & {
  trx_id: string;
};

export interface BlockRequestType {
  start_block_num?: number;
  end_block_num?: number;
  max_messages_in_flight?: number;
  have_positions?: unknown[];
  irreversible_only?: boolean;
  fetch_block?: boolean;
  fetch_traces?: boolean;
  fetch_deltas?: boolean;
}

export type ShipBlock = {
  block_num: number;
  block_id: string;
  head: { block_num: number; block_id: string };
  last_irreversible: { block_num: number; block_id: string };
  timestamp?: string;
  producer?: string;
  confirmed?: number;
  previous?: string;
  transaction_mroot?: string;
  action_mroot?: string;
  schedule_version?: number;
  new_producers?: unknown | null;
  header_extensions?: unknown[];
  producer_signature?: string;
  transactions?: unknown[];
  block_extensions?: unknown[];
};

export type ShipActionTrace<T = string | Uint8Array> = [
  "action_trace_v0" | "action_trace_v1",
  {
    action_ordinal: number;
    creator_action_ordinal: number;
    receipt: ShipActionReceipt;
    receiver: string;
    act: {
      account: string;
      name: string;
      authorization: Array<{ actor: string; permission: string }>;
      data: T;
    };
    context_free: boolean;
    elapsed: string;
    console: string;
    account_ram_deltas: Array<{ account: string; delta: number }>;
    except: unknown | null;
    error_code: unknown | null;
  },
];

export type ShipActionReceipt = [
  "action_receipt_v0",
  {
    receiver: string;
    act_digest: string;
    global_sequence: string;
    recv_sequence: string;
    auth_sequence: Array<{ account: string; sequence: string }>;
    code_sequence: number;
    abi_sequence: number;
  },
];

export type ShipPartialTransaction = [
  "partial_transaction_v0",
  {
    expiration: string;
    ref_block_num: number;
    ref_block_prefix: number;
    max_net_usage_words: number;
    max_cpu_usage_ms: number;
    delay_sec: number;
    transaction_extensions: unknown[];
    signatures: string[];
    context_free_data: unknown[];
  },
];

export type ShipTransactionTrace = [
  "transaction_trace_v0",
  {
    id: string;
    status: number;
    cpu_usage_us: number;
    net_usage_words: number;
    elapsed: string;
    net_usage: string;
    scheduled: boolean;
    action_traces: ShipActionTrace[];
    account_ram_delta: Array<{ account: string; delta: number }> | null;
    except: unknown | null;
    error_code: unknown | null;
    failed_dtrx_trace: unknown | null;
    partial: ShipPartialTransaction;
  },
];

export type ShipTableDeltaName =
  | "account_metadata"
  | "contract_table"
  | "contract_row"
  | "contract_index64"
  | "resource_usage"
  | "resource_limits_state";

export type ShipContractRow = [
  "contract_row_v0",
  {
    code: string;
    scope: string;
    table: string;
    primary_key: string;
    payer: string;
    value: Uint8Array | string;
  },
];

export type ShipTableDelta = [
  "table_delta_v0",
  {
    name: ShipTableDeltaName;
    rows: Array<{
      present: boolean;
      data: [string, unknown];
    }>;
  },
];

export type ShipTableRow<T = Uint8Array | string> = {
  present: boolean;
  code: string;
  scope: string;
  table: string;
  primary_key: string;
  payer: string;
  value: T;
};

export type ShipBlockResponse = {
  head: { block_num: number; block_id: string };
  last_irreversible: { block_num: number; block_id: string };
  this_block: { block_num: number; block_id: string };
  prev_block: { block_num: number; block_id: string };
  block: ShipBlock;
  traces: ShipTransactionTrace[];
  deltas: ShipTableDelta[];
};
