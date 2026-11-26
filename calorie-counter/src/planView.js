import { getMealPlan, logMealPlanItem, unlogMealPlanItem, relogMealPlanItem, getNotesForDate, saveNote } from "./mealPlan.js";
import { getCycleStartDate, saveCycleStartDate } from "./cycleSettings.js";
import { getDayEdits, setItemExcluded, setItemMultiplier } from "./mealPlanDayEdits.js";
import { getEntriesForDate, deleteEntry } from "./log.js";

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

// Bridges into main.js's existing add-food / edit-entry modals (there's
// only one of each, already fully built for the regular daily log) —
// set once at startup via setAddFoodHandler/setEditFoodLogHandler, so
// this module never has to duplicate that UI. See main.js's call to
// these near its own setAddTarget/openEditModal definitions.
let onAddFoodRequested = null;
let onEditFoodLogRequested = null;
export function setAddFoodHandler(fn) {
  onAddFoodRequested = fn;
}
export function setEditFoodLogHandler(fn) {
  onEditFoodLogRequested = fn;
}

// Which option tab is showing per slot — UI-only state, not persisted.
// Keyed by slot id so it survives the full re-render every action causes
// (same re-render-the-whole-container pattern as renderSummary/renderLog).
// Cleared whenever the viewed date changes (see resetForDate below) so a
// manual tab pick on one day doesn't leak into another — this matters
// most for the cycle slot, whose correct tab is date-dependent.
const activeOptionBySlot = new Map();
// Which alternative is showing for an item-level substitution group (see
// groupItems below) — same lifecycle as activeOptionBySlot: UI-only,
// reset on date change. Keyed by `${option_id}::${substitution_group}`.
const activeSubstituteByGroup = new Map();
// Which substitution groups currently have their "+N opções" picker open.
const expandedGroups = new Set();
// A slot auto-collapses once everything in its active option is logged
// (less scrolling past meals already done), but tapping the header
// always overrides that for the rest of the session — recorded here so
// the auto-collapse doesn't immediately re-hide a slot the person just
// chose to reopen, or vice versa.
const collapseOverrideBySlot = new Map();
let lastRenderedDateStr = null;
function resetForDate(dateStr) {
  if (dateStr !== lastRenderedDateStr) {
    activeOptionBySlot.clear();
    activeSubstituteByGroup.clear();
    expandedGroups.clear();
    collapseOverrideBySlot.clear();
    lastRenderedDateStr = dateStr;
  }
}

function groupKey(item) {
  return `${item.option_id}::${item.substitution_group}`;
}

// Splits an option's food items into single rows and substitution
// groups (items sharing a substitution_group, e.g. "Salmão grelhado" /
// "Peito de frango grelhado"). Order follows each group's first
// appearance by order_index.
function groupItems(items) {
  const result = [];
  const seen = new Set();
  for (const item of items) {
    if (!item.substitution_group) {
      result.push({ type: "single", item });
      continue;
    }
    const key = groupKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    const siblings = items.filter((i) => i.substitution_group === item.substitution_group).sort((a, b) => a.order_index - b.order_index);
    result.push({ type: "group", items: siblings });
  }
  return result;
}

// Where a supplement renders, relative to the food items: "inline"
// means it's an ingredient of the recipe it's listed under (e.g.
// collagen blended into a shake, or glutamina dissolved into the
// "Shot") and stays in its normal order_index position among the food
// items — still tagged "Suplemento", just not physically separated.
// "before"/"after" means it's taken as its own dose outside the meal
// and renders in a dedicated block above/below the food items.
function supplementPlacement(item) {
  if (!item.is_supplement) return "inline";
  if (item.supplement_timing === "antes") return "before";
  if (item.supplement_timing === "depois") return "after";
  return "inline";
}

// Applies today's customization (see mealPlanDayEdits.js) to an
// option's template items: items the person swiped away today are
// dropped entirely, and items with a quantity multiplier get their
// macros scaled — everything downstream (grouping, the "all logged"
// check, "Registrar tudo") just sees the resulting list, same as if the
// plan had always been this way for today.
function applyDayEdits(items, dayEdits) {
  return items
    .filter((i) => !dayEdits.excluded_item_ids.includes(i.id))
    .map((i) => {
      const mult = dayEdits.quantity_multipliers[i.id];
      if (!mult || mult === 1) return i;
      return {
        ...i,
        kcal: i.kcal * mult,
        protein_g: i.protein_g * mult,
        fat_g: i.fat_g * mult,
        carbs_g: i.carbs_g * mult,
        _multiplier: mult,
      };
    });
}

// The item actually counted for "all logged" / "Registrar tudo" per
// group: whichever alternative is currently active (default: the one
// with the lowest order_index, i.e. the plan's primary pick) — never
// every alternative, since only one of them is ever meant to be eaten.
function effectiveItems(option) {
  const inline = option.items.filter((i) => supplementPlacement(i) === "inline");
  const before = option.items.filter((i) => supplementPlacement(i) === "before");
  const after = option.items.filter((i) => supplementPlacement(i) === "after");
  const inlineGroups = groupItems(inline);
  const activeInline = inlineGroups.map((g) => {
    if (g.type === "single") return g.item;
    const activeId = activeSubstituteByGroup.get(groupKey(g.items[0]));
    return g.items.find((i) => i.id === activeId) || g.items[0];
  });
  return [...before, ...activeInline, ...after];
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

// A plan item's row: no checkbox — being listed here already means
// "part of today's menu" (see collapse/Registrar tudo for how logging
// itself works). A small dot shows whether it's actually been logged
// yet. A pencil button edits its quantity (via setItemMultiplier), an
// X button excludes it from today — used for extra (non-plan) rows,
// which edit/delete the real food_log entry instead (see extraItemRow).
function itemRow(item, isLogged, { badgeHtml = "" } = {}) {
  const supplementTag = item.is_supplement ? `<span class="plan-item-tag">Suplemento</span>` : "";
  const multTag = item._multiplier ? `<span class="plan-item-mult">× ${item._multiplier}</span>` : "";
  return `
    <div class="plan-item-row" data-item-id="${item.id}">
      <div class="plan-item ${isLogged ? "is-logged" : ""}">
        <span class="plan-item-status">${isLogged ? "✓" : ""}</span>
        <span class="plan-item-info">
          <span class="plan-item-name">${escapeHtml(item.name)}${supplementTag}</span>
          ${item.quantity_label ? `<span class="plan-item-qty">${escapeHtml(item.quantity_label)}${multTag}</span>` : multTag}
        </span>
        ${badgeHtml}
        <span class="plan-item-actions">
          <button type="button" class="plan-item-edit-btn" data-item-id="${item.id}" aria-label="Editar quantidade" title="Editar quantidade">✎</button>
          <button type="button" class="plan-item-del-btn" data-item-id="${item.id}" aria-label="Excluir" title="Excluir">✕</button>
        </span>
      </div>
    </div>`;
}

// An "extra" row: something logged for this meal that isn't part of the
// plan at all (added via the "+" button, or from the regular daily log
// while browsing this same date) — same look, but its buttons act on
// the real food_log entry via the bridges into main.js.
function extraItemRow(entry) {
  const macros = `P ${entry.protein_g.toFixed(0)} · C ${entry.carbs_g.toFixed(0)} · F ${entry.fat_g.toFixed(0)}`;
  return `
    <div class="plan-item-row" data-entry-id="${entry.id}">
      <div class="plan-item is-logged">
        <span class="plan-item-status">✓</span>
        <span class="plan-item-info">
          <span class="plan-item-name">${escapeHtml(entry.foods?.name || "Item")}<span class="plan-item-tag plan-item-tag-extra">Extra</span></span>
          <span class="plan-item-qty">${escapeHtml(entry.quantity_label || `${entry.quantity_g} g`)} · ${Math.round(entry.kcal)} kcal · ${macros}</span>
        </span>
        <span class="plan-item-actions">
          <button type="button" class="plan-extra-edit-btn" data-entry-id="${entry.id}" aria-label="Editar" title="Editar">✎</button>
          <button type="button" class="plan-extra-del-btn" data-entry-id="${entry.id}" aria-label="Excluir" title="Excluir">✕</button>
        </span>
      </div>
    </div>`;
}

// Renders a substitution group: the active alternative as a normal
// logging row, plus a "+N opções" toggle that expands a small picker
// below it listing the others — tapping one makes it the active row.
function substitutionGroupRow(groupItemsList, loggedItemIds) {
  const key = groupKey(groupItemsList[0]);
  const activeId = activeSubstituteByGroup.get(key);
  const activeItem = groupItemsList.find((i) => i.id === activeId) || groupItemsList[0];
  const altCount = groupItemsList.length - 1;
  const altLabel = altCount === 1 ? "+1 opção" : `+${altCount} opções`;
  const badge = `<button type="button" class="plan-sub-badge" data-group-key="${key}">${altLabel}</button>`;
  const row = itemRow(activeItem, loggedItemIds.has(activeItem.id), { badgeHtml: badge });

  if (!expandedGroups.has(key)) return row;

  const options = groupItemsList
    .filter((i) => i.id !== activeItem.id)
    .map(
      (i) => `
        <button type="button" class="plan-sub-option" data-group-key="${key}" data-item-id="${i.id}">
          <span class="plan-sub-option-name">${escapeHtml(i.name)}</span>
          ${i.quantity_label ? `<span class="plan-sub-option-qty">${escapeHtml(i.quantity_label)}</span>` : ""}
        </button>`
    )
    .join("");
  return `
    ${row}
    <div class="plan-sub-picker">
      <div class="plan-sub-picker-label">Opções disponíveis</div>
      ${options}
    </div>`;
}

function optionBody(option, loggedItemIds, extraEntries) {
  if (option.items.length === 0 && extraEntries.length === 0) {
    return `<div class="plan-empty">Ainda não cadastrado — envie o print dessa opção.</div>`;
  }
  const before = option.items.filter((i) => supplementPlacement(i) === "before");
  const after = option.items.filter((i) => supplementPlacement(i) === "after");
  const inlineGroups = groupItems(option.items.filter((i) => supplementPlacement(i) === "inline"));

  const beforeList = before.length
    ? `<div class="plan-supplement-divider">Antes da refeição</div>
       <div class="plan-items">${before.map((i) => itemRow(i, loggedItemIds.has(i.id))).join("")}</div>`
    : "";
  const mainRows = [
    ...inlineGroups.map((g) => (g.type === "single" ? itemRow(g.item, loggedItemIds.has(g.item.id)) : substitutionGroupRow(g.items, loggedItemIds))),
    ...extraEntries.map((e) => extraItemRow(e)),
  ];
  const mainList = mainRows.length
    ? `${before.length ? `<div class="plan-supplement-divider">Refeição</div>` : ""}
       <div class="plan-items">${mainRows.join("")}</div>`
    : "";
  const afterList = after.length
    ? `<div class="plan-supplement-divider">Depois da refeição</div>
       <div class="plan-items">${after.map((i) => itemRow(i, loggedItemIds.has(i.id))).join("")}</div>`
    : "";
  const observations = option.observations
    ? `<div class="plan-observations"><div class="plan-observations-label">Observações</div>${escapeHtml(option.observations)}</div>`
    : "";
  return `
    ${option.option_label ? `<div class="plan-option-label">Opção ${escapeHtml(option.option_label)}</div>` : ""}
    ${beforeList}
    ${mainList}
    ${afterList}
    ${observations}`;
}

function logAllButton(option, loggedItemIds) {
  if (option.items.length === 0) return "";
  const items = effectiveItems(option);
  const allLogged = items.every((i) => loggedItemIds.has(i.id));
  const label = allLogged ? "Tudo registrado" : "Registrar tudo";
  return `
    <button class="plan-log-all-btn" data-option-id="${option.id}" ${allLogged ? "disabled" : ""} title="${label}" aria-label="${label}">
      ✓
    </button>`;
}

function addFoodButton(slot) {
  return `
    <button type="button" class="plan-add-food-btn" data-meal-type="${slot.meal_type}" title="Adicionar outro alimento" aria-label="Adicionar outro alimento">
      +
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

// Picks which of a slot's options is "active" (shown) right now — same
// logic used both to decide what to prefetch day-edits for, and inside
// slotCard itself.
function activeOptionForSlot(slot, loggedItemIds, cycleStartDate, viewDate) {
  const isCycleSlot = slot.title === CYCLE_SLOT_TITLE;
  const cycleInfo = isCycleSlot ? cyclePhaseForDate(viewDate, cycleStartDate) : null;
  if (!activeOptionBySlot.has(slot.id)) {
    const cycleOptionId = cycleInfo ? slot.options.find((o) => o.option_number === cycleInfo.phase)?.id : null;
    activeOptionBySlot.set(slot.id, cycleOptionId || defaultActiveOption(slot, loggedItemIds));
  }
  const activeId = activeOptionBySlot.get(slot.id);
  return slot.options.find((o) => o.id === activeId) || slot.options[0];
}

function slotCard(slot, loggedItemIds, notesBySlot, cycleStartDate, viewDate, dayEditsByOption, extraEntriesByMealType) {
  const isCycleSlot = slot.title === CYCLE_SLOT_TITLE;
  const hasTabs = slot.options.length > 1 && slot.options.some((o) => o.option_number != null);
  const cycleInfo = isCycleSlot ? cyclePhaseForDate(viewDate, cycleStartDate) : null;
  const rawActiveOption = activeOptionForSlot(slot, loggedItemIds, cycleStartDate, viewDate);
  const activeId = rawActiveOption?.id;
  const dayEdits = (rawActiveOption && dayEditsByOption.get(rawActiveOption.id)) || { excluded_item_ids: [], quantity_multipliers: {} };
  const activeOption = rawActiveOption ? { ...rawActiveOption, items: applyDayEdits(rawActiveOption.items, dayEdits) } : null;
  const extraEntries = extraEntriesByMealType.get(slot.meal_type) || [];

  // Auto-collapses once everything in the active option is logged, so a
  // finished meal doesn't take up scroll space — tapping the header
  // always overrides this for the rest of the session (see
  // collapseOverrideBySlot above).
  const isFullyLogged =
    !!activeOption &&
    (activeOption.items.length > 0 || extraEntries.length > 0) &&
    effectiveItems(activeOption).every((i) => loggedItemIds.has(i.id));
  const collapsed = collapseOverrideBySlot.has(slot.id) ? collapseOverrideBySlot.get(slot.id) : isFullyLogged;

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

  const body = collapsed
    ? ""
    : `
      ${isCycleSlot ? cycleDateControl(slot, cycleStartDate, cycleInfo) : ""}
      ${tabs}
      <div class="plan-option-body">${activeOption ? optionBody(activeOption, loggedItemIds, extraEntries) : ""}</div>
      ${notesSection(slot, notesBySlot.get(slot.id))}`;

  return `
    <div class="plan-slot ${collapsed ? "is-collapsed" : ""}">
      <div class="plan-slot-header">
        <button type="button" class="plan-slot-header-toggle" data-slot-id="${slot.id}" aria-label="${collapsed ? "Expandir" : "Recolher"}">
          <span class="plan-slot-chevron">${collapsed ? "›" : "⌄"}</span>
          <span class="plan-slot-header-text">
            ${slot.time_label ? `<span class="plan-slot-time">${escapeHtml(slot.time_label)}</span>` : ""}
            <span class="plan-slot-title">${escapeHtml(slot.title)}</span>
          </span>
        </button>
        <span class="plan-slot-header-actions">
          ${addFoodButton(slot)}
          ${activeOption ? logAllButton(activeOption, loggedItemIds) : ""}
        </span>
      </div>
      ${body}
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

  // Rows logged for a slot's meal_type that aren't one of this plan's
  // own synthetic items — added via "+" (or from the regular daily log
  // while browsing this date) — rendered inline as "extra" rows.
  const extraEntriesByMealType = new Map();
  for (const e of entries) {
    if (e.foods?.source === "mealplan") continue;
    if (!extraEntriesByMealType.has(e.meal_type)) extraEntriesByMealType.set(e.meal_type, []);
    extraEntriesByMealType.get(e.meal_type).push(e);
  }

  // Only the currently-active option per slot needs its day-edits
  // fetched — switching tabs re-renders and fetches the newly active
  // one then, same pattern as everything else in this module.
  const activeOptions = slots.map((slot) => activeOptionForSlot(slot, loggedItemIds, cycleStartDate, date)).filter(Boolean);
  const dayEditsByOption = new Map();
  await Promise.all(
    activeOptions.map(async (opt) => {
      dayEditsByOption.set(opt.id, await getDayEdits(opt.id, date));
    })
  );

  container.innerHTML = slots
    .map((slot) => slotCard(slot, loggedItemIds, notesBySlot, cycleStartDate, date, dayEditsByOption, extraEntriesByMealType))
    .join("");

  container.querySelectorAll(".plan-slot-header-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const collapsedNow = btn.closest(".plan-slot").classList.contains("is-collapsed");
      collapseOverrideBySlot.set(btn.dataset.slotId, !collapsedNow);
      renderPlan(container, date);
    });
  });

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
      for (const item of option.items) itemById.set(item.id, { item, slot, option });
    }
  }

  container.querySelectorAll(".plan-log-all-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const option = slots.flatMap((s) => s.options.map((o) => ({ ...o, slot: s }))).find((o) => o.id === btn.dataset.optionId);
      if (!option) return;
      const dayEdits = dayEditsByOption.get(option.id) || { excluded_item_ids: [], quantity_multipliers: {} };
      const effectiveOption = { ...option, items: applyDayEdits(option.items, dayEdits) };
      btn.disabled = true;
      try {
        const now = new Date();
        for (const item of effectiveItems(effectiveOption)) {
          if (!loggedItemIds.has(item.id)) await logMealPlanItem(item, option.slot.meal_type, now);
        }
      } finally {
        renderPlan(container, date);
      }
    });
  });

  container.querySelectorAll(".plan-add-food-btn").forEach((btn) => {
    btn.addEventListener("click", () => onAddFoodRequested?.(btn.dataset.mealType));
  });

  container.querySelectorAll(".plan-sub-badge").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.groupKey;
      if (expandedGroups.has(key)) expandedGroups.delete(key);
      else expandedGroups.add(key);
      renderPlan(container, date);
    });
  });

  container.querySelectorAll(".plan-sub-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.groupKey;
      activeSubstituteByGroup.set(key, btn.dataset.itemId);
      expandedGroups.delete(key);
      renderPlan(container, date);
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

  // ── Plan item actions (edit quantity / exclude) ─────────────────────
  container.querySelectorAll(".plan-item-del-btn").forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const itemId = btn.dataset.itemId;
      const found = itemById.get(itemId);
      if (!found) return;
      const { item, option } = found;
      await setItemExcluded(option.id, date, itemId, true);
      if (loggedItemIds.has(itemId)) await unlogMealPlanItem(item, date);
      renderPlan(container, date);
    });
  });

  container.querySelectorAll(".plan-item-edit-btn").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const itemId = btn.dataset.itemId;
      const found = itemById.get(itemId);
      if (!found) return;
      const { item, slot, option } = found;
      const dayEdits = dayEditsByOption.get(option.id) || { quantity_multipliers: {} };
      const current = dayEdits.quantity_multipliers[itemId] || 1;
      const input = window.prompt(
        `${item.name}${item.quantity_label ? ` — ${item.quantity_label}` : ""}\n\nQuantas vezes a porção do plano? (ex.: 2 para dobro, 0.5 para metade)`,
        String(current)
      );
      if (input === null) return;
      const mult = Number(input.replace(",", "."));
      if (!Number.isFinite(mult) || mult <= 0) return;
      (async () => {
        await setItemMultiplier(option.id, date, itemId, mult);
        if (loggedItemIds.has(itemId)) {
          const scaled = { ...item, kcal: item.kcal * mult, protein_g: item.protein_g * mult, fat_g: item.fat_g * mult, carbs_g: item.carbs_g * mult };
          await relogMealPlanItem(scaled, slot.meal_type, date);
        }
        renderPlan(container, date);
      })();
    });
  });

  // ── Extra item actions (edit / delete the real food_log entry) ─────
  const entryById = new Map(entries.map((e) => [e.id, e]));
  container.querySelectorAll(".plan-extra-del-btn").forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      await deleteEntry(btn.dataset.entryId);
      renderPlan(container, date);
    });
  });

  container.querySelectorAll(".plan-extra-edit-btn").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const entry = entryById.get(btn.dataset.entryId);
      if (entry) onEditFoodLogRequested?.(entry);
    });
  });
}
