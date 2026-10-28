// Layout + colour math for the 7×24 heatmap. D3 computes; React renders.
import { scaleLinear } from 'd3-scale';
import type { Heatmap } from '@/types';

export const HOURS = 24;
export const CELL_GAP = 3;
export const LABEL_WIDTH = 38;
export const HEADER_HEIGHT = 18;
const MIN_CELL = 12;
const MAX_CELL = 30;

export interface HeatmapLayout {
  cell: number;
  width: number;
  height: number;
}

export function heatmapLayout(availableWidth: number, rows: number): HeatmapLayout {
  const fit = (availableWidth - LABEL_WIDTH - (HOURS - 1) * CELL_GAP) / HOURS;
  const cell = Math.min(MAX_CELL, Math.max(MIN_CELL, Math.floor(fit)));
  return {
    cell,
    width: LABEL_WIDTH + HOURS * cell + (HOURS - 1) * CELL_GAP,
    height: HEADER_HEIGHT + rows * cell + Math.max(0, rows - 1) * CELL_GAP,
  };
}

export const cellOffset = (index: number, cell: number): number => index * (cell + CELL_GAP);

/**
 * Count → opacity of the aqua layer over the near-white base. Alpha compositing is a linear
 * sRGB mix, i.e. exactly d3.interpolateRgb(base, aqua)(t), but stays themeable via CSS tokens.
 */
export function intensityScale(max: number): (count: number) => number {
  const scale = scaleLinear()
    .domain([0, Math.max(max, 1)])
    .range([0, 1])
    .clamp(true);
  return (count) => Math.round(scale(count) * 1000) / 1000;
}

export interface BusiestSlot {
  label: string;
  hour: number;
  count: number;
}

export function busiestSlot(heatmap: Heatmap): BusiestSlot | null {
  let best: BusiestSlot | null = null;
  for (const day of heatmap.days) {
    day.counts.forEach((count, hour) => {
      if (count > 0 && (!best || count > best.count)) best = { label: day.label, hour, count };
    });
  }
  return best;
}
