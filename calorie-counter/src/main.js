import { isConfigured } from "./supabaseClient.js";
import { onAuthChange, requestOtp, verifyOtp, signOut } from "./auth.js";
import { searchAll } from "./foodSearch.js";
import { startScan, barcodeScanningSupported } from "./barcode.js";
import { lookupBarcode } from "./sources/off.js";
import { addEntry, deleteEntry, getEntriesForDate } from "./log.js";
import { computeSummary } from "./summary.js";

if (!isConfigured) {
  document.getElementById("config-warning").hidden = false;
}

// ── Auth: email one-time passcode, two steps ──
const authError = document.getElementById("auth-error");
const emailStep = document.getElementById("auth-email-step");
const codeStep = document.getElementById("auth-code-step");
const codeSentTo = document.getElementById("auth-code-sent-to");
let pendingEmail = "";

document.getElementById("auth-email-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("auth-email").value.trim();
  authError.hidden = true;
  try {
    await requestOtp(email);
    pendingEmail = email;
    codeSentTo.textContent = email;
    emailStep.hidden = true;
    codeStep.hidden = false;
    document.getElementById("auth-code").focus();
  } catch (err) {
    authError.textContent = err.message || "Couldn't send a code — try again.";
    authError.hidden = false;
  }
});

document.getElementById("auth-code-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = document.getElementById("auth-code").value.trim();
  authError.hidden = true;
  try {
    await verifyOtp(pendingEmail, code);
  } catch (err) {
    authError.textContent = err.message || "Invalid or expired code.";
    authError.hidden = false;
  }
});

document.getElementById("auth-use-different-email").addEventListener("click", () => {
  authError.hidden = true;
  codeStep.hidden = true;
  emailStep.hidden = false;
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
    codeStep.hidden = true;
    emailStep.hidden = false;
    document.getElementById("auth-email-form").reset();
    document.getElementById("auth-code-form").reset();
  }
});

async function refresh() {
  renderDateLabel();
  const entries = await getEntriesForDate(currentDate);
  renderSummary(entries);
  renderLog(entries);
}

// ── Summary ──
function renderSummary(entries) {
  const s = computeSummary(entries);
  const body = document.getElementById("summary-body");
  if (entries.length === 0) {
    body.innerHTML = `<div class="no-entries">No entries logged for this day yet.</div>`;
    return;
  }
  const macroRow = (name, cls, grams, pct) => `
    <div class="macro-row">
      <div class="macro-name">${name}</div>
      <div class="macro-bar-track"><div class="macro-bar-fill ${cls}" style="width:${Math.min(
    pct,
    100
  ).toFixed(1)}%"></div></div>
      <div class="macro-val">${grams.toFixed(1)} g · ${pct.toFixed(0)}%</div>
    </div>`;
  body.innerHTML = `
    <div class="summary-kcal">${Math.round(s.kcal)} kcal</div>
    <div class="summary-kcal-label">Total for the day</div>
    ${macroRow("Protein", "protein", s.protein_g, s.pctProtein)}
    ${macroRow("Carbs", "carbs", s.carbs_g, s.pctCarbs)}
    ${macroRow("Fat", "fat", s.fat_g, s.pctFat)}
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
  list.innerHTML = "";
  for (const e of entries) {
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
    list.appendChild(row);
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
let pendingFood = null;

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
  qtyModal.hidden = false;
}

document.getElementById("qty-cancel").addEventListener("click", () => {
  qtyModal.hidden = true;
});

document.getElementById("qty-confirm").addEventListener("click", async () => {
  const grams = Number(qtyGrams.value);
  if (!pendingFood || !grams || grams <= 0) return;
  const loggedAt = new Date(qtyTime.value);
  await addEntry(pendingFood, grams, loggedAt);
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
