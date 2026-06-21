import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@root": path.resolve(rootDir),
      "@utils": path.resolve(rootDir, "utils"),
      "@bin": path.resolve(rootDir, "bin"),
      "@class": path.resolve(rootDir, "bin/Class"),
      "@connectors": path.resolve(rootDir, "bin/Connectors"),
      "@exchanges": path.resolve(rootDir, "bin/Exchanges"),
      "@indexers": path.resolve(rootDir, "bin/Indexers"),
      "@models": path.resolve(rootDir, "bin/Models"),
      "@readers": path.resolve(rootDir, "bin/Readers"),
    },
  },
});
