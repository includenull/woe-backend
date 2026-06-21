import { describe, expect, it, vi } from "vitest";
import { fetchStatus } from "./client.js";

describe("fetchStatus", () => {
  it("fetches the typed status endpoint", async () => {
    const payload = {
      running: true,
      ready: true,
      services: {},
      reader: { block_num: "123" },
      rpc_info: null
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => payload
      })
    );

    await expect(fetchStatus("http://localhost:8000")).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledWith("http://localhost:8000/status");
  });
});
