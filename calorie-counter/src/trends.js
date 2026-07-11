import { getEntriesForRange } from "./log.js";
import { getWeightForRange } from "./bodyLog.js";
import { KCAL_PER_G } from "./summary.js";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Buckets entries into one totals object per day across [start, start+days),
// including zero-entry food/water days so gaps in logging show as zero
// rather than being skipped and silently compressing the x-axis. Weight is
// different — it's sparse by nature (not a daily habit like logging food),
// so a day with no weigh-in gets `weight_kg: null`, not 0, and the chart
// renders that as a gap rather than a false drop to zero.
function aggregateByDay(entries, weightRows, start, days) {
  const buckets = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    buckets.push({ date, kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, weight_kg: null });
  }
  const byTime = new Map(buckets.map((b) => [b.date.getTime(), b]));
  for (const e of entries) {
    const bucket = byTime.get(startOfDay(new Date(e.logged_at)).getTime());
    if (!bucket) continue;
    bucket.kcal += Number(e.kcal) || 0;
    bucket.protein_g += Number(e.protein_g) || 0;
    bucket.fat_g += Number(e.fat_g) || 0;
    bucket.carbs_g += Number(e.carbs_g) || 0;
  }
  for (const w of weightRows) {
    const [y, m, d] = w.date.split("-").map(Number);
    const bucket = byTime.get(new Date(y, m - 1, d).getTime());
    if (bucket) bucket.weight_kg = Number(w.kg);
  }
  return buckets;
}

// Rounds a chart max up to a "clean" value (1/2/5 x 10^n) so axis ticks
// read as round numbers instead of whatever the data happened to peak at.
function niceMax(value) {
  if (value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / magnitude;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * magnitude;
}

// Magnitude data (kcal, grams) is always zero-anchored — {minV: 0, maxV}.
// Weight is different: it fluctuates in a narrow band far from zero, so a
// zero-anchored axis would flatten a real, meaningful 68-72kg swing into an
// imperceptible sliver near the top of the chart. Padding both ends to the
// data's own range (a standard convention for this kind of chart) is what
// makes day-to-day change actually visible.
function axisRange(values, { zeroAnchored }) {
  if (zeroAnchored) return { minV: 0, maxV: niceMax(Math.max(...values, 1)) };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.4, 1);
  return { minV: Math.floor(min - pad), maxV: Math.ceil(max + pad) };
}

const W = 400;
const H = 220;
// Right margin is wide enough to fit a 5-char end-value label
// ("1,800") without it clipping past the SVG's viewBox edge (SVG clips
// anything outside the viewBox by default).
const MARGIN = { top: 12, right: 44, bottom: 24, left: 40 };

function xAt(i, n, plotW) {
  return MARGIN.left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
}
function yAt(v, minV, maxV, plotH) {
  const range = maxV - minV;
  return MARGIN.top + plotH - (range > 0 ? ((v - minV) / range) * plotH : plotH / 2);
}

function shortDate(d, days) {
  return days > 14
    ? new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(d)
    : new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d);
}

function fullDate(d) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(d);
}

// Splits a series into contiguous runs of non-null values — a null entry
// (no weigh-in that day) breaks the run so the line shows a gap instead of
// interpolating a false trend across days with no data.
function nonNullRuns(buckets, key) {
  const runs = [];
  let current = [];
  buckets.forEach((b, i) => {
    if (b[key] == null) {
      if (current.length) runs.push(current);
      current = [];
    } else {
      current.push(i);
    }
  });
  if (current.length) runs.push(current);
  return runs;
}

// One or more plain lines sharing an axis (Daily Calories: single series;
// Weight: single series with gaps for unlogged days).
function buildLineMarks(buckets, series, plotW, plotH, minV, maxV, valueSuffix) {
  const n = buckets.length;
  return series
    .map((s) => {
      const runs = nonNullRuns(buckets, s.key);
      const polylines = runs
        .map((run) => {
          const points = run.map((i) => `${xAt(i, n, plotW)},${yAt(buckets[i][s.key], minV, maxV, plotH)}`).join(" ");
          return `<polyline class="trend-line" points="${points}" style="stroke:var(${s.colorVar})"></polyline>`;
        })
        .join("");
      const dots = buckets
        .map((b, i) => {
          if (b[s.key] == null) return "";
          const x = xAt(i, n, plotW);
          const y = yAt(b[s.key], minV, maxV, plotH);
          return `<circle class="trend-dot" data-series="${s.key}" cx="${x}" cy="${y}" r="4" style="fill:var(${s.colorVar})"><title>${fullDate(b.date)} · ${s.label}: ${Math.round(b[s.key])}${valueSuffix}</title></circle>`;
        })
        .join("");
      const lastIdx = [...buckets.keys()].reverse().find((i) => buckets[i][s.key] != null);
      const endLabel =
        series.length === 1 && lastIdx != null
          ? `<text class="trend-end-label" x="${xAt(lastIdx, n, plotW) + 6}" y="${yAt(buckets[lastIdx][s.key], minV, maxV, plotH)}" dominant-baseline="middle">${Math.round(buckets[lastIdx][s.key]).toLocaleString()}</text>`
          : "";
      return polylines + dots + endLabel;
    })
    .join("");
}

// Stacked area — each series' own (non-cumulative) value is what the
// tooltip/legend show, but the band drawn is cumulative on top of the
// previous series, per the standard stacked-area convention. Fill is a
// light wash of the series color with a full-color 2px line along the
// band's top edge for definition (see dataviz skill's mark specs).
function buildStackedAreaMarks(buckets, series, plotW, plotH, maxV, valueSuffix) {
  const n = buckets.length;
  let cumPrev = buckets.map(() => 0);
  return series
    .map((s) => {
      const cumNow = buckets.map((b, i) => cumPrev[i] + (b[s.key] || 0));
      const topPts = cumNow.map((v, i) => `${xAt(i, n, plotW)},${yAt(v, 0, maxV, plotH)}`);
      const bottomPts = cumPrev.map((v, i) => `${xAt(i, n, plotW)},${yAt(v, 0, maxV, plotH)}`).reverse();
      const areaPath = `M ${[...topPts, ...bottomPts].join(" L ")} Z`;
      const area = `<path class="trend-area" d="${areaPath}" style="fill:var(${s.colorVar})"></path>`;
      const topLine = `<polyline class="trend-line" points="${topPts.join(" ")}" style="stroke:var(${s.colorVar})"></polyline>`;
      const dots = buckets
        .map((b, i) => {
          const x = xAt(i, n, plotW);
          const y = yAt(cumNow[i], 0, maxV, plotH);
          return `<circle class="trend-dot" data-series="${s.key}" cx="${x}" cy="${y}" r="4" style="fill:var(${s.colorVar})"><title>${fullDate(b.date)} · ${s.label}: ${Math.round(b[s.key])}${valueSuffix}</title></circle>`;
        })
        .join("");
      cumPrev = cumNow;
      return area + topLine + dots;
    })
    .join("");
}

// Shared chart shell (gridlines, x-axis labels, crosshair overlay) — marks
// (plain lines or a stacked area) are built separately and passed in, since
// the axis/grid/crosshair scaffolding is identical either way.
function buildChartShell({ buckets, minV, maxV, marksSvg, showLegend, legendSeries }) {
  const n = buckets.length;
  const plotW = W - MARGIN.left - MARGIN.right;
  const plotH = H - MARGIN.top - MARGIN.bottom;

  const gridCount = 4;
  const gridlines = Array.from({ length: gridCount + 1 }, (_, i) => {
    const v = minV + ((maxV - minV) / gridCount) * i;
    const y = yAt(v, minV, maxV, plotH);
    return `
      <line class="trend-grid" x1="${MARGIN.left}" y1="${y}" x2="${W - MARGIN.right}" y2="${y}"></line>
      <text class="trend-axis-label" x="${MARGIN.left - 6}" y="${y}" text-anchor="end" dominant-baseline="middle">${Math.round(v).toLocaleString()}</text>
    `;
  }).join("");

  // Thin out x-axis labels so a 30-day range doesn't overlap every tick.
  const labelEvery = n > 14 ? 5 : 1;
  const xLabels = buckets
    .map((b, i) => {
      if (i % labelEvery !== 0 && i !== n - 1) return "";
      const x = xAt(i, n, plotW);
      return `<text class="trend-axis-label" x="${x}" y="${H - 6}" text-anchor="middle">${shortDate(b.date, n)}</text>`;
    })
    .join("");

  const legend = showLegend
    ? `<div class="donut-legend trend-legend">${legendSeries
        .map(
          (s) => `<div class="legend-row"><span class="legend-swatch" style="background:var(${s.colorVar})"></span><span class="legend-label">${s.label}</span></div>`
        )
        .join("")}</div>`
    : "";

  return `
    <div class="trend-chart-wrap">
      <svg class="trend-svg" viewBox="0 0 ${W} ${H}" data-plot-left="${MARGIN.left}" data-plot-width="${plotW}" data-n="${n}">
        ${gridlines}
        ${marksSvg}
        ${xLabels}
        <line class="trend-crosshair" x1="0" y1="${MARGIN.top}" x2="0" y2="${H - MARGIN.bottom}" hidden></line>
        <rect class="trend-overlay" x="${MARGIN.left}" y="0" width="${plotW}" height="${H}"></rect>
      </svg>
      <div class="trend-tooltip" hidden></div>
    </div>
    ${legend}
  `;
}

function wireCrosshair(wrap, buckets, tooltipSeries, valueSuffix) {
  const svg = wrap.querySelector(".trend-svg");
  const overlay = svg.querySelector(".trend-overlay");
  const crosshair = svg.querySelector(".trend-crosshair");
  const tooltip = wrap.querySelector(".trend-tooltip");
  const plotLeft = Number(svg.dataset.plotLeft);
  const plotWidth = Number(svg.dataset.plotWidth);
  const n = Number(svg.dataset.n);

  function nearestIndex(clientX) {
    const rect = svg.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * W;
    const frac = n > 1 ? (svgX - plotLeft) / plotWidth : 0;
    return Math.min(n - 1, Math.max(0, Math.round(frac * (n - 1))));
  }

  function show(clientX) {
    const i = nearestIndex(clientX);
    const x = xAt(i, n, plotWidth);
    crosshair.setAttribute("x1", x);
    crosshair.setAttribute("x2", x);
    crosshair.hidden = false;

    const b = buckets[i];
    const rows = tooltipSeries
      .map((s) => {
        const v = b[s.key];
        const val = v == null ? "—" : `${Math.round(v)}${valueSuffix}`;
        return `<div class="trend-tooltip-row"><span class="trend-tooltip-key" style="background:var(${s.colorVar})"></span>${s.label}: <b>${val}</b></div>`;
      })
      .join("");
    tooltip.innerHTML = `<div class="trend-tooltip-date">${fullDate(b.date)}</div>${rows}`;
    tooltip.hidden = false;

    const wrapRect = wrap.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const relX = svgRect.left - wrapRect.left + (x / W) * svgRect.width;
    tooltip.style.left = `${Math.min(Math.max(relX, 60), wrapRect.width - 60)}px`;
  }

  overlay.addEventListener("pointermove", (e) => show(e.clientX));
  overlay.addEventListener("pointerleave", () => {
    crosshair.hidden = true;
    tooltip.hidden = true;
  });
}

const KCAL_SERIES = [{ key: "kcal", label: "Calories", colorVar: "--accent" }];
const MACRO_PCT_SERIES = [
  { key: "protein_pct", label: "Protein", colorVar: "--series-protein" },
  { key: "carbs_pct", label: "Carbs", colorVar: "--series-carbs" },
  { key: "fat_pct", label: "Fat", colorVar: "--series-fat" },
];
const WEIGHT_SERIES = [{ key: "weight_kg", label: "Weight", colorVar: "--accent" }];

// Per-day calorie-weighted macro percentages, matching the donut's own math
// (macro-energy-sum denominator, not logged kcal) — the stack always sums to
// exactly 100% on any day with macro energy logged, 0% (an empty band) on a
// day with none.
function addMacroPercents(buckets) {
  for (const b of buckets) {
    const proteinKcal = (b.protein_g || 0) * KCAL_PER_G.protein;
    const carbsKcal = (b.carbs_g || 0) * KCAL_PER_G.carbs;
    const fatKcal = (b.fat_g || 0) * KCAL_PER_G.fat;
    const macroKcal = proteinKcal + carbsKcal + fatKcal;
    b.protein_pct = macroKcal > 0 ? (proteinKcal / macroKcal) * 100 : 0;
    b.carbs_pct = macroKcal > 0 ? (carbsKcal / macroKcal) * 100 : 0;
    b.fat_pct = macroKcal > 0 ? (fatKcal / macroKcal) * 100 : 0;
  }
}

export async function renderTrends(container, days, view) {
  container.innerHTML = `<div class="no-entries">Loading…</div>`;
  const end = startOfDay(new Date());
  end.setDate(end.getDate() + 1);
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const [entries, weightRows] = await Promise.all([
    getEntriesForRange(start, end),
    getWeightForRange(start, end),
  ]);
  const buckets = aggregateByDay(entries, weightRows, start, days);
  const plotW = W - MARGIN.left - MARGIN.right;
  const plotH = H - MARGIN.top - MARGIN.bottom;

  let bodyHtml;
  let tooltipSeries;
  let valueSuffix;

  if (view === "weight") {
    const weights = buckets.map((b) => b.weight_kg).filter((v) => v != null);
    if (weights.length === 0) {
      container.innerHTML = `<div class="no-entries">No weight logged in this range.</div>`;
      return;
    }
    const { minV, maxV } = axisRange(weights, { zeroAnchored: false });
    const marks = buildLineMarks(buckets, WEIGHT_SERIES, plotW, plotH, minV, maxV, " kg");
    bodyHtml = buildChartShell({ buckets, minV, maxV, marksSvg: marks, showLegend: false, legendSeries: [] });
    tooltipSeries = WEIGHT_SERIES;
    valueSuffix = " kg";
  } else if (view === "macros") {
    addMacroPercents(buckets);
    const marks = buildStackedAreaMarks(buckets, MACRO_PCT_SERIES, plotW, plotH, 100, "%");
    bodyHtml = buildChartShell({ buckets, minV: 0, maxV: 100, marksSvg: marks, showLegend: true, legendSeries: MACRO_PCT_SERIES });
    tooltipSeries = MACRO_PCT_SERIES;
    valueSuffix = "%";
  } else {
    const { maxV } = axisRange(buckets.map((b) => b.kcal), { zeroAnchored: true });
    const marks = buildLineMarks(buckets, KCAL_SERIES, plotW, plotH, 0, maxV, " kcal");
    bodyHtml = buildChartShell({ buckets, minV: 0, maxV, marksSvg: marks, showLegend: false, legendSeries: [] });
    tooltipSeries = KCAL_SERIES;
    valueSuffix = " kcal";
  }

  container.innerHTML = bodyHtml;
  wireCrosshair(container.querySelector(".trend-chart-wrap"), buckets, tooltipSeries, valueSuffix);
}
