declare module 'chartsheet' {
  export type ChartType =
    | 'bar'
    | 'column'
    | 'line'
    | 'pie'
    | 'doughnut'
    | 'area'
    | 'scatter'
    | 'radar';

  export interface ChartSeries {
    ref: string;
    name?: string;
    nameRef?: string;
    colour?: string;
    color?: string;
    xRef?: string;
  }

  export interface ChartSpec {
    type?: ChartType;
    title?: string;
    sheet?: string;
    categories?: string;
    series: ChartSeries[];
    anchor?: {
      col: number;
      row: number;
    };
    width?: number;
    height?: number;
    stacked?: boolean;
    horizontal?: boolean;
    dataLabels?: boolean;
    legend?: 'r' | 'l' | 't' | 'b' | false;
    numberFormat?: string;
    gridlines?: boolean;
    gapWidth?: number;
    name?: string;
    xTitle?: string;
    yTitle?: string;
  }

  export function addChart(
    workbook: Uint8Array | ArrayBuffer,
    spec: ChartSpec
  ): Promise<Uint8Array>;
}
