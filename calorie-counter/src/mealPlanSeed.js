// Bundled copy of "Plano Alimentar XV" (see sql/seed_meal_plan_xv.sql for
// the full provenance notes — same content, kept in sync by hand since
// there are two targets: the real Supabase project, and this local-mode
// fallback for when it isn't reachable). Used only by localClient.js to
// pre-populate the meal_plan_* tables when running without a Supabase
// connection, so the Plano view works immediately with no setup.
//
// IDs are stable short strings (not real UUIDs) — fine for local mode,
// where nothing ever has to match a server-generated id.

function supplementRows(names) {
  return names.map((n, i) => ({ order_index: 100 + i, ...n, is_supplement: true }));
}

const MORNING_SUPPLEMENTS = supplementRows([
  { name: "Vitamina D", quantity_label: "1 dose", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
  { name: "Ferro", quantity_label: "1 dose", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
  { name: "Red Yeast Rice + CoQ10", quantity_label: "2 cápsulas", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
  {
    name: "Manipulado (zinco, selênio, magnésio, B6, B2, B9, B12, colina, vit. C, PQQ, vit. E)",
    quantity_label: "1 dose",
    kcal: 0,
    protein_g: 0,
    fat_g: 0,
    carbs_g: 0,
  },
]);

const LANCHE_SUPPLEMENTS = supplementRows([
  { name: "Rhodiola rosea", quantity_label: "1 dose (150 mg) — 17h", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
  { name: "Gengibre extrato seco", quantity_label: "1 dose (500 mg)", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
]);

const JANTAR_SUPPLEMENTS = supplementRows([
  { name: "Morosil", quantity_label: "1 dose (250 mg) — antes do jantar", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
  { name: "Magnésio Inositol Relief 3.0", quantity_label: "1 dose — antes de dormir", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
]);

export const MEAL_PLAN_SLOTS = [
  { id: "slot-jejum", order_index: 1, time_label: "06:00", title: "Em jejum", meal_type: "breakfast" },
  { id: "slot-shot", order_index: 2, time_label: "06:05", title: "Shot", meal_type: "breakfast" },
  { id: "slot-cafe", order_index: 3, time_label: "07:00", title: "Café da manhã", meal_type: "breakfast" },
  { id: "slot-almoco", order_index: 4, time_label: null, title: "Almoço", meal_type: "lunch" },
  { id: "slot-lanche1", order_index: 5, time_label: null, title: "Lanche I", meal_type: "afternoon_snack" },
  { id: "slot-postreino", order_index: 6, time_label: null, title: "Pós-treino", meal_type: "afternoon_snack" },
  { id: "slot-jantar", order_index: 7, time_label: null, title: "Jantar", meal_type: "dinner" },
];

export const MEAL_PLAN_OPTIONS = [
  { id: "opt-jejum", slot_id: "slot-jejum", option_number: null, option_label: null, observations: null },

  {
    id: "opt-shot",
    slot_id: "slot-shot",
    option_number: null,
    option_label: null,
    observations:
      "Conferir no PDF: Glutamina - 1 colher medidora (5 g). Prescrição original — Própolis alcoólica - 20 gota.",
  },

  {
    id: "opt-cafe-1",
    slot_id: "slot-cafe",
    option_number: 1,
    option_label: "Pão com queijo + iogurte e fruta",
    observations:
      "Ou substituir ovo + queijo gouda por pastinha de ovo (1 ovo cozido amassado com 1 colher de sopa de queijo cottage + temperos).",
  },
  { id: "opt-cafe-2", slot_id: "slot-cafe", option_number: 2, option_label: null, observations: null },
  { id: "opt-cafe-3", slot_id: "slot-cafe", option_number: 3, option_label: null, observations: null },
  { id: "opt-cafe-4", slot_id: "slot-cafe", option_number: 4, option_label: null, observations: null },

  { id: "opt-almoco", slot_id: "slot-almoco", option_number: null, option_label: null, observations: null },

  { id: "opt-lanche1-1", slot_id: "slot-lanche1", option_number: 1, option_label: "Prático", observations: null },
  { id: "opt-lanche1-2", slot_id: "slot-lanche1", option_number: 2, option_label: null, observations: null },
  { id: "opt-lanche1-3", slot_id: "slot-lanche1", option_number: 3, option_label: null, observations: null },
  { id: "opt-lanche1-4", slot_id: "slot-lanche1", option_number: 4, option_label: null, observations: null },

  {
    id: "opt-postreino",
    slot_id: "slot-postreino",
    option_number: null,
    option_label: null,
    observations: "Prescrição original — Proteína do colágeno - 1 dose (20 g).",
  },

  { id: "opt-jantar-1", slot_id: "slot-jantar", option_number: 1, option_label: null, observations: null },
  { id: "opt-jantar-2", slot_id: "slot-jantar", option_number: 2, option_label: null, observations: null },
  { id: "opt-jantar-3", slot_id: "slot-jantar", option_number: 3, option_label: "Rap10 caseiro", observations: null },
  { id: "opt-jantar-4", slot_id: "slot-jantar", option_number: 4, option_label: null, observations: null },
  { id: "opt-jantar-5", slot_id: "slot-jantar", option_number: 5, option_label: null, observations: null },
];

// Global counter, not per-call — itemsFor() is called more than once for
// the same option_id (food items, then supplements added separately), and
// a per-call index would collide and produce duplicate ids.
let nextItemId = 0;
function itemsFor(optionId, rows) {
  return rows.map((r) => ({ id: `item-${nextItemId++}`, option_id: optionId, ...r }));
}

export const MEAL_PLAN_ITEMS = [
  ...itemsFor("opt-jejum", [
    { order_index: 1, name: "Água", quantity_label: "500 mL", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, is_supplement: false },
  ]),

  ...itemsFor("opt-shot", [
    { order_index: 1, name: "Água", quantity_label: "100 mL", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, is_supplement: false },
    { order_index: 2, name: "Glutamina", quantity_label: "5 g", kcal: 20, protein_g: 5, fat_g: 0, carbs_g: 0, is_supplement: true },
    { order_index: 3, name: "Própolis Alcoólico", quantity_label: "20 Gotas (0,6 mL)", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, is_supplement: true },
  ]),

  ...itemsFor("opt-cafe-1", [
    { order_index: 1, name: "Frutas vermelhas", quantity_label: "1 Xícara de chá (120 mL)", kcal: 60, protein_g: 1, fat_g: 0.5, carbs_g: 14, is_supplement: false },
    { order_index: 2, name: "Farelo de aveia", quantity_label: "2 Colheres de sopa (20 g)", kcal: 49, protein_g: 3.5, fat_g: 1.4, carbs_g: 13.2, is_supplement: false },
    { order_index: 3, name: "Iogurte Oikos Triple Zero Plain EUA", quantity_label: "180 g", kcal: 108, protein_g: 19.8, fat_g: 0, carbs_g: 7.2, is_supplement: false },
    { order_index: 4, name: "Pão sem glúten", quantity_label: "1 Fatia (38 g)", kcal: 95, protein_g: 1.1, fat_g: 1.5, carbs_g: 19, is_supplement: false },
    { order_index: 5, name: "Queijo gouda", quantity_label: "15 g", kcal: 53, protein_g: 3.7, fat_g: 4.1, carbs_g: 0.3, is_supplement: false },
    { order_index: 6, name: "Ovo cozido/mexido", quantity_label: "1 Unidade (50 g)", kcal: 78, protein_g: 6.5, fat_g: 5.5, carbs_g: 0.6, is_supplement: false },
  ]),
  ...itemsFor("opt-cafe-1", MORNING_SUPPLEMENTS),
  ...itemsFor("opt-cafe-2", MORNING_SUPPLEMENTS),
  ...itemsFor("opt-cafe-3", MORNING_SUPPLEMENTS),
  ...itemsFor("opt-cafe-4", MORNING_SUPPLEMENTS),

  ...itemsFor("opt-almoco", [
    { order_index: 1, name: "Salada de folhas", quantity_label: "À vontade", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, is_supplement: false },
    { order_index: 2, name: "Azeite de oliva", quantity_label: "1 Colher de sobremesa rasa (5 mL)", kcal: 41, protein_g: 0, fat_g: 4.6, carbs_g: 0, is_supplement: false },
    { order_index: 3, name: "Salmão grelhado", quantity_label: "130 g", kcal: 270, protein_g: 26, fat_g: 16.9, carbs_g: 0, is_supplement: false },
    { order_index: 4, name: "Arroz branco", quantity_label: "3 Colheres de sopa (60 g)", kcal: 78, protein_g: 1.6, fat_g: 0.2, carbs_g: 16.8, is_supplement: false },
    { order_index: 5, name: "Beterraba, cenoura, abóbora...", quantity_label: "À vontade", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, is_supplement: false },
    { order_index: 6, name: "Laranja", quantity_label: "1 Unidade (140 g)", kcal: 66, protein_g: 1.3, fat_g: 0.1, carbs_g: 16.5, is_supplement: false },
    { order_index: 7, name: "Barra de proteína RX Bar", quantity_label: "0,5 barra (26 g)", kcal: 105, protein_g: 6, fat_g: 3.5, carbs_g: 11.5, is_supplement: false },
    { order_index: 8, name: "Ômega-3", quantity_label: "1 cápsula", kcal: 9, protein_g: 0, fat_g: 1, carbs_g: 0, is_supplement: true },
    { order_index: 9, name: "Morosil", quantity_label: "1 dose (250 mg) — antes do almoço", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, is_supplement: true },
    { order_index: 10, name: "Rhodiola rosea", quantity_label: "1 dose (150 mg) — 10h", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, is_supplement: true },
  ]),

  ...itemsFor("opt-lanche1-1", [
    { order_index: 1, name: "Orgain Vegan Protein Shake", quantity_label: "1 caixinha (330 mL)", kcal: 220, protein_g: 20, fat_g: 7, carbs_g: 23, is_supplement: false },
    { order_index: 2, name: "Banana", quantity_label: "1 Unidade (70 g)", kcal: 62, protein_g: 0.8, fat_g: 0.2, carbs_g: 16, is_supplement: false },
  ]),
  ...itemsFor("opt-lanche1-1", LANCHE_SUPPLEMENTS),
  ...itemsFor("opt-lanche1-2", LANCHE_SUPPLEMENTS),
  ...itemsFor("opt-lanche1-3", LANCHE_SUPPLEMENTS),
  ...itemsFor("opt-lanche1-4", LANCHE_SUPPLEMENTS),

  ...itemsFor("opt-postreino", [
    { order_index: 1, name: "Água", quantity_label: "200 mL", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, is_supplement: false },
    { order_index: 2, name: "Proteína do Colágeno Neutro", quantity_label: "20 g", kcal: 72, protein_g: 18, fat_g: 0, carbs_g: 0, is_supplement: true },
    { order_index: 3, name: "Suco prensado (rosa, verde, laranja...)", quantity_label: "240 mL", kcal: 120, protein_g: 1, fat_g: 0.2, carbs_g: 29, is_supplement: false },
  ]),

  ...itemsFor("opt-jantar-3", [
    { order_index: 1, name: "Farelo de aveia", quantity_label: "4 Colheres de sopa (40 g)", kcal: 98, protein_g: 6.9, fat_g: 2.8, carbs_g: 26.5, is_supplement: false },
    { order_index: 2, name: "Frango desfiado", quantity_label: "5 Colheres de sopa cheias (100 g)", kcal: 165, protein_g: 31, fat_g: 3.6, carbs_g: 0, is_supplement: false },
    { order_index: 3, name: "Queijo cottage", quantity_label: "2 Colheres de sopa (50 g)", kcal: 49, protein_g: 5.5, fat_g: 2.2, carbs_g: 1.7, is_supplement: false },
    { order_index: 4, name: "Semente de gergelim", quantity_label: "1 Colher de sobremesa (10 g)", kcal: 57, protein_g: 1.8, fat_g: 5, carbs_g: 2.3, is_supplement: false },
  ]),
  ...itemsFor("opt-jantar-1", JANTAR_SUPPLEMENTS),
  ...itemsFor("opt-jantar-2", JANTAR_SUPPLEMENTS),
  ...itemsFor("opt-jantar-3", JANTAR_SUPPLEMENTS),
  ...itemsFor("opt-jantar-4", JANTAR_SUPPLEMENTS),
  ...itemsFor("opt-jantar-5", JANTAR_SUPPLEMENTS),
];
