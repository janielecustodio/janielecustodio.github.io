import { getMealPlan, logMealPlanItem, unlogMealPlanItem } from "./mealPlan.js";
import { getEntriesForDate } from "./log.js";

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

// Which option tab is showing per slot — UI-only state, not persisted.
// Keyed by slot id so it survives the full re-render every action causes
// (same re-render-the-whole-container pattern as renderSummary/renderLog).
const activeOptionBySlot = new Map();

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

function slotCard(slot, loggedItemIds) {
  const hasTabs = slot.options.length > 1 && slot.options.some((o) => o.option_number != null);
  if (!activeOptionBySlot.has(slot.id)) {
    activeOptionBySlot.set(slot.id, defaultActiveOption(slot, loggedItemIds));
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
      ${tabs}
      <div class="plan-option-body">${activeOption ? optionBody(activeOption, loggedItemIds) : ""}</div>
    </div>`;
}

export async function renderPlan(container, date) {
  container.innerHTML = `<div class="no-entries">Carregando…</div>`;
  const [slots, entries] = await Promise.all([getMealPlan(), getEntriesForDate(date)]);

  if (slots.length === 0) {
    container.innerHTML = `<div class="no-entries">Nenhum plano cadastrado ainda.</div>`;
    return;
  }

  const loggedItemIds = new Set(
    entries.filter((e) => e.foods?.source === "mealplan").map((e) => e.foods.source_id)
  );

  container.innerHTML = slots.map((slot) => slotCard(slot, loggedItemIds)).join("");

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
}
