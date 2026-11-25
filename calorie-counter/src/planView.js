import { getMealPlan, logMealPlanItem, unlogMealPlanItem, getNotesForDate, saveNote } from "./mealPlan.js";
import { getCycleStartDate, saveCycleStartDate } from "./cycleSettings.js";
import { getEntriesForDate } from "./log.js";

const CYCLE_SLOT_TITLE = "Ciclo das sementes";

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

// Local Y-M-D, not toISOString().slice(0,10) — that goes through UTC and
// shifts the calendar date for any positive UTC-offset timezone.
function toDateStr(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Which option tab is showing per slot — UI-only state, not persisted.
// Keyed by slot id so it survives the full re-render every action causes
// (same re-render-the-whole-container pattern as renderSummary/renderLog).
// Cleared whenever the viewed date changes (see resetForDate below) so a
// manual tab pick on one day doesn't leak into another — this matters
// most for the cycle slot, whose correct tab is date-dependent.
const activeOptionBySlot = new Map();
let lastRenderedDateStr = null;
function resetForDate(dateStr) {
  if (dateStr !== lastRenderedDateStr) {
    activeOptionBySlot.clear();
    lastRenderedDateStr = dateStr;
  }
}

// Day 1 = cycleStartDate itself, repeating every 28 days from there —
// phase 1 covers days 1-14 (the PDF's "dia que menstrua" start), phase 2
// covers days 15-28. Returns null if no start date has been entered yet.
function cyclePhaseForDate(date, cycleStartDate) {
  if (!cycleStartDate) return null;
  const start = new Date(cycleStartDate + "T00:00:00");
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((target - start) / msPerDay);
  const dayOfCycle = (((diffDays % 28) + 28) % 28) + 1;
  return { dayOfCycle, phase: dayOfCycle <= 14 ? 1 : 2 };
}

// Picks a sensible default tab the first time a slot is rendered: whichever
// option already has something logged today, else the lowest option
// number, else just the first option (covers the single-fixed-option case
// where option_number is null).
function defaultActiveOption(slot, loggedItemIds) {
  const withLogged = slot.options.find((o) => o.items.some((i) => loggedItemIds.has(i.id)));
  if (withLogged) return withLogged.id;
  const sorted = [...slot.options].sort((a, b) => (a.option_number || 0) - (b.option_number || 0));
  return sorted[0]?.id;
}

function itemRow(item, isLogged) {
  const supplementTag = item.is_supplement ? `<span class="plan-item-tag">Suplemento</span>` : "";
  return `
    <label class="plan-item ${isLogged ? "is-logged" : ""}">
      <input type="checkbox" class="plan-item-checkbox" data-item-id="${item.id}" ${isLogged ? "checked" : ""}>
      <span class="plan-item-info">
        <span class="plan-item-name">${escapeHtml(item.name)}${supplementTag}</span>
        ${item.quantity_label ? `<span class="plan-item-qty">${escapeHtml(item.quantity_label)}</span>` : ""}
      </span>
    </label>`;
}

function optionBody(option, loggedItemIds) {
  if (option.items.length === 0) {
    return `<div class="plan-empty">Ainda não cadastrado — envie o print dessa opção.</div>`;
  }
  const foodItems = option.items.filter((i) => !i.is_supplement);
  const supplementItems = option.items.filter((i) => i.is_supplement);
  const foodList = foodItems.length
    ? `<div class="plan-items">${foodItems.map((i) => itemRow(i, loggedItemIds.has(i.id))).join("")}</div>`
    : "";
  const supplementList = supplementItems.length
    ? `<div class="plan-supplement-divider">Suplementos</div>
       <div class="plan-items">${supplementItems.map((i) => itemRow(i, loggedItemIds.has(i.id))).join("")}</div>`
    : "";
  const observations = option.observations
    ? `<div class="plan-observations"><div class="plan-observations-label">Observações</div>${escapeHtml(option.observations)}</div>`
    : "";
  return `
    ${option.option_label ? `<div class="plan-option-label">Opção ${escapeHtml(option.option_label)}</div>` : ""}
    ${foodList}
    ${supplementList}
    ${observations}`;
}

function logAllButton(option, loggedItemIds) {
  if (option.items.length === 0) return "";
  const allLogged = option.items.every((i) => loggedItemIds.has(i.id));
  const label = allLogged ? "Tudo registrado" : "Registrar tudo";
  return `
    <button class="plan-log-all-btn" data-option-id="${option.id}" ${allLogged ? "disabled" : ""} title="${label}" aria-label="${label}">
      ✓
    </button>`;
}

function notesSection(slot, note) {
  return `
    <div class="plan-notes">
      <div class="plan-notes-label">Notas</div>
      <textarea class="plan-note-input" data-slot-id="${slot.id}" placeholder="Algum detalhe sobre esta refeição hoje?">${escapeHtml(
        note || ""
      )}</textarea>
    </div>`;
}

function cycleDateControl(slot, cycleStartDate, cycleInfo) {
  const phaseText = cycleInfo
    ? `Hoje: dia ${cycleInfo.dayOfCycle} do ciclo — Fase ${cycleInfo.phase}.`
    : "Informe a data de início do ciclo para selecionar a fase automaticamente.";
  return `
    <div class="plan-cycle-tracker">
      <label class="plan-cycle-label">Início do ciclo (dia que menstruou)</label>
      <input type="date" class="plan-cycle-date-input" data-slot-id="${slot.id}" value="${cycleStartDate || ""}">
      <div class="plan-cycle-phase-info">${escapeHtml(phaseText)}</div>
    </div>`;
}

function slotCard(slot, loggedItemIds, notesBySlot, cycleStartDate, viewDate) {
  const isCycleSlot = slot.title === CYCLE_SLOT_TITLE;
  const hasTabs = slot.options.length > 1 && slot.options.some((o) => o.option_number != null);
  const cycleInfo = isCycleSlot ? cyclePhaseForDate(viewDate, cycleStartDate) : null;
  if (!activeOptionBySlot.has(slot.id)) {
    const cycleOptionId = cycleInfo ? slot.options.find((o) => o.option_number === cycleInfo.phase)?.id : null;
    activeOptionBySlot.set(slot.id, cycleOptionId || defaultActiveOption(slot, loggedItemIds));
  }
  const activeId = activeOptionBySlot.get(slot.id);
  const activeOption = slot.options.find((o) => o.id === activeId) || slot.options[0];

  const tabs = hasTabs
    ? `<div class="plan-option-tabs" data-slot-id="${slot.id}">
        ${slot.options
          .map(
            (o) =>
              `<button class="plan-tab ${o.id === activeId ? "active" : ""}" data-option-id="${o.id}">Opção ${o.option_number}</button>`
          )
          .join("")}
      </div>`
    : "";

  return `
    <div class="plan-slot">
      <div class="plan-slot-header">
        <span class="plan-slot-header-text">
          ${slot.time_label ? `<span class="plan-slot-time">${escapeHtml(slot.time_label)}</span>` : ""}
          <span class="plan-slot-title">${escapeHtml(slot.title)}</span>
        </span>
        ${activeOption ? logAllButton(activeOption, loggedItemIds) : ""}
      </div>
      ${isCycleSlot ? cycleDateControl(slot, cycleStartDate, cycleInfo) : ""}
      ${tabs}
      <div class="plan-option-body">${activeOption ? optionBody(activeOption, loggedItemIds) : ""}</div>
      ${notesSection(slot, notesBySlot.get(slot.id))}
    </div>`;
}

export async function renderPlan(container, date) {
  container.innerHTML = `<div class="no-entries">Carregando…</div>`;
  resetForDate(toDateStr(date));
  const [slots, entries, notesBySlot, cycleStartDate] = await Promise.all([
    getMealPlan(),
    getEntriesForDate(date),
    getNotesForDate(date),
    getCycleStartDate(),
  ]);

  if (slots.length === 0) {
    container.innerHTML = `<div class="no-entries">Nenhum plano cadastrado ainda.</div>`;
    return;
  }

  const loggedItemIds = new Set(
    entries.filter((e) => e.foods?.source === "mealplan").map((e) => e.foods.source_id)
  );

  container.innerHTML = slots
    .map((slot) => slotCard(slot, loggedItemIds, notesBySlot, cycleStartDate, date))
    .join("");

  container.querySelectorAll(".plan-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slotId = btn.closest(".plan-option-tabs").dataset.slotId;
      activeOptionBySlot.set(slotId, btn.dataset.optionId);
      renderPlan(container, date);
    });
  });

  const itemById = new Map();
  for (const slot of slots) {
    for (const option of slot.options) {
      for (const item of option.items) itemById.set(item.id, { item, slot });
    }
  }

  container.querySelectorAll(".plan-item-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      const { item, slot } = itemById.get(checkbox.dataset.itemId);
      checkbox.disabled = true;
      try {
        if (checkbox.checked) {
          await logMealPlanItem(item, slot.meal_type, new Date());
        } else {
          await unlogMealPlanItem(item, date);
        }
      } finally {
        renderPlan(container, date);
      }
    });
  });

  container.querySelectorAll(".plan-log-all-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const option = slots.flatMap((s) => s.options.map((o) => ({ ...o, slot: s }))).find((o) => o.id === btn.dataset.optionId);
      if (!option) return;
      btn.disabled = true;
      try {
        const now = new Date();
        for (const item of option.items) {
          if (!loggedItemIds.has(item.id)) await logMealPlanItem(item, option.slot.meal_type, now);
        }
      } finally {
        renderPlan(container, date);
      }
    });
  });

  // Saved on blur, not on every keystroke — a full renderPlan() on each
  // keystroke would be wasteful and risks yanking focus mid-sentence.
  container.querySelectorAll(".plan-note-input").forEach((textarea) => {
    const initial = textarea.value;
    textarea.addEventListener("blur", () => {
      if (textarea.value === initial) return;
      saveNote(textarea.dataset.slotId, date, textarea.value);
    });
  });

  container.querySelectorAll(".plan-cycle-date-input").forEach((input) => {
    input.addEventListener("change", async () => {
      // Clear this slot's cached tab so the new date re-derives the
      // phase fresh, instead of keeping whatever was selected before.
      activeOptionBySlot.delete(input.dataset.slotId);
      await saveCycleStartDate(input.value || null);
      renderPlan(container, date);
    });
  });
}
