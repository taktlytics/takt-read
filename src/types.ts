// Réponses de l'API de lecture Takt (/api/v1/sites/{domain}/stats/*).
// Les noms de champs reflètent exactement le JSON émis par le backend.

export interface StatsSummaryFigures {
  visitors: number;
  sessions: number;
  pageviews: number;
  bounceRate: number;
  avgDurationS: number;
}

export interface StatsSummary extends StatsSummaryFigures {
  // Présent uniquement si compare=true.
  previous?: StatsSummaryFigures;
}

export interface StatsTimePoint {
  bucket: string; // RFC3339
  visitors: number;
  pageviews: number;
  visits: number;
  bounceRate: number;
  avgDurationS: number;
}

export interface StatsTimeseries {
  interval: string;
  points: StatsTimePoint[];
  // Réindexée sur la grille courante. Présent uniquement si compare=true.
  previous?: StatsTimePoint[];
}

export interface StatsBreakdownRow {
  label: string;
  visitors: number;
  pageviews: number;
  // Présent uniquement si compare=true.
  previous_visitors?: number;
}

export interface StatsBreakdown {
  dimension: string;
  rows: StatsBreakdownRow[];
}

export interface StatsBreakdowns {
  breakdowns: Record<string, StatsBreakdown>;
}

export interface StatsExportRow {
  label: string;
  visitors: number;
  pageviews: number;
}

export interface StatsExportResult<T> {
  data: T;
  truncated: boolean;
}

export interface StatsRealtime {
  visitors: number;
}

export type RevenueByCurrency = Array<{
  currency: string;
  total: string; // décimal sérialisé en chaîne (précision préservée)
  average: string;
  conversions: number;
}>;

export interface GoalConversion {
  id: string;
  type: 'pageview' | 'event' | 'revenue';
  value: string;
  currency?: string;
  revenue?: RevenueByCurrency;
  visitors: number;
  conversions: number;
  conversionRate: number;
}

export interface StatsGoals {
  goals: GoalConversion[];
}

export interface FunnelReportStep {
  label: string;
  visitors: number;
  conversion_rate: number;
  dropoff_rate: number;
}

export interface FunnelReport {
  entered: number;
  converted: number;
  conversion_rate: number;
  steps: FunnelReportStep[];
}

export interface FunnelReportEntry {
  funnel_id: string;
  report: FunnelReport;
}

export type FunnelReports = FunnelReportEntry[];

export type PropertyBreakdown = Array<{
  value: string;
  events: number;
  visitors: number;
}>;

export interface PropertyBatchQuery {
  event: string;
  key?: string;
}

export interface PropertyBatchRequest {
  items: PropertyBatchQuery[];
}

export interface PropertyBatchResult {
  event: string;
  keys: string[];
  breakdownKey: string;
  breakdown: PropertyBreakdown;
}

export interface PropertyBatchResponse {
  items: PropertyBatchResult[];
}
