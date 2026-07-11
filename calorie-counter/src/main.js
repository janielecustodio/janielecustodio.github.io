import { isConfigured } from "./supabaseClient.js";
import { onAuthChange, signIn, signUp, signOut } from "./auth.js";
import { searchAll } from "./foodSearch.js";
import { startScan, barcodeScanningSupported } from "./barcode.js";
import { lookupBarcode } from "./sources/off.js";
import { fetchUsdaDetail } from "./sources/usda.js";
import {
  addEntry,
  updateEntry,
  deleteEntry,
  getEntriesForDate,
  getFrequentFoodsForMeal,
  copyDay,
  saveRecipe,
} from "./log.js";
import { computeSummary, KCAL_PER_G } from "./summary.js";
import { MEAL_TYPES, inferMealType } from "./mealTypes.js";
import { renderTrends } from "./trends.js";
import { saveWeight, getWeightForDate } from "./bodyLog.js";
import { getTargets, saveTargets, clearTargets } from "./targets.js";

if (!isConfigured) {
  document.getElementById("config-warning").hidden = false;
}

// Supabase errors don't always carry a plain string `.message` (e.g. a raw
// network failure, or a malformed response) — fall back to a friendly
// message instead of ever rendering "[object Object]" or "{}".
function errMessage(err, fallback) {
  return err && typeof err.message === "string" && err.message ? err.message : fallback;
}

// ── Auth: email + password ──
let authMode = "signin";
const authTitle = document.getElementById("auth-title");
const authSubmit = document.getElementById("auth-submit");
const authToggleText = document.getElementById("auth-toggle-text");
const authToggleLink = document.getElementById("auth-toggle-link");
const authError = document.getElementById("auth-error");

function setAuthMode(mode) {
  authMode = mode;
  authError.hidden = true;
  if (mode === "signin") {
    authTitle.textContent = "Sign in";
    authSubmit.textContent = "Sign in";
    authToggleText.textContent = "Need an account?";
    authToggleLink.textContent = "Sign up";
  } else {
    authTitle.textContent = "Create account";
    authSubmit.textContent = "Sign up";
    authToggleText.textContent = "Already have an account?";
    authToggleLink.textContent = "Sign in";
  }
}
authToggleLink.addEventListener("click", () =>
  setAuthMode(authMode === "signin" ? "signup" : "signin")
);

document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  authError.hidden = true;
  try {
    if (authMode === "signin") await signIn(email, password);
    else await signUp(email, password);
  } catch (err) {
    authError.textContent = errMessage(err, "Something went wrong.");
    authError.hidden = false;
  }
});

document.getElementById("signout-btn").addEventListener("click", () => signOut());

// ── Date navigation ──
let currentDate = startOfDay(new Date());
let currentTargets = null;

async function loadTargets() {
  currentTargets = await getTargets();
}
const dateLabel = document.getElementById("date-label");
const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function renderDateLabel() {
  const today = startOfDay(new Date());
  dateLabel.textContent =
    currentDate.getTime() === today.getTime()
      ? `Today · ${dateFmt.format(currentDate)}`
      : dateFmt.format(currentDate);
}

document.getElementById("date-prev").addEventListener("click", () => {
  currentDate.setDate(currentDate.getDate() - 1);
  clearAddTarget();
  refresh();
});
document.getElementById("date-next").addEventListener("click", () => {
  currentDate.setDate(currentDate.getDate() + 1);
  clearAddTarget();
  refresh();
});
document.getElementById("date-today").addEventListener("click", () => {
  currentDate = startOfDay(new Date());
  clearAddTarget();
  refresh();
});

// ── Auth-gated app boot ──
onAuthChange((session) => {
  const authed = !!session;
  document.getElementById("auth-gate").hidden = authed;
  document.getElementById("app").hidden = !authed;
  document.getElementById("date-nav").hidden = !authed;
  document.getElementById("signout-btn").hidden = !authed;
  document.getElementById("trends-toggle-btn").hidden = !authed;
  document.getElementById("targets-toggle-btn").hidden = !authed;
  if (authed) {
    loadTargets().then(refresh);
  } else {
    document.getElementById("auth-form").reset();
    clearAddTarget();
    showTodayView();
  }
});

async function refresh() {
  renderDateLabel();
  const entries = await getEntriesForDate(currentDate);
  renderSummary(entries);
  renderLog(entries);
  refreshBodyLog();
}

// ── Today / Trends view switch ──
const trendsView = document.getElementById("trends-view");
const trendsBody = document.getElementById("trends-body");
let trendsRangeDays = 7;
let trendsCurrentView = "calories";

// Only ever reachable while authenticated (trends-toggle-btn is hidden
// otherwise) — this must NOT touch #app/#date-nav's visibility itself.
// It's also called from the sign-out path below just to clear a
// still-open trends view; if it unhid #app/#date-nav there, it would
// undo the auth handler's own hiding of them one line earlier.
function showTodayView() {
  trendsView.hidden = true;
}

function showTrendsView() {
  document.getElementById("app").hidden = true;
  document.getElementById("date-nav").hidden = true;
  trendsView.hidden = false;
  renderTrends(trendsBody, trendsRangeDays, trendsCurrentView);
}

document.getElementById("trends-toggle-btn").addEventListener("click", showTrendsView);
document.getElementById("trends-back-btn").addEventListener("click", () => {
  showTodayView();
  document.getElementById("app").hidden = false;
  document.getElementById("date-nav").hidden = false;
  refresh();
});

document.getElementById("trends-range-buttons").addEventListener("click", (e) => {
  const btn = e.target.closest(".range-btn");
  if (!btn) return;
  trendsRangeDays = Number(btn.dataset.days);
  document.querySelectorAll(".range-btn").forEach((b) => b.classList.toggle("active", b === btn));
  renderTrends(trendsBody, trendsRangeDays, trendsCurrentView);
});

document.getElementById("trends-view-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".view-tab");
  if (!btn) return;
  trendsCurrentView = btn.dataset.view;
  document.querySelectorAll(".view-tab").forEach((b) => b.classList.toggle("active", b === btn));
  renderTrends(trendsBody, trendsRangeDays, trendsCurrentView);
});

// ── Summary (donut) ──
// r/gap are the donut's SVG geometry — see index.html .donut-svg (viewBox 0 0 140 140).
const DONUT_R = 60;
const DONUT_C = 2 * Math.PI * DONUT_R;
const DONUT_GAP_PX = 3;

// Builds stroke-dasharray/dashoffset for each macro's arc. Percentages can
// sum to slightly more/less than 100 (macro-derived kcal vs. logged kcal
// aren't always identical) — arcs are normalized to always tile exactly
// 360° while the legend still shows the true, un-normalized percentage.
function buildDonutSegments(macros) {
  const sum = macros.reduce((acc, m) => acc + Math.max(m.pct, 0), 0);
  let offset = 0;
  return macros.map((m) => {
    const frac = sum > 0 ? Math.max(m.pct, 0) / sum : 0;
    const fullLen = frac * DONUT_C;
    const len = fullLen > 0 ? Math.max(fullLen - DONUT_GAP_PX, 0.001) : 0;
    const seg = { ...m, dasharray: `${len} ${DONUT_C - len}`, dashoffset: -offset };
    offset += fullLen;
    return seg;
  });
}

const MICRO_LABELS = {
  sodium_mg: { label: "Sodium", unit: "mg" },
  sugars_g: { label: "Sugars", unit: "g" },
  added_sugars_g: { label: "Added sugars", unit: "g" },
  saturated_fat_g: { label: "Saturated fat", unit: "g" },
  potassium_mg: { label: "Potassium", unit: "mg" },
  calcium_mg: { label: "Calcium", unit: "mg" },
  iron_mg: { label: "Iron", unit: "mg" },
  vitamin_c_mg: { label: "Vitamin C", unit: "mg" },
};

function renderMicros(micros) {
  const rows = Object.entries(MICRO_LABELS)
    .filter(([key]) => typeof micros[key] === "number")
    .map(
      ([key, { label, unit }]) => `
      <div class="micro-row">
        <span class="micro-label">${label}</span>
        <span class="micro-val">${micros[key].toFixed(1)} ${unit}</span>
      </div>`
    )
    .join("");
  if (!rows) return "";
  return `
    <details class="micros-details">
      <summary>Micronutrients</summary>
      <div class="micros-grid">${rows}</div>
    </details>
  `;
}

function renderSummary(entries) {
  const s = computeSummary(entries);
  const body = document.getElementById("summary-body");
  if (entries.length === 0 && !currentTargets) {
    body.innerHTML = `<div class="no-entries">No entries logged for this day yet.</div>`;
    return;
  }

  const macros = [
    { key: "protein", label: "Protein", grams: s.protein_g, pct: s.pctProtein, colorVar: "--series-protein" },
    { key: "carbs", label: "Carbs", grams: s.carbs_g, pct: s.pctCarbs, colorVar: "--series-carbs" },
    { key: "fat", label: "Fat", grams: s.fat_g, pct: s.pctFat, colorVar: "--series-fat" },
  ];
  const segments = buildDonutSegments(macros);

  const arcs = segments
    .map(
      (seg) => `<circle class="donut-seg" cx="70" cy="70" r="${DONUT_R}"
        style="stroke:var(${seg.colorVar})"
        stroke-dasharray="${seg.dasharray}" stroke-dashoffset="${seg.dashoffset}"></circle>`
    )
    .join("");

  const legend = macros
    .map(
      (m) => `
      <div class="legend-row">
        <span class="legend-swatch" style="background:var(${m.colorVar})"></span>
        <span class="legend-label">${m.label}</span>
        <span class="legend-val">${m.grams.toFixed(1)} g · ${m.pct.toFixed(0)}%</span>
      </div>`
    )
    .join("");

  // The kcal-vs-target comparison is the one number worth making prominent —
  // macro targets are already set via the Targets modal and don't need to be
  // relitigated here too, that just crowded the legend with numbers to parse.
  const targetKcal = currentTargets?.kcal;
  const remaining = targetKcal ? Math.round(targetKcal - s.kcal) : null;
  const remainingHtml =
    remaining == null
      ? ""
      : remaining >= 0
      ? `<div class="donut-center-remaining">${remaining.toLocaleString()} left</div>`
      : `<div class="donut-center-remaining over">${Math.abs(remaining).toLocaleString()} over</div>`;
  const centerKcalClass = [
    "donut-center-kcal",
    targetKcal ? "has-target" : "",
    targetKcal && s.kcal > targetKcal ? "over-target" : "",
  ]
    .filter(Boolean)
    .join(" ");

  body.innerHTML = `
    <div class="summary-viz">
      <div class="donut-wrap">
        <svg class="donut-svg" viewBox="0 0 140 140">
          <circle class="donut-track" cx="70" cy="70" r="${DONUT_R}"></circle>
          ${arcs}
        </svg>
        <div class="donut-center">
          <div class="${centerKcalClass}">${Math.round(s.kcal).toLocaleString()}</div>
          <div class="donut-center-label">${targetKcal ? `of ${Math.round(targetKcal).toLocaleString()} kcal` : "kcal"}</div>
          ${remainingHtml}
        </div>
      </div>
      <div class="donut-legend">${legend}</div>
    </div>
    ${renderMicros(s.micros)}
  `;
}

// ── Log list ──
const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

// All six meal sections always render, even empty — each with its own
// "+ Add" button that pins where the next searched/scanned food lands
// (see setAddTarget below), instead of guessing from the current time.
function renderLog(entries) {
  const list = document.getElementById("log-list");

  // Entries logged before meal_type existed have none — bucket those by
  // time of day so every entry always lands in one of the fixed groups.
  const groups = new Map(MEAL_TYPES.map((m) => [m.id, []]));
  for (const e of entries) {
    const mealType = e.meal_type || inferMealType(new Date(e.logged_at));
    (groups.get(mealType) || groups.get("evening_snack")).push(e);
  }

  list.innerHTML = "";
  for (const { id, label } of MEAL_TYPES) {
    const groupEntries = groups.get(id);
    const groupKcal = groupEntries.reduce((sum, e) => sum + (Number(e.kcal) || 0), 0);

    const group = document.createElement("div");
    group.className = "log-group";
    const kcalHtml =
      groupEntries.length > 0
        ? `<span class="log-group-kcal">· ${Math.round(groupKcal)} kcal</span>`
        : "";
    // One time per meal, not per food — the earliest entry logged in the
    // group stands in for "when this meal happened."
    const timeHtml =
      groupEntries.length > 0
        ? `<span class="log-group-kcal">· ${timeFmt.format(
            new Date(Math.min(...groupEntries.map((e) => new Date(e.logged_at).getTime())))
          )}</span>`
        : "";
    group.innerHTML = `
      <div class="log-group-header">
        <span>${label} ${timeHtml} ${kcalHtml}</span>
        <span class="log-group-actions">
          <button class="log-group-copy" type="button" title="Copy from yesterday">⧉</button>
          <button class="log-group-add" type="button">+ Add</button>
        </span>
      </div>
    `;
    group.querySelector(".log-group-add").addEventListener("click", () => setAddTarget(id));
    group.querySelector(".log-group-copy").addEventListener("click", () => copyMealFromYesterday(id, label));

    for (const e of groupEntries) {
      const wrap = document.createElement("div");
      wrap.className = "log-item-wrap";
      const row = document.createElement("div");
      row.className = "log-item";
      row.innerHTML = `
        <div class="log-body">
          <div class="log-name">${escapeHtml(e.foods?.name || "Food")}</div>
          <div class="log-meta">${escapeHtml(
            e.quantity_label || `${e.quantity_g} g`
          )} · P ${e.protein_g.toFixed(0)} · C ${e.carbs_g.toFixed(
        0
      )} · F ${e.fat_g.toFixed(0)}</div>
        </div>
        <div class="log-kcal">${Math.round(e.kcal)} kcal</div>
        <button class="log-repeat" aria-label="Log again today" title="Log again today">↻</button>
      `;
      wrap.innerHTML = `<div class="log-swipe-bg">Delete</div>`;
      wrap.appendChild(row);
      row.querySelector(".log-repeat").addEventListener("click", async (ev) => {
        ev.stopPropagation();
        await logAgain(e);
      });
      wireSwipeToDelete(wrap, row, async () => {
        await deleteEntry(e.id);
        refresh();
      });
      row.addEventListener("click", () => {
        if (row.dataset.suppressClick === "1") return;
        if (wrap.classList.contains("swipe-open")) {
          closeSwipeRow(wrap, row);
          return;
        }
        openEditModal(e);
      });
      wrap.querySelector(".log-swipe-bg").addEventListener("click", async () => {
        await deleteEntry(e.id);
        refresh();
      });
      group.appendChild(wrap);
    }
    list.appendChild(group);
  }
}

// Swipe-to-delete: dragging a log row left reveals a "Delete" strip behind
// it (tapping the strip deletes); dragging far enough past it deletes
// immediately without needing a second tap. Only one row stays open at a
// time — opening another closes it, matching the standard mobile pattern.
const SWIPE_OPEN_PX = 88;
const SWIPE_AUTO_DELETE_PX = 160;
let openSwipeWrap = null;

function closeSwipeRow(wrap, row) {
  wrap.classList.remove("swipe-open");
  row.style.transform = "";
  if (openSwipeWrap === wrap) openSwipeWrap = null;
}

function wireSwipeToDelete(wrap, row, onDelete) {
  let startX = 0;
  let startY = 0;
  let baseX = 0;
  let dragging = false;
  let decided = false;

  row.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest("button")) return;
    startX = ev.clientX;
    startY = ev.clientY;
    baseX = wrap.classList.contains("swipe-open") ? -SWIPE_OPEN_PX : 0;
    decided = false;
    dragging = false;
  });

  row.addEventListener("pointermove", (ev) => {
    if (!startX && !startY) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      decided = true;
      dragging = Math.abs(dx) > Math.abs(dy);
      if (dragging) {
        row.classList.add("swipe-dragging");
        row.setPointerCapture(ev.pointerId);
        if (openSwipeWrap && openSwipeWrap !== wrap) {
          closeSwipeRow(openSwipeWrap, openSwipeWrap.querySelector(".log-item"));
        }
      }
    }
    if (!dragging) return;
    ev.preventDefault();
    const x = Math.min(0, Math.max(baseX + dx, -SWIPE_AUTO_DELETE_PX));
    row.style.transform = `translateX(${x}px)`;
  });

  async function finishDrag() {
    if (!dragging) {
      startX = 0;
      startY = 0;
      return;
    }
    row.classList.remove("swipe-dragging");
    row.dataset.suppressClick = "1";
    setTimeout(() => delete row.dataset.suppressClick, 0);
    const matrix = new DOMMatrixReadOnly(getComputedStyle(row).transform);
    const currentX = matrix.m41;
    if (currentX <= -SWIPE_AUTO_DELETE_PX + 8) {
      await onDelete();
    } else if (currentX <= -SWIPE_OPEN_PX / 2) {
      wrap.classList.add("swipe-open");
      row.style.transform = `translateX(${-SWIPE_OPEN_PX}px)`;
      openSwipeWrap = wrap;
    } else {
      closeSwipeRow(wrap, row);
    }
    startX = 0;
    startY = 0;
    dragging = false;
    decided = false;
  }

  row.addEventListener("pointerup", finishDrag);
  row.addEventListener("pointercancel", () => {
    row.classList.remove("swipe-dragging");
    if (!wrap.classList.contains("swipe-open")) row.style.transform = "";
    startX = 0;
    startY = 0;
    dragging = false;
    decided = false;
  });
}

// Reconstructs a food-shaped object (per-100g macros) from a food_logs row
// so it can flow through the same openQtyModal/addEntry path used for a
// fresh search result — shared by edit, log-again, and the frequent-food
// quick-picks. Prefers the live `foods` join (fresher if re-synced since);
// falls back to back-computing from the entry's own snapshot if that join
// is missing for some reason.
function foodFromEntry(entry) {
  const f = entry.foods || {};
  const per100 = (snapshotVal, fallback100) => {
    if (typeof fallback100 === "number") return fallback100;
    return entry.quantity_g > 0 ? (snapshotVal / entry.quantity_g) * 100 : 0;
  };
  // f.micros (from the foods join) is already per-100g, same as kcal_100g
  // etc. If that join is missing, back-compute per-100g from the entry's
  // own scaled snapshot instead of using the scaled values directly.
  let micros = f.micros || {};
  if (Object.keys(micros).length === 0 && entry.micros && entry.quantity_g > 0) {
    micros = {};
    for (const [k, v] of Object.entries(entry.micros)) {
      if (typeof v === "number") micros[k] = (v / entry.quantity_g) * 100;
    }
  }
  return {
    source: f.source,
    source_id: f.source_id,
    name: f.name || "Food",
    kcal_100g: per100(entry.kcal, f.kcal_100g),
    protein_100g: per100(entry.protein_g, f.protein_100g),
    fat_100g: per100(entry.fat_g, f.fat_100g),
    carbs_100g: per100(entry.carbs_g, f.carbs_100g),
    fiber_100g: per100(entry.fiber_g, f.fiber_100g) || 0,
    micros,
    portions: [],
  };
}

async function openEditModal(entry) {
  editingEntryId = entry.id;
  await openQtyModal(foodFromEntry(entry), {
    amount: entry.quantity_g,
    unitId: "grams",
    time: new Date(entry.logged_at),
    mealType: entry.meal_type || inferMealType(new Date(entry.logged_at)),
  });
}

async function logAgain(entry) {
  const food = foodFromEntry(entry);
  await addEntry(
    food,
    entry.quantity_g,
    new Date(),
    entry.meal_type || inferMealType(new Date()),
    entry.quantity_label
  );
  refresh();
}

// ── Add-food target (pinned meal) ──
let pinnedMealType = null;
const addTarget = document.getElementById("add-target");
const addTargetLabel = document.getElementById("add-target-label");
const frequentFoods = document.getElementById("frequent-foods");
const frequentMealLabel = document.getElementById("frequent-meal-label");
const frequentChips = document.getElementById("frequent-chips");

function setAddTarget(mealId) {
  pinnedMealType = mealId;
  addTargetLabel.textContent = MEAL_TYPES.find((m) => m.id === mealId)?.label || "";
  addTarget.hidden = false;
  renderFrequentFoods(mealId);
  openSearchModal();
}

function clearAddTarget() {
  pinnedMealType = null;
  addTarget.hidden = true;
  frequentFoods.hidden = true;
}

document.getElementById("add-target-clear").addEventListener("click", clearAddTarget);

// Quick-pick chips for the 5-6 most-logged foods in this meal, pre-filled
// with whatever quantity was used last time — skips search entirely for
// the rotation of things you eat most days.
async function renderFrequentFoods(mealId) {
  frequentMealLabel.textContent = MEAL_TYPES.find((m) => m.id === mealId)?.label || "";
  try {
    const rows = await getFrequentFoodsForMeal(mealId, 6);
    if (rows.length === 0) {
      frequentFoods.hidden = true;
      return;
    }
    frequentChips.innerHTML = "";
    for (const row of rows) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "frequent-chip";
      chip.textContent = row.foods?.name || "Food";
      chip.addEventListener("click", async () => {
        const now = new Date();
        const time = new Date(currentDate);
        time.setHours(now.getHours(), now.getMinutes(), 0, 0);
        await openQtyModal(foodFromEntry(row), {
          amount: row.quantity_g,
          unitId: "grams",
          time,
          mealType: mealId,
        });
      });
      frequentChips.appendChild(chip);
    }
    frequentFoods.hidden = false;
  } catch {
    frequentFoods.hidden = true;
  }
}

// ── Copy day / copy meal ──
function prevDate(d) {
  const x = new Date(d);
  x.setDate(x.getDate() - 1);
  return x;
}

document.getElementById("copy-day-btn").addEventListener("click", async () => {
  const from = prevDate(currentDate);
  const source = await getEntriesForDate(from);
  if (source.length === 0) {
    alert("Nothing logged yesterday to copy.");
    return;
  }
  if (!confirm(`Copy ${source.length} entr${source.length === 1 ? "y" : "ies"} from yesterday into today?`)) {
    return;
  }
  await copyDay(from, currentDate);
  refresh();
});

async function copyMealFromYesterday(mealId, mealLabel) {
  const from = prevDate(currentDate);
  const source = (await getEntriesForDate(from)).filter((e) => e.meal_type === mealId);
  if (source.length === 0) {
    alert(`Nothing logged for ${mealLabel} yesterday to copy.`);
    return;
  }
  if (!confirm(`Copy yesterday's ${mealLabel} (${source.length} item${source.length === 1 ? "" : "s"}) into today?`)) {
    return;
  }
  await copyDay(from, currentDate, mealId);
  refresh();
}

// ── Weight ──
const weightInput = document.getElementById("weight-input");
const weightSavedNote = document.getElementById("weight-saved-note");

async function refreshBodyLog() {
  const weight = await getWeightForDate(currentDate);
  weightInput.value = weight ? weight.kg : "";
  weightSavedNote.hidden = true;
}

document.getElementById("weight-save-btn").addEventListener("click", async () => {
  const kg = Number(weightInput.value);
  if (!kg || kg <= 0) return;
  await saveWeight(currentDate, kg);
  weightSavedNote.textContent = "Saved.";
  weightSavedNote.hidden = false;
});

// ── Targets/goals ──
// Macro targets are always stored as grams (no schema change for the %
// entry mode) — "% of calories" is purely a UI input convenience that
// converts to/from grams via the kcal target, using the same 4/4/9
// kcal-per-gram constants the summary donut's percentages already use.
const targetsModal = document.getElementById("targets-modal");
const targetKcalInput = document.getElementById("target-kcal");
const targetProteinInput = document.getElementById("target-protein");
const targetFatInput = document.getElementById("target-fat");
const targetCarbsInput = document.getElementById("target-carbs");
const targetsError = document.getElementById("targets-error");
const targetPctTotal = document.getElementById("target-pct-total");
const TARGET_MACRO_FIELDS = [
  { input: targetProteinInput, key: "protein", label: document.getElementById("target-protein-label") },
  { input: targetFatInput, key: "fat", label: document.getElementById("target-fat-label") },
  { input: targetCarbsInput, key: "carbs", label: document.getElementById("target-carbs-label") },
];
let targetMode = "pct";

// Percent entries are individually rounded (grams→% conversion, or just
// typing), so three independently-rounded values summing to exactly 100
// is unlikely even when they're "right" — tolerate a couple points of
// drift rather than rejecting harmless rounding noise.
const PCT_TOTAL_TOLERANCE = 2;
function pctFieldSum() {
  return TARGET_MACRO_FIELDS.reduce((sum, f) => sum + (Number(f.input.value) || 0), 0);
}

const TARGET_PLACEHOLDERS = {
  grams: { protein: "e.g. 150", fat: "e.g. 70", carbs: "e.g. 200" },
  pct: { protein: "e.g. 30", fat: "e.g. 25", carbs: "e.g. 45" },
};

function setTargetMode(mode) {
  targetMode = mode;
  document.querySelectorAll(".target-mode-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  for (const f of TARGET_MACRO_FIELDS) {
    f.label.textContent = `${f.label.textContent.replace(/\s*\(.*\)$/, "")} (${mode === "pct" ? "%" : "g"})`;
    f.input.placeholder = TARGET_PLACEHOLDERS[mode][f.key];
  }
  updateTargetHints();
}

function updateTargetHints() {
  const kcal = Number(targetKcalInput.value) || 0;
  let anySet = false;
  for (const f of TARGET_MACRO_FIELDS) {
    const val = Number(f.input.value) || 0;
    const hint = document.getElementById(`target-${f.key}-hint`);
    if (val > 0) anySet = true;
    if (targetMode === "grams") {
      const pct = kcal > 0 ? ((val * KCAL_PER_G[f.key]) / kcal) * 100 : 0;
      hint.textContent = kcal > 0 && val > 0 ? `≈ ${pct.toFixed(0)}% of calories` : "";
    } else {
      const grams = kcal > 0 ? ((val / 100) * kcal) / KCAL_PER_G[f.key] : 0;
      hint.textContent = kcal > 0 && val > 0 ? `≈ ${grams.toFixed(0)}g` : "";
    }
  }
  if (targetMode === "pct" && kcal <= 0) {
    document.getElementById("target-protein-hint").textContent = "Set calories first";
  }

  if (targetMode === "pct") {
    // % mode's percentages describe the whole calorie target, so they
    // need to total ~100 — grams mode has no such requirement (see the
    // save handler for the actual gate; this is just the live readout).
    if (kcal <= 0) {
      targetPctTotal.hidden = true;
    } else {
      const sum = pctFieldSum();
      const offBy100 = Math.abs(sum - 100) >= PCT_TOTAL_TOLERANCE;
      targetPctTotal.hidden = false;
      targetPctTotal.textContent = offBy100
        ? `${sum.toFixed(0)}% of calories allocated — should total 100%`
        : "100% of calories allocated";
      targetPctTotal.classList.toggle("over", offBy100);
    }
  } else if (kcal > 0 && anySet) {
    targetPctTotal.hidden = false;
    const sum = TARGET_MACRO_FIELDS.reduce((total, f) => {
      const val = Number(f.input.value) || 0;
      return total + ((val * KCAL_PER_G[f.key]) / kcal) * 100;
    }, 0);
    targetPctTotal.textContent = `${sum.toFixed(0)}% of calories allocated`;
    targetPctTotal.classList.toggle("over", sum > 100.5);
  } else {
    targetPctTotal.hidden = true;
  }
}

document.querySelectorAll(".target-mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const newMode = btn.dataset.mode;
    if (newMode === targetMode) return;
    const kcal = Number(targetKcalInput.value) || 0;
    for (const f of TARGET_MACRO_FIELDS) {
      const val = Number(f.input.value) || 0;
      if (val <= 0 || kcal <= 0) continue;
      f.input.value =
        newMode === "pct"
          ? Math.round(((val * KCAL_PER_G[f.key]) / kcal) * 100)
          : Math.round(((val / 100) * kcal) / KCAL_PER_G[f.key]);
    }
    setTargetMode(newMode);
  });
});

[targetKcalInput, targetProteinInput, targetFatInput, targetCarbsInput].forEach((el) =>
  el.addEventListener("input", updateTargetHints)
);

document.getElementById("targets-toggle-btn").addEventListener("click", () => {
  const kcal = currentTargets?.kcal ?? null;
  targetKcalInput.value = kcal ?? "";
  targetsError.hidden = true;

  // % of calories is always the default entry mode. If there's an
  // existing kcal target to convert saved gram values against, show
  // those as percentages; otherwise the fields just start blank (there's
  // nothing to convert either way).
  if (kcal) {
    const toPct = (grams, key) => (grams ? Math.round(((grams * KCAL_PER_G[key]) / kcal) * 100) : "");
    targetProteinInput.value = toPct(currentTargets?.protein_g, "protein");
    targetFatInput.value = toPct(currentTargets?.fat_g, "fat");
    targetCarbsInput.value = toPct(currentTargets?.carbs_g, "carbs");
  } else {
    targetProteinInput.value = "";
    targetFatInput.value = "";
    targetCarbsInput.value = "";
  }
  setTargetMode("pct");
  targetsModal.hidden = false;
});

document.getElementById("targets-cancel").addEventListener("click", () => {
  targetsModal.hidden = true;
});

document.getElementById("targets-save").addEventListener("click", async () => {
  const kcal = Number(targetKcalInput.value) || null;
  if (targetMode === "pct" && !kcal) {
    targetsError.textContent = "Set calories first — percentages need a calorie target to convert to grams.";
    targetsError.hidden = false;
    return;
  }
  if (targetMode === "pct") {
    const sum = pctFieldSum();
    if (Math.abs(sum - 100) >= PCT_TOTAL_TOLERANCE) {
      targetsError.textContent = `Protein/fat/carbs percentages should add up to 100% (currently ${sum.toFixed(0)}%).`;
      targetsError.hidden = false;
      return;
    }
  }
  targetsError.hidden = true;

  const gramsFor = (input, key) => {
    const val = Number(input.value) || 0;
    if (!val) return null;
    return targetMode === "grams" ? val : Math.round(((val / 100) * kcal) / KCAL_PER_G[key]);
  };

  await saveTargets({
    kcal,
    protein_g: gramsFor(targetProteinInput, "protein"),
    fat_g: gramsFor(targetFatInput, "fat"),
    carbs_g: gramsFor(targetCarbsInput, "carbs"),
  });
  await loadTargets();
  targetsModal.hidden = true;
  refresh();
});

document.getElementById("targets-clear").addEventListener("click", async () => {
  await clearTargets();
  currentTargets = null;
  targetsModal.hidden = true;
  refresh();
});

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

// ── Search ──
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const searchStatus = document.getElementById("search-status");
const searchModal = document.getElementById("search-modal");
let searchToken = 0;

// Opened either from a meal's "+ Add" (pins that meal — see setAddTarget)
// or the general "Search & Add Food" button (no pin, meal falls back to
// time-of-day inference same as before). Stays open across an add so a
// pinned meal can take several items in a row without reopening it —
// only the explicit Close button dismisses it.
function openSearchModal() {
  searchModal.hidden = false;
  searchInput.value = "";
  searchResults.innerHTML = "";
  searchStatus.hidden = true;
  searchInput.focus();
}

function closeSearchModal() {
  searchModal.hidden = true;
}

document.getElementById("add-food-trigger").addEventListener("click", () => openSearchModal());
document.getElementById("search-modal-close").addEventListener("click", closeSearchModal);

searchInput.addEventListener(
  "input",
  debounce(async () => {
    const query = searchInput.value.trim();
    searchResults.innerHTML = "";
    if (query.length < 2) {
      searchStatus.hidden = true;
      return;
    }
    const token = ++searchToken;
    searchStatus.hidden = false;
    searchStatus.textContent = "Searching…";
    let results;
    try {
      results = await searchAll(query);
    } catch (err) {
      if (token !== searchToken) return;
      searchStatus.textContent = "Search failed — try again.";
      return;
    }
    if (token !== searchToken) return;
    searchStatus.hidden = results.length > 0;
    searchStatus.textContent = "No results found.";
    renderResults(results);
  }, 350)
);

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function renderResults(results) {
  searchResults.innerHTML = "";
  for (const food of results) {
    // Recipes store per-serving macros in the same kcal_100g/etc fields
    // (a "1 serving" = 100g fiction, see recipes.js) — label them as such
    // rather than the misleading "per 100g" every other source uses.
    const perUnit = food.source === "recipe" ? "serving" : "100g";
    const item = document.createElement("div");
    item.className = "result-item";
    item.innerHTML = `
      <span class="tag">${food.source}</span>
      <div class="result-body">
        <div class="result-name">${escapeHtml(food.name)}${
      food.brand ? " · " + escapeHtml(food.brand) : ""
    }</div>
        <div class="result-meta">per ${perUnit} · P ${food.protein_100g.toFixed(
          0
        )} C ${food.carbs_100g.toFixed(0)} F ${food.fat_100g.toFixed(0)}</div>
      </div>
      <div class="result-kcal">${Math.round(food.kcal_100g)} kcal/${perUnit}</div>
    `;
    item.addEventListener("click", () => openQtyModal(food));
    searchResults.appendChild(item);
  }
}

// ── Manual quick-add ──
// Bypasses search entirely for one-off items with no good database match
// (a restaurant meal, a homemade dish) — the user types totals for what
// they're about to eat rather than per-100g values, so this stores the
// entry at quantity_g=100 with kcal_100g/etc set to those totals directly;
// the 100g "unit" is an implementation detail, never shown to the user.
const manualModal = document.getElementById("manual-modal");
const manualName = document.getElementById("manual-name");
const manualDesc = document.getElementById("manual-desc");
const manualKcal = document.getElementById("manual-kcal");
const manualProtein = document.getElementById("manual-protein");
const manualFat = document.getElementById("manual-fat");
const manualCarbs = document.getElementById("manual-carbs");
const manualTime = document.getElementById("manual-time");
const manualMeal = document.getElementById("manual-meal");
const manualError = document.getElementById("manual-error");
const manualConfirm = document.getElementById("manual-confirm");

manualMeal.innerHTML = MEAL_TYPES.map((m) => `<option value="${m.id}">${m.label}</option>`).join("");

document.getElementById("manual-add-link").addEventListener("click", () => {
  manualName.value = "";
  manualDesc.value = "";
  manualKcal.value = "";
  manualProtein.value = "0";
  manualFat.value = "0";
  manualCarbs.value = "0";
  manualError.hidden = true;
  const now = new Date();
  const defaultTime = new Date(currentDate);
  defaultTime.setHours(now.getHours(), now.getMinutes(), 0, 0);
  manualTime.value = toLocalInputValue(defaultTime);
  manualMeal.value = pinnedMealType || inferMealType(defaultTime);
  manualModal.hidden = false;
  manualName.focus();
});

document.getElementById("manual-cancel").addEventListener("click", () => {
  manualModal.hidden = true;
});

manualConfirm.addEventListener("click", async () => {
  const name = manualName.value.trim();
  const kcal = Number(manualKcal.value);
  const protein = Number(manualProtein.value) || 0;
  const fat = Number(manualFat.value) || 0;
  const carbs = Number(manualCarbs.value) || 0;

  if (!name) {
    manualError.textContent = "Name is required.";
    manualError.hidden = false;
    return;
  }
  if (!manualKcal.value || !Number.isFinite(kcal) || kcal < 0) {
    manualError.textContent = "Enter a valid calorie amount.";
    manualError.hidden = false;
    return;
  }
  manualError.hidden = true;

  const food = {
    source: "manual",
    source_id: crypto.randomUUID(),
    name,
    kcal_100g: kcal,
    protein_100g: protein,
    fat_100g: fat,
    carbs_100g: carbs,
    fiber_100g: 0,
  };
  const loggedAt = new Date(manualTime.value);
  await addEntry(food, 100, loggedAt, manualMeal.value, manualDesc.value.trim() || null);
  manualModal.hidden = true;
  refresh();
});

// ── Custom meals / recipes ──
// Combines several ingredients into one named `foods` row (source =
// 'recipe') that then shows up in normal search like any other food —
// this modal only builds and saves it, it doesn't log it directly.
const recipeModal = document.getElementById("recipe-modal");
const recipeName = document.getElementById("recipe-name");
const recipeServings = document.getElementById("recipe-servings");
const recipeIngredientSearch = document.getElementById("recipe-ingredient-search");
const recipeIngredientResults = document.getElementById("recipe-ingredient-results");
const recipeIngredientList = document.getElementById("recipe-ingredient-list");
const recipeError = document.getElementById("recipe-error");
const recipePreviewKcal = document.getElementById("recipe-preview-kcal");
const recipePreviewProtein = document.getElementById("recipe-preview-protein");
const recipePreviewFat = document.getElementById("recipe-preview-fat");
const recipePreviewCarbs = document.getElementById("recipe-preview-carbs");
const recipeSave = document.getElementById("recipe-save");
let recipeIngredients = [];

function renderIngredientList() {
  if (recipeIngredients.length === 0) {
    recipeIngredientList.innerHTML = `<div class="recipe-empty">No ingredients added yet.</div>`;
    return;
  }
  recipeIngredientList.innerHTML = recipeIngredients
    .map((ing, idx) => {
      const kcal = Math.round((ing.food.kcal_100g || 0) * (ing.grams / 100));
      return `
      <div class="recipe-ing-row" data-idx="${idx}">
        <span class="recipe-ing-name">${escapeHtml(ing.food.name)}</span>
        <input type="number" class="recipe-ing-grams" min="0.1" step="any" value="${ing.grams}">
        <span class="recipe-ing-kcal">${kcal} kcal</span>
        <button class="recipe-ing-remove" type="button" aria-label="Remove ingredient">✕</button>
      </div>`;
    })
    .join("");
}

function updateRecipePreview() {
  const servings = Math.max(Number(recipeServings.value) || 1, 0.1);
  const totals = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  for (const ing of recipeIngredients) {
    const mult = ing.grams / 100;
    totals.kcal += (ing.food.kcal_100g || 0) * mult;
    totals.protein += (ing.food.protein_100g || 0) * mult;
    totals.fat += (ing.food.fat_100g || 0) * mult;
    totals.carbs += (ing.food.carbs_100g || 0) * mult;
  }
  recipePreviewKcal.textContent = `${Math.round(totals.kcal / servings)} kcal / serving`;
  recipePreviewProtein.textContent = `${(totals.protein / servings).toFixed(0)}g`;
  recipePreviewFat.textContent = `${(totals.fat / servings).toFixed(0)}g`;
  recipePreviewCarbs.textContent = `${(totals.carbs / servings).toFixed(0)}g`;
}

document.getElementById("create-recipe-link").addEventListener("click", () => {
  recipeIngredients = [];
  recipeName.value = "";
  recipeServings.value = "1";
  recipeIngredientSearch.value = "";
  recipeIngredientResults.innerHTML = "";
  recipeError.hidden = true;
  renderIngredientList();
  updateRecipePreview();
  recipeModal.hidden = false;
  recipeName.focus();
});

document.getElementById("recipe-cancel").addEventListener("click", () => {
  recipeModal.hidden = true;
});

recipeIngredientSearch.addEventListener(
  "input",
  debounce(async () => {
    const query = recipeIngredientSearch.value.trim();
    recipeIngredientResults.innerHTML = "";
    if (query.length < 2) return;
    let results;
    try {
      results = await searchAll(query);
    } catch {
      return;
    }
    recipeIngredientResults.innerHTML = results
      .map((food, idx) => {
        const perUnit = food.source === "recipe" ? "serving" : "100g";
        return `
      <div class="recipe-result-item" data-idx="${idx}">
        <span class="tag">${food.source}</span>
        <span>${escapeHtml(food.name)}</span>
        <span class="recipe-result-kcal">${Math.round(food.kcal_100g)} kcal/${perUnit}</span>
      </div>`;
      })
      .join("");
    recipeIngredientResults.querySelectorAll(".recipe-result-item").forEach((el, idx) => {
      el.addEventListener("click", () => {
        recipeIngredients.push({ food: results[idx], grams: 100 });
        recipeIngredientSearch.value = "";
        recipeIngredientResults.innerHTML = "";
        renderIngredientList();
        updateRecipePreview();
      });
    });
  }, 350)
);

recipeIngredientList.addEventListener("input", (e) => {
  if (!e.target.classList.contains("recipe-ing-grams")) return;
  const idx = Number(e.target.closest(".recipe-ing-row").dataset.idx);
  recipeIngredients[idx].grams = Number(e.target.value) || 0;
  const kcalEl = e.target.closest(".recipe-ing-row").querySelector(".recipe-ing-kcal");
  kcalEl.textContent = `${Math.round(
    (recipeIngredients[idx].food.kcal_100g || 0) * (recipeIngredients[idx].grams / 100)
  )} kcal`;
  updateRecipePreview();
});

recipeIngredientList.addEventListener("click", (e) => {
  if (!e.target.classList.contains("recipe-ing-remove")) return;
  const idx = Number(e.target.closest(".recipe-ing-row").dataset.idx);
  recipeIngredients.splice(idx, 1);
  renderIngredientList();
  updateRecipePreview();
});

recipeServings.addEventListener("input", updateRecipePreview);

recipeSave.addEventListener("click", async () => {
  const name = recipeName.value.trim();
  if (!name) {
    recipeError.textContent = "Name is required.";
    recipeError.hidden = false;
    return;
  }
  if (recipeIngredients.length === 0) {
    recipeError.textContent = "Add at least one ingredient.";
    recipeError.hidden = false;
    return;
  }
  recipeError.hidden = true;
  const servings = Math.max(Number(recipeServings.value) || 1, 0.1);
  const recipe = await saveRecipe(name, servings, recipeIngredients);
  recipeModal.hidden = true;
  openQtyModal(recipe);
});

// ── Quantity modal ──
const qtyModal = document.getElementById("qty-modal");
const qtyName = document.getElementById("qty-food-name");
const qtyAmount = document.getElementById("qty-amount");
const qtyUnit = document.getElementById("qty-unit");
const qtyGramsHint = document.getElementById("qty-grams-hint");
const qtyPreviewKcal = document.getElementById("qty-preview-kcal");
const qtyPreviewProtein = document.getElementById("qty-preview-protein");
const qtyPreviewFat = document.getElementById("qty-preview-fat");
const qtyPreviewCarbs = document.getElementById("qty-preview-carbs");
const qtyTime = document.getElementById("qty-time");
const qtyMeal = document.getElementById("qty-meal");
const qtyConfirm = document.getElementById("qty-confirm");
let pendingFood = null;
let editingEntryId = null;
let currentUnits = [{ id: "grams", label: "Grams", grams: 1 }];

qtyMeal.innerHTML = MEAL_TYPES.map((m) => `<option value="${m.id}">${m.label}</option>`).join("");

function toLocalInputValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// grams-per-unit for whichever option is currently selected
function selectedUnitGrams() {
  const unit = currentUnits.find((u) => u.id === qtyUnit.value);
  return unit ? unit.grams : 1;
}

function updateGramsHint() {
  const amount = Number(qtyAmount.value) || 0;
  const totalGrams = amount * selectedUnitGrams();
  qtyGramsHint.textContent = qtyUnit.value === "grams" ? "" : `= ${totalGrams.toFixed(1)} g`;
}

// Live macro/calorie preview — recalculated on every amount/unit change so
// the user can eyeball whether a quantity looks right before confirming.
function updateQtyPreview() {
  if (!pendingFood) return;
  const amount = Number(qtyAmount.value) || 0;
  const totalGrams = amount * selectedUnitGrams();
  const factor = totalGrams / 100;
  const kcal = (pendingFood.kcal_100g ?? 0) * factor;
  const protein = (pendingFood.protein_100g ?? 0) * factor;
  const fat = (pendingFood.fat_100g ?? 0) * factor;
  const carbs = (pendingFood.carbs_100g ?? 0) * factor;
  qtyPreviewKcal.textContent = `${Math.round(kcal)} kcal`;
  qtyPreviewProtein.textContent = `${protein.toFixed(0)}g`;
  qtyPreviewFat.textContent = `${fat.toFixed(0)}g`;
  qtyPreviewCarbs.textContent = `${carbs.toFixed(0)}g`;

  const scaledMicros = {};
  for (const [k, v] of Object.entries(pendingFood.micros || {})) {
    if (typeof v === "number") scaledMicros[k] = v * factor;
  }
  document.getElementById("qty-micros").innerHTML = renderMicros(scaledMicros);
}

function populateUnits(portions, overrides) {
  currentUnits = [
    { id: "grams", label: "Grams", grams: 1 },
    ...portions.map((p, i) => ({ id: `portion${i}`, label: p.label, grams: p.grams })),
  ];
  qtyUnit.innerHTML = currentUnits
    .map((u) => `<option value="${u.id}">${escapeHtml(u.label)}</option>`)
    .join("");
  if (overrides) {
    qtyUnit.value = overrides.unitId || "grams";
    qtyAmount.value = overrides.amount;
  } else if (portions.length > 0) {
    qtyUnit.value = "portion0";
    qtyAmount.value = 1;
  } else {
    qtyUnit.value = "grams";
    qtyAmount.value = 100;
  }
  updateGramsHint();
  updateQtyPreview();
}

qtyAmount.addEventListener("input", () => {
  updateGramsHint();
  updateQtyPreview();
});
qtyUnit.addEventListener("change", () => {
  updateGramsHint();
  updateQtyPreview();
});

// USDA household-unit portions ("1 large", "1 slice") only come from the
// full detail record, not search results — fetched here, lazily, only for
// the one item the user is actually adding. Search stays fast; this is a
// single extra request triggered by an explicit click, not one per result.
//
// `overrides` (used by edit/log-again/frequent-chip flows) pre-fills
// amount/unit/time/meal instead of the normal add-new defaults.
async function openQtyModal(food, overrides) {
  pendingFood = food;
  qtyName.textContent = food.name;
  qtyConfirm.textContent = editingEntryId ? "Save changes" : "Add to log";

  const defaultTime =
    overrides?.time ||
    (() => {
      const now = new Date();
      const d = new Date(currentDate);
      d.setHours(now.getHours(), now.getMinutes(), 0, 0);
      return d;
    })();
  qtyTime.value = toLocalInputValue(defaultTime);
  qtyMeal.value = overrides?.mealType || pinnedMealType || inferMealType(defaultTime);

  let portions = food.portions || [];
  if (food.source === "usda" && food.source_id) {
    searchStatus.hidden = false;
    searchStatus.textContent = "Loading portion sizes…";
    try {
      const detail = await fetchUsdaDetail(food.source_id);
      // Prefer the detail fetch's macros, but never let a partial/odd
      // response null out a good value the search result already had.
      pendingFood = {
        ...food,
        ...detail,
        kcal_100g: detail.kcal_100g ?? food.kcal_100g,
      };
      portions = detail.portions || [];
    } catch {
      // grams-only fallback is fine — not fatal
    } finally {
      searchStatus.hidden = true;
    }
  }
  populateUnits(portions, overrides);
  qtyModal.hidden = false;
}

document.getElementById("qty-cancel").addEventListener("click", () => {
  qtyModal.hidden = true;
  editingEntryId = null;
});

// Re-infer the suggested meal whenever the time changes, so picking a
// different time (e.g. logging breakfast retroactively) updates the
// default — but only when nothing's pinned via a meal section's + Add.
qtyTime.addEventListener("change", () => {
  if (pinnedMealType) return;
  const t = new Date(qtyTime.value);
  if (!isNaN(t)) qtyMeal.value = inferMealType(t);
});

qtyConfirm.addEventListener("click", async () => {
  const amount = Number(qtyAmount.value);
  if (!pendingFood || !amount || amount <= 0) return;
  const grams = amount * selectedUnitGrams();
  const unit = currentUnits.find((u) => u.id === qtyUnit.value);
  const quantityLabel = qtyUnit.value === "grams" ? null : `${amount}× ${unit.label}`;
  const loggedAt = new Date(qtyTime.value);
  if (editingEntryId) {
    await updateEntry(editingEntryId, pendingFood, grams, loggedAt, qtyMeal.value, quantityLabel);
    editingEntryId = null;
  } else {
    await addEntry(pendingFood, grams, loggedAt, qtyMeal.value, quantityLabel);
  }
  qtyModal.hidden = true;
  searchInput.value = "";
  searchResults.innerHTML = "";
  searchStatus.hidden = true;
  refresh();
});

// ── Barcode scan ──
const scanModal = document.getElementById("scan-modal");
const scanVideo = document.getElementById("scan-video");
let stopScan = null;

document.getElementById("scan-btn").addEventListener("click", async () => {
  if (!barcodeScanningSupported()) {
    alert("Camera access isn't available in this browser.");
    return;
  }
  scanModal.hidden = false;
  try {
    stopScan = await startScan(
      scanVideo,
      async (code) => {
        scanModal.hidden = true;
        searchStatus.hidden = false;
        searchStatus.textContent = `Looking up barcode ${code}…`;
        try {
          const food = await lookupBarcode(code);
          searchStatus.hidden = true;
          if (food) openQtyModal(food);
          else alert("No product found for that barcode in Open Food Facts.");
        } catch (err) {
          searchStatus.hidden = true;
          alert("Barcode lookup failed — try again.");
        }
      },
      (err) => console.warn("scan error", err)
    );
  } catch (err) {
    scanModal.hidden = true;
    alert("Couldn't access the camera: " + err.message);
  }
});

document.getElementById("scan-cancel").addEventListener("click", () => {
  stopScan?.();
  scanModal.hidden = true;
});
