export interface StatusResponse {
  running: boolean;
  ready: boolean;
  services: Record<string, { running: boolean; ready: boolean }>;
  reader: { block_num: string | null };
  rpc_info: unknown;
}
