import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@root": path.resolve(import.meta.dirname),
      "@utils": path.resolve(import.meta.dirname, "utils"),
      "@bin": path.resolve(import.meta.dirname, "bin"),
      "@class": path.resolve(import.meta.dirname, "bin/Class"),
      "@connectors": path.resolve(import.meta.dirname, "bin/Connectors"),
      "@exchanges": path.resolve(import.meta.dirname, "bin/Exchanges"),
      "@indexers": path.resolve(import.meta.dirname, "bin/Indexers"),
      "@models": path.resolve(import.meta.dirname, "bin/Models"),
      "@readers": path.resolve(import.meta.dirname, "bin/Readers"),
    },
  },
});
