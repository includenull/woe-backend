# WaxOnEdge API — Endpoint Reference

Base URL: `http://localhost:8000`

All responses are **gzip-compressed JSON** unless stated otherwise.

---

## Status

### `GET /status`

Returns the health and readiness of all internal services.

**Response**

```json
{
  "running": true,
  "ready": true,
  "services": {
    "klinesindexer": { "running": true, "ready": true },
    "laststatsindexer": { "running": true, "ready": true }
  },
  "reader": {
    "block_num": "432600000"
  },
  "rpc_info": { ... }
}
```

The top-level `ready` field is `true` only when the indexer is running **and** the reader is within 120 blocks of the chain head.

---

## Pools & Markets

### `GET /pools`

Returns all indexed AMM pools (v2).

### `GET /pool/:src/:id`

Returns a single AMM pool.

| Param | Description |
|---|---|
| `src` | DEX source name (e.g. `defibox`, `taco`) |
| `id` | Pool identifier |

### `GET /poolsv3`

Returns all indexed Alcor v3 AMM pools.

### `GET /poolv3/:src/:id`

Returns a single v3 pool.

| Param | Description |
|---|---|
| `src` | DEX source name |
| `id` | Pool identifier |

### `GET /markets`

Returns all indexed order book markets (Alcor Exchange).

### `GET /market/:src/:id`

Returns a single order book market.

| Param | Description |
|---|---|
| `src` | Source name (e.g. `alcor`) |
| `id` | Market identifier |

---

## Tokens

### `GET /tokens`

Returns the token registry.

| Query param | Type | Description |
|---|---|---|
| `nolptoken` | boolean | Exclude LP tokens |
| `minimaldata` | boolean | Return a lightweight subset of token fields |

### `GET /wax_price/:contract/:ticker`

Returns the WAX price of a token.

| Param | Description |
|---|---|
| `contract` | Token contract account |
| `ticker` | Token symbol |

**Response**

```json
{ "wax_price": "0.00012345" }
```

---

## Trading Data

### `GET /candles`

Returns OHLCV candlestick data. All query parameters are required.

| Query param | Type | Description |
|---|---|---|
| `duration` | string | Candle interval (e.g. `1m`, `1h`, `1d`) |
| `src` | string | DEX source |
| `pair_id` | string | Pool or market identifier |
| `is_reversed` | boolean | Reverse the base/quote direction |
| `startAt` | long (ms) | Range start timestamp |
| `endAt` | long (ms) | Range end timestamp |
| `countBack` | int | Minimum number of bars to return |

If the requested range contains fewer bars than `countBack`, earlier bars are prepended automatically.

---

### `POST /trades`

Returns trade history. Body is JSON.

| Field | Type | Required | Description |
|---|---|---|---|
| `src_type` | string | Yes | `markets`, `pools`, or `poolsv3` |
| `src` | string | No | DEX source filter |
| `pair_id` | string | No | Pool or market filter |
| `pairIdSrcArray` | array | No | Array of `{ pair_id, src }` objects for multi-pair queries |
| `wallet` | string | No | Filter by wallet account |
| `wallets` | array | No | Filter by multiple wallet accounts |
| `side` | string | No | `buy` or `sell` — markets only |
| `code1` | string | No | Token symbol filter (either side of the swap) |
| `code2` | string | No | Token symbol filter (either side of the swap) |
| `startAt` | long (ms) | No | Range start |
| `endAt` | long (ms) | No | Range end |
| `min_global_sequence` | long | No | Pagination cursor (lower bound) |
| `max_global_sequence` | long | No | Pagination cursor (upper bound) |
| `limit` | int | No | Max rows to return (default: 100, max: 1000) |

Use `min_global_sequence` / `max_global_sequence` for pagination. `side` is not compatible with `poolsv3`.

---

### `GET /lastVolumes`

Returns recent trading volumes across all sources.

### `GET /lastVolumes/:srcType`

Returns recent trading volumes filtered by source type.

### `GET /lastPriceChanges`

Returns recent price change data across all sources.

### `GET /lastPriceChanges/:srcType`

Returns recent price changes filtered by source type.

---

## Listing Events

### `GET /listingevents`

Returns new token listing events.

| Query param | Type | Description |
|---|---|---|
| `min_global_sequence` | long | Pagination cursor (lower bound) |
| `max_global_sequence` | long | Pagination cursor (upper bound) |
| `limit` | int | Max rows (default: 100, max: 1000) |

---

## Limit Orders

### `GET /limitlogorderfill`

Returns filled limit order events.

| Query param | Type | Description |
|---|---|---|
| `owner` | string | Filter by account |
| `ask_contract` | string | Ask token contract |
| `ask_code` | string | Ask token symbol |
| `bid_contract` | string | Bid token contract |
| `bid_code` | string | Bid token symbol |
| `min_global_sequence` | long | Pagination cursor |
| `max_global_sequence` | long | Pagination cursor |
| `limit` | int | Max rows |

### `GET /limitlogorderclose`

Returns closed limit order events. Accepts the same query parameters as `/limitlogorderfill`.

---

## Swap Routing

### `GET /routes/:tokenIn/:tokenOut`

Returns all available routes between two tokens without computing amounts.

| Param | Description |
|---|---|
| `tokenIn` | `SYMBOL_contract` format (e.g. `WAX_eosio.token`) |
| `tokenOut` | `SYMBOL_contract` format |

### `GET /pairDirectSources/:tokenA/:tokenB`

Returns all DEX sources where a direct pair between two tokens exists.

| Param | Description |
|---|---|
| `tokenA` | `SYMBOL_contract` format |
| `tokenB` | `SYMBOL_contract` format |

### `GET /swapRoutes`

Computes optimal swap routes for a given input amount. All query parameters are required.

| Query param | Type | Description |
|---|---|---|
| `token_in` | string | Input token in `SYMBOL_contract` format |
| `token_out` | string | Output token in `SYMBOL_contract` format |
| `amount_in` | number | Amount to swap (must be > 0) |
| `slippage` | int | Slippage tolerance — 50 = 0.5% (max: 10000) |
| `receiver` | string | WAX account that will receive the output |
| `split_max_routes` | int | Maximum number of routes to split across (max: 10) |
| `filter_exchange` | string | Restrict routing to a specific DEX |
| `filter_type` | string | Restrict routing to a specific pool type |
| `limit` | int | No | Max number of routes returned |

The response includes the actions to broadcast to execute the swap via the `swap.we` router contract.

---

## WebSocket Session

### `POST /socket-session-token`

Generates a short-lived token to authenticate a Socket.IO connection. Body is JSON.

| Field | Type | Required | Description |
|---|---|---|---|
| `uuid` | string | Yes | Client-generated UUID to associate with the session |

**Response**

```json
{ "token": "<session-token>" }
```

The token expires after 1 hour.

---

## Static Assets

### `GET /tokens_logo/:file`

Serves token logo images from the `tokens_logo/` directory.
