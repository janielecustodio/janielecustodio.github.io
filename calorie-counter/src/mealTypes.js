// Portuguese, matching every other label in the app (Plano's own slot
// names, buttons, alerts) — these used to be in English, which made it
// hard to tell at a glance which of Plano's own slots ("Café da manhã",
// "Lanche I", ...) a given logged entry's meal-type group corresponded
// to, exactly the "was it a snack? was it breakfast?" confusion.
export const MEAL_TYPES = [
  { id: "breakfast", label: "Café da manhã" },
  { id: "morning_snack", label: "Lanche da manhã" },
  { id: "lunch", label: "Almoço" },
  { id: "afternoon_snack", label: "Lanche da tarde" },
  { id: "dinner", label: "Jantar" },
  { id: "evening_snack", label: "Lanche da noite" },
];

const LABELS = Object.fromEntries(MEAL_TYPES.map((m) => [m.id, m.label]));

export function mealTypeLabel(id) {
  return LABELS[id] || "Outro";
}

// Best-guess meal type from time of day — used as the default selection in
// the add-food form, and as a fallback bucket for entries logged before this
// feature existed (which have no meal_type stored).
export function inferMealType(date) {
  const h = date.getHours();
  if (h < 5) return "evening_snack";
  if (h < 10) return "breakfast";
  if (h < 12) return "morning_snack";
  if (h < 14) return "lunch";
  if (h < 18) return "afternoon_snack";
  if (h < 21) return "dinner";
  return "evening_snack";
}
