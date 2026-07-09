import { isConfigured } from "./supabaseClient.js";
import { onAuthChange, signIn, signUp, signOut } from "./auth.js";
import { searchAll } from "./foodSearch.js";
import { startScan, barcodeScanningSupported } from "./barcode.js";
import { lookupBarcode } from "./sources/off.js";
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
  refresh();
});
document.getElementById("date-next").addEventListener("click", () => {
  currentDate.setDate(currentDate.getDate() + 1);
  refresh();
});
document.getElementById("date-today").addEventListener("click", () => {
  currentDate = startOfDay(new Date());
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

function renderLog(entries) {
  const list = document.getElementById("log-list");
  if (entries.length === 0) {
    list.innerHTML = `<div class="no-entries">Nothing logged yet — search for a food above.</div>`;
    return;
  }

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
    if (groupEntries.length === 0) continue;

    const groupKcal = groupEntries.reduce((sum, e) => sum + (Number(e.kcal) || 0), 0);
    const group = document.createElement("div");
    group.className = "log-group";
    group.innerHTML = `<div class="log-group-header">${label} <span class="log-group-kcal">· ${Math.round(
      groupKcal
    )} kcal</span></div>`;

    for (const e of groupEntries) {
      const row = document.createElement("div");
      row.className = "log-item";
      row.innerHTML = `
        <div class="log-time">${timeFmt.format(new Date(e.logged_at))}</div>
        <div class="log-body">
          <div class="log-name">${escapeHtml(e.foods?.name || "Food")}</div>
          <div class="log-meta">${e.quantity_g} g · P ${e.protein_g.toFixed(
        0
      )} · C ${e.carbs_g.toFixed(0)} · F ${e.fat_g.toFixed(0)}</div>
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
const qtyGrams = document.getElementById("qty-grams");
const qtyTime = document.getElementById("qty-time");
const qtyMeal = document.getElementById("qty-meal");
let pendingFood = null;

qtyMeal.innerHTML = MEAL_TYPES.map((m) => `<option value="${m.id}">${m.label}</option>`).join("");

function toLocalInputValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function openQtyModal(food) {
  pendingFood = food;
  qtyName.textContent = food.name;
  qtyGrams.value = 100;
  const now = new Date();
  const defaultTime = new Date(currentDate);
  defaultTime.setHours(now.getHours(), now.getMinutes(), 0, 0);
  qtyTime.value = toLocalInputValue(defaultTime);
  qtyMeal.value = inferMealType(defaultTime);
  qtyModal.hidden = false;
}

document.getElementById("qty-cancel").addEventListener("click", () => {
  qtyModal.hidden = true;
});

// Re-infer the suggested meal whenever the time changes, so picking a
// different time (e.g. logging breakfast retroactively) updates the default.
qtyTime.addEventListener("change", () => {
  const t = new Date(qtyTime.value);
  if (!isNaN(t)) qtyMeal.value = inferMealType(t);
});

document.getElementById("qty-confirm").addEventListener("click", async () => {
  const grams = Number(qtyGrams.value);
  if (!pendingFood || !grams || grams <= 0) return;
  const loggedAt = new Date(qtyTime.value);
  await addEntry(pendingFood, grams, loggedAt, qtyMeal.value);
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
