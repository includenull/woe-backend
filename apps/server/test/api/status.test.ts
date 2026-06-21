import { expectTypeOf, test } from "vitest";
import type { StatusResponse } from "@waxonedge/api-contracts";

test("status response type matches shared contract", () => {
  expectTypeOf<StatusResponse>().toMatchTypeOf<{
    running: boolean;
    ready: boolean;
    services: Record<string, { running: boolean; ready: boolean }>;
    reader: { block_num: string | null };
    rpc_info: unknown;
  }>();
});
