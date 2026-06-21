import { expectTypeOf, test } from "vitest";
import type { CandleQuery } from "./trading.js";

test("candle query contract", () => {
  expectTypeOf<CandleQuery>()
    .toHaveProperty("duration")
    .toEqualTypeOf<string>();
  expectTypeOf<CandleQuery>()
    .toHaveProperty("is_reversed")
    .toEqualTypeOf<boolean>();
  expectTypeOf<CandleQuery>().toHaveProperty("startAt").toEqualTypeOf<number>();
  expectTypeOf<CandleQuery>().toHaveProperty("endAt").toEqualTypeOf<number>();
  expectTypeOf<CandleQuery>()
    .toHaveProperty("countBack")
    .toEqualTypeOf<number>();
});
