export interface CandleQuery {
  duration: string;
  src: string;
  pair_id: string;
  is_reversed: boolean;
  startAt: number;
  endAt: number;
  countBack: number;
}
