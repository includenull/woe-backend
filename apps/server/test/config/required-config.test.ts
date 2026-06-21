import { describe, expect, it } from "vitest";
import { getMissingRequiredConfig, parseOptionalStartBlock, validateRequiredConfig } from "../../config.js";

const validConfig = {
  rpc_endpoints: ["http://localhost:8888"],
  waxnode_endpoint: "localhost",
  hyperion_endpoint: "https://example.test/v2/",
  knexConfig: {
    connection: {
      host: "db",
      port: "5432",
      user: "swaplog",
      password: "swaplog",
      database: "swaplog"
    }
  }
};

describe("required server config", () => {
  it("accepts a complete config", () => {
    expect(() => validateRequiredConfig(validConfig)).not.toThrow();
    expect(getMissingRequiredConfig(validConfig)).toEqual([]);
  });

  it("reports all missing required config values", () => {
    const missing = getMissingRequiredConfig({
      rpc_endpoints: [undefined, "   "],
      waxnode_endpoint: "\t",
      hyperion_endpoint: undefined,
      knexConfig: {
        connection: {
          host: "",
          port: undefined,
          user: null,
          password: "",
          database: undefined
        }
      }
    });

    expect(missing).toEqual([
      "rpc_endpoints (set WAXRPC_ENDPOINT)",
      "waxnode_endpoint (set WAXNODE_ENDPOINT)",
      "hyperion_endpoint (set HYPERION_ENDPOINT)",
      "knexConfig.connection.host (set POSTGRESQL_HOST)",
      "knexConfig.connection.port (set POSTGRESQL_PORT)",
      "knexConfig.connection.user (set POSTGRESQL_USER)",
      "knexConfig.connection.password (set POSTGRESQL_PASSWORD)",
      "knexConfig.connection.database (set POSTGRESQL_DATABASE)"
    ]);
  });

  it("throws a fail-fast startup error", () => {
    expect(() => validateRequiredConfig({ ...validConfig, waxnode_endpoint: "" })).toThrow(
      "Missing required server configuration: waxnode_endpoint (set WAXNODE_ENDPOINT)"
    );
  });

  it("ignores invalid START_BLOCK values", () => {
    expect(parseOptionalStartBlock(undefined)).toBeUndefined();
    expect(parseOptionalStartBlock("not-a-number")).toBeUndefined();
    expect(parseOptionalStartBlock("123")).toBe(123);
  });
});
