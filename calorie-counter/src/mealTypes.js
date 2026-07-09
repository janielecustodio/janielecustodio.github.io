export const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast" },
  { id: "morning_snack", label: "Morning Snack" },
  { id: "lunch", label: "Lunch" },
  { id: "afternoon_snack", label: "Afternoon Snack" },
  { id: "dinner", label: "Dinner" },
  { id: "evening_snack", label: "After Dinner Snack" },
];

const LABELS = Object.fromEntries(MEAL_TYPES.map((m) => [m.id, m.label]));

export function mealTypeLabel(id) {
  return LABELS[id] || "Other";
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
