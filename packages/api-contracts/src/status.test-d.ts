import { expectTypeOf, test } from "vitest";
import type { StatusResponse } from "./status.js";

test("status response contract", () => {
  expectTypeOf<StatusResponse>().toHaveProperty("running").toEqualTypeOf<boolean>();
  expectTypeOf<StatusResponse>().toHaveProperty("reader").toEqualTypeOf<{ block_num: string | null }>();
});
