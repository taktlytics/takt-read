export type Period = 'day' | '7d' | '30d' | 'month' | '6mo' | '12mo';
export type Interval = 'hour' | 'day' | 'week' | 'month';

// Dimensions standard des stats, mêmes valeurs pour le classement (breakdown) et
// le filtrage (segment). Les singuliers comme "page"/"source" ne sont pas valides.
export type StatsDimension =
  | 'pages'
  | 'sources'
  | 'countries'
  | 'regions'
  | 'cities'
  | 'os'
  | 'browsers'
  | 'devices'
  | 'utm_source'
  | 'utm_medium'
  | 'utm_campaign';

// Seuls "is" et "not" sont acceptés par l'API ("contains" et consorts sont rejetés).
export type SegmentOperator = 'is' | 'not';

export interface SegmentFilter {
  dim: StatsDimension;
  op: SegmentOperator;
  val: string;
  join?: 'and' | 'or';
}

export interface StatsQuery {
  period?: Period;
  from?: string;
  to?: string;
  tz?: string;
  country?: string;
  segment?: SegmentFilter[];
  interval?: Interval;
  compare?: boolean;
  limit?: number;
  dimension?: StatsDimension;
}
