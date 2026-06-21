import { describe, expect, it } from "vitest";

describe("environment", () => {
  it("keeps process env available for config migration", () => {
    expect(process.env).toBeTypeOf("object");
  });
});
