export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

export function computeSummary(entries) {
  const micros = {};
  const totals = entries.reduce(
    (acc, e) => {
      acc.kcal += Number(e.kcal) || 0;
      acc.protein_g += Number(e.protein_g) || 0;
      acc.fat_g += Number(e.fat_g) || 0;
      acc.carbs_g += Number(e.carbs_g) || 0;
      acc.fiber_g += Number(e.fiber_g) || 0;
      for (const [k, v] of Object.entries(e.micros || {})) {
        if (typeof v === "number") micros[k] = (micros[k] || 0) + v;
      }
      return acc;
    },
    { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0 }
  );

  // Percentages are normalized against the sum of macro-derived energy, not
  // the food's own logged kcal — the two rarely match exactly (rounding,
  // fiber's ~2kcal/g Atwater factor vs the general 4kcal/g used here, sugar
  // alcohols, alcohol kcal, label rounding), so dividing by totals.kcal would
  // keep undershooting 100% even with fully correct macros. Dividing by the
  // macro-energy sum instead guarantees the three percentages always add up
  // to exactly 100 (when any macro energy is present).
  const proteinKcal = totals.protein_g * KCAL_PER_G.protein;
  const carbsKcal = totals.carbs_g * KCAL_PER_G.carbs;
  const fatKcal = totals.fat_g * KCAL_PER_G.fat;
  const macroKcal = proteinKcal + carbsKcal + fatKcal;
  const pct = (kcal) => (macroKcal > 0 ? (kcal / macroKcal) * 100 : 0);

  return {
    ...totals,
    micros,
    pctProtein: pct(proteinKcal),
    pctCarbs: pct(carbsKcal),
    pctFat: pct(fatKcal),
  };
}
