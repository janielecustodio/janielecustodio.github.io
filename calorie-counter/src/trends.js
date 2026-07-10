import { getEntriesForRange } from "./log.js";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Buckets entries into one totals object per day across [start, start+days),
// including zero-entry days so gaps in logging show as zero rather than
// being skipped and silently compressing the x-axis.
function aggregateByDay(entries, start, days) {
  const buckets = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    buckets.push({ date, kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 });
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

const W = 400;
const H_KCAL = 180;
const H_MACRO = 190;
// Right margin is wide enough to fit a 5-char end-value label
// ("1,800") without it clipping past the SVG's viewBox edge (SVG clips
// anything outside the viewBox by default).
const MARGIN = { top: 12, right: 44, bottom: 24, left: 40 };

function xAt(i, n, plotW) {
  return MARGIN.left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
}
function yAt(v, maxV, plotH) {
  return MARGIN.top + plotH - (maxV > 0 ? (v / maxV) * plotH : 0);
}

function shortDate(d, days) {
  return days > 14
    ? new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(d)
    : new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d);
}

// Builds one line chart (1+ series sharing an axis) as an SVG + a floating
// HTML tooltip that follows a shared crosshair — the reader aims at a date,
// not at a 2px line (see dataviz skill's interaction.md).
function buildChart({ buckets, series, height, showLegend, valueSuffix }) {
  const n = buckets.length;
  const plotW = W - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const maxV = niceMax(Math.max(...series.flatMap((s) => buckets.map((b) => b[s.key])), 1));

  const gridCount = 4;
  const gridlines = Array.from({ length: gridCount + 1 }, (_, i) => {
    const v = (maxV / gridCount) * i;
    const y = yAt(v, maxV, plotH);
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
      return `<text class="trend-axis-label" x="${x}" y="${height - 6}" text-anchor="middle">${shortDate(b.date, n)}</text>`;
    })
    .join("");

  const lines = series
    .map((s) => {
      const points = buckets.map((b, i) => `${xAt(i, n, plotW)},${yAt(b[s.key], maxV, plotH)}`).join(" ");
      const dots = buckets
        .map((b, i) => {
          const x = xAt(i, n, plotW);
          const y = yAt(b[s.key], maxV, plotH);
          return `<circle class="trend-dot" data-series="${s.key}" cx="${x}" cy="${y}" r="4" style="fill:var(${s.colorVar})"><title>${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(b.date)} · ${s.label}: ${Math.round(b[s.key])}${valueSuffix}</title></circle>`;
        })
        .join("");
      const endLabel =
        series.length === 1
          ? `<text class="trend-end-label" x="${xAt(n - 1, n, plotW) + 6}" y="${yAt(buckets[n - 1][s.key], maxV, plotH)}" dominant-baseline="middle">${Math.round(buckets[n - 1][s.key]).toLocaleString()}</text>`
          : "";
      return `<polyline class="trend-line" points="${points}" style="stroke:var(${s.colorVar})"></polyline>${dots}${endLabel}`;
    })
    .join("");

  const legend = showLegend
    ? `<div class="donut-legend trend-legend">${series
        .map(
          (s) => `<div class="legend-row"><span class="legend-swatch" style="background:var(${s.colorVar})"></span><span class="legend-label">${s.label}</span></div>`
        )
        .join("")}</div>`
    : "";

  return `
    <div class="trend-chart-wrap">
      <svg class="trend-svg" viewBox="0 0 ${W} ${height}" data-plot-left="${MARGIN.left}" data-plot-width="${plotW}" data-n="${n}">
        ${gridlines}
        ${lines}
        ${xLabels}
        <line class="trend-crosshair" x1="0" y1="${MARGIN.top}" x2="0" y2="${height - MARGIN.bottom}" hidden></line>
        <rect class="trend-overlay" x="${MARGIN.left}" y="0" width="${plotW}" height="${height}"></rect>
      </svg>
      <div class="trend-tooltip" hidden></div>
    </div>
    ${legend}
  `;
}

function wireCrosshair(wrap, buckets, series, valueSuffix) {
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

  function show(clientX, clientY) {
    const i = nearestIndex(clientX);
    const x = xAt(i, n, plotWidth);
    crosshair.setAttribute("x1", x);
    crosshair.setAttribute("x2", x);
    crosshair.hidden = false;

    const b = buckets[i];
    const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(b.date);
    const rows = series
      .map((s) => `<div class="trend-tooltip-row"><span class="trend-tooltip-key" style="background:var(${s.colorVar})"></span>${s.label}: <b>${Math.round(b[s.key])}${valueSuffix}</b></div>`)
      .join("");
    tooltip.innerHTML = `<div class="trend-tooltip-date">${dateLabel}</div>${rows}`;
    tooltip.hidden = false;

    const wrapRect = wrap.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const relX = (svgRect.left - wrapRect.left) + (x / W) * svgRect.width;
    tooltip.style.left = `${Math.min(Math.max(relX, 60), wrapRect.width - 60)}px`;
  }

  overlay.addEventListener("pointermove", (e) => show(e.clientX, e.clientY));
  overlay.addEventListener("pointerleave", () => {
    crosshair.hidden = true;
    tooltip.hidden = true;
  });
}

export async function renderTrends(container, days) {
  container.innerHTML = `<div class="no-entries">Loading…</div>`;
  const end = startOfDay(new Date());
  end.setDate(end.getDate() + 1);
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const entries = await getEntriesForRange(start, end);
  const buckets = aggregateByDay(entries, start, days);

  const kcalSeries = [{ key: "kcal", label: "Calories", colorVar: "--accent" }];
  const macroSeries = [
    { key: "protein_g", label: "Protein", colorVar: "--series-protein" },
    { key: "carbs_g", label: "Carbs", colorVar: "--series-carbs" },
    { key: "fat_g", label: "Fat", colorVar: "--series-fat" },
  ];

  container.innerHTML = `
    <section class="section">
      <div class="section-title">Daily Calories</div>
      ${buildChart({ buckets, series: kcalSeries, height: H_KCAL, showLegend: false, valueSuffix: " kcal" })}
    </section>
    <section class="section">
      <div class="section-title">Macros</div>
      ${buildChart({ buckets, series: macroSeries, height: H_MACRO, showLegend: true, valueSuffix: "g" })}
    </section>
  `;

  const wraps = container.querySelectorAll(".trend-chart-wrap");
  wireCrosshair(wraps[0], buckets, kcalSeries, " kcal");
  wireCrosshair(wraps[1], buckets, macroSeries, "g");
}
