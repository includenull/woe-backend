# AGENTS.md

## Cursor Cloud specific instructions

WaxOnEdge is a WAX-blockchain DEX swap aggregator. The product is the backend
(`@waxonedge/server`); `apps/web` is a placeholder React/Vite shell.

### Services and how to run them
Standard scripts live in `package.json` (root) and `apps/server/package.json`. Key ones:
- API (public REST, port `8000`): `pnpm server:api`
- Web dev server (Vite, port `5173`): `pnpm dev:web`
- Background daemons: `pnpm --filter @waxonedge/server start_deamon deamon=<name>`
  (e.g. `indexer`, `socketio_server`, `liquidity_prices_indexer`, `last_stats_indexer`,
  `klines_indexer`, `reader`, `reader_rows`). Internal indexer API is on port `8200`.
- Lint/test/build/typecheck: `pnpm lint` / `pnpm test` / `pnpm build` / `pnpm typecheck`.

### Required local infra (already installed in the VM, NOT auto-started)
Redis and PostgreSQL are installed natively but systemd is unavailable, so start them manually:
- Redis: `redis-server /workspace/services_conf/redis.conf --daemonize yes`
  (it requires password `woeredisswaplog`; check with `redis-cli -a woeredisswaplog ping`).
- PostgreSQL: `sudo pg_ctlcluster 16 main start` (role/db `swaplog`/`swaplog`/`swaplog`).

### Non-obvious gotchas
- Docker is NOT installed here. The stack is run natively instead of via `docker-compose`.
- Several hostnames are hardcoded for the Docker network: `redis` (in `apps/server/config.ts`,
  as `redis://:woeredisswaplog@redis:6379`) and `indexer`/`klinesindexer`/`laststatsindexer`
  (in `apps/server/bin/Class/apiFetcher.js`). These are mapped to `127.0.0.1` in `/etc/hosts`,
  so running each daemon natively on its own port works. Do not expect to change these via env.
- `apps/server/.env` (gitignored) holds runtime config. `dotenv` loads it from the process CWD,
  which is `apps/server` when launched via the pnpm filter scripts. `POSTGRESQL_HOST` is set to
  `127.0.0.1`; `WAXRPC_ENDPOINT` points at a public WAX mainnet RPC.
- The SHIP `reader`/`reader_rows` daemons need an external WAX state-history WebSocket node
  (`WAXNODE_ENDPOINT`/port `8080`), which is not available in this VM. They cannot run
  end-to-end here. This is fine: the `indexer` populates pools/markets/tokens directly from the
  public RPC, so `/pools`, `/tokens`, `/markets`, and `/swapRoutes` work without the reader.
- Indexer readiness is slow on a cold start: it pulls Alcor orderbooks and V3 ticks/positions
  from RPC (10k+ table scopes, ~150ms each) before `GET /status` reports `ready:true` and
  `/swapRoutes` returns routes. `/pools` and `/tokens` respond as soon as initial pool/token
  init finishes (well before full readiness). With no reader running, `/status` `ready` stays
  `false` (it compares the reader head block to the chain head), but the indexer's own
  `:8200/status` flips to `{"ready":true}` once catch-up completes.
- `pnpm lint` reports pre-existing Biome formatting violations in `packages/api-contracts`;
  this is a repo code-style issue, not an environment problem.
