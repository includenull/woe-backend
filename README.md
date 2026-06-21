# WaxOnEdge API

Backend service for [WaxOnEdge](https://waxonedge.app) — a swap aggregator and trading analytics platform built on the WAX blockchain.

It connects to a WAX state history node to index on-chain activity in real time, aggregates liquidity and pricing data across multiple DEXes, and exposes a REST API and WebSocket feed for the frontend.

---

## Overview

The backend is structured as a set of microservices, each responsible for a distinct concern:

| Service                  | Description                                                        |
| ------------------------ | ------------------------------------------------------------------ |
| `reader`                 | Indexes blockchain swap/liquidity actions (logswap, logmint, etc.) |
| `readerrows`             | Tracks smart contract table state changes (pools, pairs, ticks…)   |
| `indexer`                | Aggregates pool and market data, exposes internal API on `:8200`   |
| `liquiditypricesindexer` | Tracks pool liquidity and price movements                          |
| `laststatsindexer`       | Computes recent trading statistics and volume analytics            |
| `klinesindexer`          | Generates OHLCV candlestick data with a worker pool for backfill   |
| `api`                    | Main public REST API on `:8000`                                    |
| `socketio`               | Real-time WebSocket server on `:8010` via Socket.IO                |

---

## Features

- **Multi-DEX swap aggregation** — Alcor exchange, Defibox, Taco, Neftyblocks, A-DEX, WAX Fusion
- **Smart order routing** — finds optimal paths across liquidity pools
- **Real-time data** — WebSocket push for market matches and swap events
- **Candlestick data (klines)** — OHLCV generation and historical backfill
- **Liquidity tracking** — mint/burn events, positions, pool state
- **Token registry** — symbols, contracts, logos, scam filtering
- **Limit orders** — Alcor exchange limit order tracking and fill events
- **Trading analytics** — volume, price history, recent stats

---

## Tech Stack

- **Runtime:** Node.js 18.16.1
- **Framework:** Express.js
- **Real-time:** Socket.IO
- **Blockchain:** WharfKit, Alcor Swap SDK, WAX state history stream
- **Databases:** PostgreSQL (Knex), MongoDB, Redis

---

## Prerequisites

- Docker & Docker Compose
- Access to a WAX node with state history plugin enabled
- Access to a Hyperion API endpoint for historical data

---

## Configuration

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable                       | Description                                                 |
| ------------------------------ | ----------------------------------------------------------- |
| `WAXRPC_ENDPOINT`              | WAX RPC HTTP endpoint                                       |
| `WAXNODE_ENDPOINT`             | WAX node host (state history)                               |
| `WAXNODE_HTTP_PORT`            | WAX node HTTP port (default: `8888`)                        |
| `WAXNODE_WS_PORT`              | WAX node WebSocket port (default: `8080`)                   |
| `HYPERION_ENDPOINT`            | Hyperion v2 API base URL                                    |
| `POSTGRESQL_HOST`              | PostgreSQL host                                             |
| `POSTGRESQL_PORT`              | PostgreSQL port (default: `5432`)                           |
| `POSTGRESQL_DATABASE`          | Database name                                               |
| `POSTGRESQL_USER`              | Database user                                               |
| `POSTGRESQL_PASSWORD`          | Database password                                           |
| `POSTGRESQL_MAX_POOL`          | Max PG connection pool size (default: `50`)                 |
| `KLINESINDEXER_WORKER_CATCHUP` | Number of worker threads for klines backfill (default: `3`) |

### Start block

By default, the reader starts from the current estimated head block minus 10000. To override this, set `START_BLOCK` in `.env` to a specific block number. This is the point from which the reader will begin indexing history — the further back it is, the longer the catch-up phase will take.

On startup, the reader first replays missed blocks by fetching historical transactions from the Hyperion API, then automatically switches to the live WAX state history stream once it has caught up.

---

## Running with Docker

### Production

Start the reader first and wait until it has caught up and switched to the live WAX state history stream:

```bash
docker compose up -d reader
```

Once the reader is live, start the rest of the stack in the background:

```bash
docker compose up -d
```

### Development

The dev compose file adds the following services on top of the base stack:

| Service      | Port   | Description                                        |
| ------------ | ------ | -------------------------------------------------- |
| PostgreSQL   | `5432` | Local database instance (user/pass/db: `swaplog`)  |
| pgAdmin      | `8081` | Web UI to browse and query the PostgreSQL database |
| RedisInsight | `8082` | Web UI to inspect and monitor the Redis instance   |

Start the database first:

```bash
docker compose -f docker-compose.dev.yml up -d db
```

Then start the reader and wait for it to reach the live state history stream:

```bash
docker compose -f docker-compose.dev.yml up -d reader
```

Once the reader is live, start the rest of the stack:

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Exposed ports

Services are exposed on the host:

| Port   | Service              |
| ------ | -------------------- |
| `8000` | REST API             |
| `8010` | Socket.IO WebSocket  |
| `8200` | Internal indexer API |
| `8210` | Klines indexer       |
| `8220` | Last stats indexer   |
| `6379` | Redis                |

---

## Running without Docker

Install dependencies:

```bash
npm install
```

Start individual services:

```bash
npm run start_deamon    # background indexer services (2 GB heap)
npm run start_api       # REST API server
```

Available scripts:

```bash
npm run build                   # compile TypeScript
npm run test                    # run tests
npm run start_deamon_bigmem     # indexer with 4 GB heap
npm run start_deamon_inspect    # indexer with V8 inspector (debug)
npm run start_logodownloader    # fetch and cache token logos
```

---

## Architecture

```
WAX State History Node
        │
   ┌────▼─────┐     ┌────────────┐
   │  reader  │     │ readerrows │   ← blockchain stream consumers
   └────┬─────┘     └─────┬──────┘
        │                 │
        └────────┬─────────┘
                 │ Redis pub/sub
        ┌────────▼────────────────────────────────┐
        │  indexer  │  liquidity  │  klines  │  stats  │   ← data processors
        └────────────────────────────────────────┘
                 │
          PostgreSQL / MongoDB
                 │
        ┌────────▼────────┐     ┌──────────┐
        │   REST API      │     │ Socket.IO │   ← client-facing
        └─────────────────┘     └──────────┘
```

---

## DEX Integrations

| DEX            | Contract       | Type                                                                                                                                                                                                         |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Alcor Exchange | `alcordexmain` | Order book markets                                                                                                                                                                                           |
| Alcor Swap     | `swap.alcor`   | AMM pools                                                                                                                                                                                                    |
| Defibox        | `swap.box`     | AMM pools                                                                                                                                                                                                    |
| Taco           | `swap.taco`    | AMM pools                                                                                                                                                                                                    |
| Neftyblocks    | `swap.nefty`   | AMM pools                                                                                                                                                                                                    |
| A-DEX          | `swap.adex`    | AMM pools                                                                                                                                                                                                    |
| WAX Fusion     | `dapp.fusion`  | Liquid staking derivative (LSD)                                                                                                                                                                              |
| Waxonedge      | `swap.we`      | On-chain swap router — receives tokens, executes a multi-hop route encoded in the memo, and enforces a minimum amount out before releasing funds (cancels the transaction if slippage tolerance is exceeded) |

---

## Refactoring with Claude Code

This codebase was written without AI tooling and contains a number of technical issues that were not easy to resolve at the time. With today's AI tools the architecture can be optimized quickly — using [Claude Code](https://claude.com/claude-code) to refactor and improve the code is highly recommended.

Main areas worth optimizing:

- **Data storage** — the current database is the main bottleneck in production. Migrating to a storage engine better suited to the access patterns (time-series / high-write workloads) would unlock significant headroom.
- **Indexer transport** — rework the indexer so it runs on top of [Wharfkit](https://wharfkit.com/) + a direct WebSocket connection to the state history plugin, instead of relying on the current external library. This resolves the recurring node disconnection issues.
- **Delta-based state replay** — the indexer that reproduces blockchain state by following table deltas can be rewritten to be roughly 5× faster. With AI assistance this kind of rewrite is now realistic in a short timeframe.

---

## License

[MIT](LICENSE) — free to use, modify, and redistribute.
