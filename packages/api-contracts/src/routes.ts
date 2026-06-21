export const apiRoutes = {
  status: "/status",
  swapRoutes: "/swapRoutes",
  candles: "/candles"
} as const;

export type ApiRoute = (typeof apiRoutes)[keyof typeof apiRoutes];
