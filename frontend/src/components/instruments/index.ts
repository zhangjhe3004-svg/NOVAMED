/**
 * 仪表组件库统一出口。
 *
 * 用在「总览控制台 / 运营数据 / 各业务看板」这类读数页面上，
 * 让全站只有一套数字排版与一套动效节奏。
 */
export { default as Odometer } from "./Odometer";
export { default as Metric } from "./Metric";
export { default as DeltaPill } from "./DeltaPill";
export { default as TickRing } from "./TickRing";
export { default as TrendChart } from "./TrendChart";
export { default as BarChart } from "./BarChart";
export { default as MiniSpark } from "./MiniSpark";
export { default as Ruler } from "./Ruler";
export { default as SpecPlate } from "./SpecPlate";
export { default as KpiTile } from "./KpiTile";
export { default as HeatGrid } from "./HeatGrid";
export { default as Swimlane } from "./Swimlane";

export type { OdometerProps } from "./Odometer";
export type { MetricProps } from "./Metric";
export type { DeltaPillProps } from "./DeltaPill";
export type { TickRingProps } from "./TickRing";
export type { TrendChartProps, TrendSeries } from "./TrendChart";
export type { BarChartProps, BarDatum } from "./BarChart";
export type { MiniSparkProps } from "./MiniSpark";
export type { RulerProps } from "./Ruler";
export type { SpecPlateProps, SpecRow } from "./SpecPlate";
export type { KpiTileProps } from "./KpiTile";
export type { HeatCell } from "./HeatGrid";
export type { SwimlaneProps, SwimLane, SwimEvent } from "./Swimlane";
