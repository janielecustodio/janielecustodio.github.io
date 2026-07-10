const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

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

  const pct = (grams, kcalPerG) =>
    totals.kcal > 0 ? ((grams * kcalPerG) / totals.kcal) * 100 : 0;

  return {
    ...totals,
    micros,
    pctProtein: pct(totals.protein_g, KCAL_PER_G.protein),
    pctCarbs: pct(totals.carbs_g, KCAL_PER_G.carbs),
    pctFat: pct(totals.fat_g, KCAL_PER_G.fat),
  };
}
