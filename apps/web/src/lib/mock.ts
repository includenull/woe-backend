export interface Token {
  ticker: string;
  name: string;
  contract: string;
  precision: number;
  /** hex used for the token's coin chip */
  tint: string;
}

export interface RouteHop {
  /** exchange/protocol that performs this hop */
  via: string;
  from: string;
  to: string;
}

export interface RouteOption {
  id: string;
  label: string;
  kind: "Direct" | "Routing";
  exchanges: string[];
  pricePerUnit: number;
  youReceive: number;
  hops: RouteHop[];
  liquidity: string;
  selected: boolean;
}

export const TOKENS: Record<string, Token> = {
  LSWAX: {
    ticker: "LSWAX",
    name: "Liquid Staked WAX",
    contract: "token.fusion",
    precision: 8,
    tint: "#5b8def",
  },
  WUF: {
    ticker: "WUF",
    name: "Wuffi",
    contract: "wuffi",
    precision: 8,
    tint: "#f2a13b",
  },
  WAX: {
    ticker: "WAX",
    name: "WAXP",
    contract: "eosio.token",
    precision: 8,
    tint: "#f7567c",
  },
  USDT: {
    ticker: "USDT",
    name: "Tether",
    contract: "tethertether",
    precision: 6,
    tint: "#3fbf8f",
  },
  TLM: {
    ticker: "TLM",
    name: "Alien Worlds",
    contract: "alien.worlds",
    precision: 4,
    tint: "#9b6bf0",
  },
};

export const TOKEN_LIST = Object.values(TOKENS);

export interface SwapState {
  sell: Token;
  buy: Token;
  sellBalance: number;
  buyBalance: number;
  sellAmount: number;
  buyAmount: number;
  /** WUF per LSWAX */
  rate: number;
  minimumReceived: number;
  priceImpact: number;
  slippage: number;
  swapFee: number;
  platformFee: number;
  /** USD per WAX, for the header ticker */
  waxPriceUsd: number;
  /** approximate USD value of the sell side */
  sellUsd: number;
}

export const SWAP: SwapState = {
  sell: TOKENS.LSWAX,
  buy: TOKENS.WUF,
  sellBalance: 1089.86403522,
  buyBalance: 123893.0755,
  sellAmount: 1.0,
  buyAmount: 118208.7174,
  rate: 118208.7174,
  minimumReceived: 117617.6738,
  priceImpact: 0.0,
  slippage: 0.5,
  swapFee: 0.35,
  platformFee: 0.3,
  waxPriceUsd: 0.0225,
  sellUsd: 0.0254,
};

export const ROUTE_HOPS: RouteHop[] = [
  { via: "WaxFusion", from: "LSWAX", to: "WAX" },
  { via: "NeftyBlocks", from: "WAX", to: "WUF" },
];

export const ROUTE_OPTIONS: RouteOption[] = [
  {
    id: "best",
    label: "Best route",
    kind: "Routing",
    exchanges: ["WaxFusion", "NeftyBlocks"],
    pricePerUnit: 118208.7174,
    youReceive: 118208.7174,
    hops: ROUTE_HOPS,
    liquidity: "6,499.98 LSWAX / 78,099,957.29 WUF",
    selected: true,
  },
  {
    id: "alcor",
    label: "Alcor v2",
    kind: "Routing",
    exchanges: ["WaxFusion", "Alcor"],
    pricePerUnit: 117980.4421,
    youReceive: 117980.4421,
    hops: [
      { via: "WaxFusion", from: "LSWAX", to: "WAX" },
      { via: "Alcor", from: "WAX", to: "WUF" },
    ],
    liquidity: "5,120.44 LSWAX / 61,004,221.10 WUF",
    selected: false,
  },
  {
    id: "taco",
    label: "TacoSwap",
    kind: "Routing",
    exchanges: ["WaxFusion", "Taco"],
    pricePerUnit: 117412.0098,
    youReceive: 117412.0098,
    hops: [
      { via: "WaxFusion", from: "LSWAX", to: "WAX" },
      { via: "Taco", from: "WAX", to: "WUF" },
    ],
    liquidity: "3,880.10 LSWAX / 44,512,880.55 WUF",
    selected: false,
  },
];

export const QUICK_AMOUNTS = ["25%", "50%", "75%", "Max"] as const;
export const TIMEFRAMES = ["15m", "1H", "4H", "1D", "1W"] as const;

export interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/** Deterministic pseudo-random candles so the chart looks alive but stable. */
export function buildCandles(count = 64, seed = 0.0000085): Candle[] {
  const candles: Candle[] = [];
  let price = seed;
  let rng = 1337;
  const next = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  };
  for (let i = 0; i < count; i++) {
    const drift = (next() - 0.48) * seed * 0.06;
    const o = price;
    const c = Math.max(seed * 0.5, o + drift);
    const wick = Math.abs(drift) + next() * seed * 0.02;
    const h = Math.max(o, c) + wick;
    const l = Math.min(o, c) - wick;
    const v = 40 + next() * 180;
    candles.push({ o, h, l, c, v });
    price = c;
  }
  return candles;
}
