import { expectTypeOf, test } from "vitest";
import type { SourceType, TokenRef } from "./tokens.js";

test("token contracts", () => {
  expectTypeOf<SourceType>().toEqualTypeOf<"markets" | "pools" | "poolsv3">();
  expectTypeOf<TokenRef>().toHaveProperty("contract").toEqualTypeOf<string>();
});
