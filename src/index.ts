export { default, default as TaktClient } from './client';
export type { TaktClientOptions } from './client';
export { default as TaktError } from './errors';
export { default as StatsResource } from './resources/stats';
export type { CallOptions } from './resources/stats';
export type {
  StatsQuery,
  SegmentFilter,
  StatsDimension,
  SegmentOperator,
  Period,
  Interval,
} from './query';
export type {
  StatsSummary,
  StatsSummaryFigures,
  StatsTimeseries,
  StatsTimePoint,
  StatsBreakdown,
  StatsBreakdownRow,
  StatsBreakdowns,
  StatsExportRow,
  StatsExportResult,
  StatsRealtime,
  StatsGoals,
  GoalConversion,
  RevenueByCurrency,
  FunnelReports,
  FunnelReportEntry,
  FunnelReport,
  FunnelReportStep,
  PropertyBreakdown,
  PropertyBatchRequest,
  PropertyBatchQuery,
  PropertyBatchResponse,
  PropertyBatchResult,
} from './types';
