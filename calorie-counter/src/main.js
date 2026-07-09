import { isConfigured } from "./supabaseClient.js";
import { onAuthChange, signIn, signUp, signOut } from "./auth.js";
import { searchAll } from "./foodSearch.js";
import { startScan, barcodeScanningSupported } from "./barcode.js";
import { lookupBarcode } from "./sources/off.js";
import { fetchUsdaDetail } from "./sources/usda.js";
import { addEntry, deleteEntry, getEntriesForDate } from "./log.js";
import { computeSummary } from "./summary.js";
import { MEAL_TYPES, inferMealType } from "./mealTypes.js";

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
  if (authed) {
    refresh();
  } else {
    document.getElementById("auth-form").reset();
    clearAddTarget();
  }
});

async function refresh() {
  renderDateLabel();
  const entries = await getEntriesForDate(currentDate);
  renderSummary(entries);
  renderLog(entries);
}

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

function renderSummary(entries) {
  const s = computeSummary(entries);
  const body = document.getElementById("summary-body");
  if (entries.length === 0) {
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

  body.innerHTML = `
    <div class="summary-viz">
      <div class="donut-wrap">
        <svg class="donut-svg" viewBox="0 0 140 140">
          <circle class="donut-track" cx="70" cy="70" r="${DONUT_R}"></circle>
          ${arcs}
        </svg>
        <div class="donut-center">
          <div class="donut-center-kcal">${Math.round(s.kcal)}</div>
          <div class="donut-center-label">kcal</div>
        </div>
      </div>
      <div class="donut-legend">${legend}</div>
    </div>
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
    group.innerHTML = `
      <div class="log-group-header">
        <span>${label} ${kcalHtml}</span>
        <button class="log-group-add" type="button">+ Add</button>
      </div>
    `;
    group.querySelector(".log-group-add").addEventListener("click", () => setAddTarget(id));

    for (const e of groupEntries) {
      const row = document.createElement("div");
      row.className = "log-item";
      row.innerHTML = `
        <div class="log-time">${timeFmt.format(new Date(e.logged_at))}</div>
        <div class="log-body">
          <div class="log-name">${escapeHtml(e.foods?.name || "Food")}</div>
          <div class="log-meta">${escapeHtml(
            e.quantity_label || `${e.quantity_g} g`
          )} · P ${e.protein_g.toFixed(0)} · C ${e.carbs_g.toFixed(
        0
      )} · F ${e.fat_g.toFixed(0)}</div>
        </div>
        <div class="log-kcal">${Math.round(e.kcal)} kcal</div>
        <button class="log-del" aria-label="Delete entry">✕</button>
      `;
      row.querySelector(".log-del").addEventListener("click", async () => {
        await deleteEntry(e.id);
        refresh();
      });
      group.appendChild(row);
    }
    list.appendChild(group);
  }
}

// ── Add-food target (pinned meal) ──
let pinnedMealType = null;
const addTarget = document.getElementById("add-target");
const addTargetLabel = document.getElementById("add-target-label");

function setAddTarget(mealId) {
  pinnedMealType = mealId;
  addTargetLabel.textContent = MEAL_TYPES.find((m) => m.id === mealId)?.label || "";
  addTarget.hidden = false;
  document.getElementById("search-input").scrollIntoView({ behavior: "smooth", block: "center" });
  document.getElementById("search-input").focus();
}

function clearAddTarget() {
  pinnedMealType = null;
  addTarget.hidden = true;
}

document.getElementById("add-target-clear").addEventListener("click", clearAddTarget);

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

// ── Search ──
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const searchStatus = document.getElementById("search-status");
let searchToken = 0;

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
    const item = document.createElement("div");
    item.className = "result-item";
    item.innerHTML = `
      <span class="tag">${food.source}</span>
      <div class="result-body">
        <div class="result-name">${escapeHtml(food.name)}${
      food.brand ? " · " + escapeHtml(food.brand) : ""
    }</div>
        <div class="result-meta">per 100g · P ${food.protein_100g.toFixed(
          0
        )} C ${food.carbs_100g.toFixed(0)} F ${food.fat_100g.toFixed(0)}</div>
      </div>
      <div class="result-kcal">${Math.round(food.kcal_100g)} kcal/100g</div>
    `;
    item.addEventListener("click", () => openQtyModal(food));
    searchResults.appendChild(item);
  }
}

// ── Quantity modal ──
const qtyModal = document.getElementById("qty-modal");
const qtyName = document.getElementById("qty-food-name");
const qtyAmount = document.getElementById("qty-amount");
const qtyUnit = document.getElementById("qty-unit");
const qtyGramsHint = document.getElementById("qty-grams-hint");
const qtyTime = document.getElementById("qty-time");
const qtyMeal = document.getElementById("qty-meal");
let pendingFood = null;
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

function populateUnits(portions) {
  currentUnits = [
    { id: "grams", label: "Grams", grams: 1 },
    ...portions.map((p, i) => ({ id: `portion${i}`, label: p.label, grams: p.grams })),
  ];
  qtyUnit.innerHTML = currentUnits
    .map((u) => `<option value="${u.id}">${escapeHtml(u.label)}</option>`)
    .join("");
  if (portions.length > 0) {
    qtyUnit.value = "portion0";
    qtyAmount.value = 1;
  } else {
    qtyUnit.value = "grams";
    qtyAmount.value = 100;
  }
  updateGramsHint();
}

qtyAmount.addEventListener("input", updateGramsHint);
qtyUnit.addEventListener("change", updateGramsHint);

// USDA household-unit portions ("1 large", "1 slice") only come from the
// full detail record, not search results — fetched here, lazily, only for
// the one item the user is actually adding. Search stays fast; this is a
// single extra request triggered by an explicit click, not one per result.
async function openQtyModal(food) {
  pendingFood = food;
  qtyName.textContent = food.name;
  const now = new Date();
  const defaultTime = new Date(currentDate);
  defaultTime.setHours(now.getHours(), now.getMinutes(), 0, 0);
  qtyTime.value = toLocalInputValue(defaultTime);
  qtyMeal.value = pinnedMealType || inferMealType(defaultTime);

  let portions = food.portions || [];
  if (food.source === "usda") {
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
  populateUnits(portions);
  qtyModal.hidden = false;
}

document.getElementById("qty-cancel").addEventListener("click", () => {
  qtyModal.hidden = true;
});

// Re-infer the suggested meal whenever the time changes, so picking a
// different time (e.g. logging breakfast retroactively) updates the
// default — but only when nothing's pinned via a meal section's + Add.
qtyTime.addEventListener("change", () => {
  if (pinnedMealType) return;
  const t = new Date(qtyTime.value);
  if (!isNaN(t)) qtyMeal.value = inferMealType(t);
});

document.getElementById("qty-confirm").addEventListener("click", async () => {
  const amount = Number(qtyAmount.value);
  if (!pendingFood || !amount || amount <= 0) return;
  const grams = amount * selectedUnitGrams();
  const unit = currentUnits.find((u) => u.id === qtyUnit.value);
  const quantityLabel = qtyUnit.value === "grams" ? null : `${amount}× ${unit.label}`;
  const loggedAt = new Date(qtyTime.value);
  await addEntry(pendingFood, grams, loggedAt, qtyMeal.value, quantityLabel);
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
