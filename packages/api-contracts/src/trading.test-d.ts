import { expectTypeOf, test } from "vitest";
import type { CandleQuery } from "./trading.js";

test("candle query contract", () => {
  expectTypeOf<CandleQuery>().toHaveProperty("duration").toEqualTypeOf<string>();
  expectTypeOf<CandleQuery>().toHaveProperty("countBack").toEqualTypeOf<number>();
});
