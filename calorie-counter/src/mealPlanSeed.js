// Bundled copy of "Plano Alimentar XV" (see sql/seed_meal_plan_xv.sql for
// the full provenance notes — same content, kept in sync by hand since
// there are two targets: the real Supabase project, and this local-mode
// fallback for when it isn't reachable). Used only by localClient.js to
// pre-populate the meal_plan_* tables when running without a Supabase
// connection, so the Plano view works immediately with no setup.
//
// IDs are stable short strings (not real UUIDs) — fine for local mode,
// where nothing ever has to match a server-generated id.
//
// Bump this on every change to the arrays below (even a single item's
// macros) — localClient.js compares it on load and re-seeds the
// meal_plan_* tables from scratch when it doesn't match what's stored,
// which is the only way an update to this file ever reaches a browser
// that already has local data saved. Without it, local mode's plan view
// would stay frozen at whatever was seeded the very first time the
// person used it, silently missing every later fix.
export const MEAL_PLAN_SEED_VERSION = 6;

// `defaultTiming` applies to every row unless the row itself sets its
// own supplement_timing (needed where a group mixes "antes" and
// "depois", like JANTAR_SUPPLEMENTS below).
function supplementRows(names, defaultTiming) {
  return names.map((n, i) => ({ order_index: 100 + i, supplement_timing: defaultTiming, ...n, is_supplement: true }));
}

// Taken as separate doses "após o café da manhã" — not mixed into the
// food, so they render in their own "depois" block.
const MORNING_SUPPLEMENTS = supplementRows(
  [
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
  ],
  "depois"
);

// Both taken as separate doses before the snack.
const LANCHE_SUPPLEMENTS = supplementRows(
  [
    { name: "Rhodiola rosea", quantity_label: "1 dose (150 mg) — 17h", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
    { name: "Gengibre extrato seco", quantity_label: "1 dose (500 mg)", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
  ],
  "antes"
);

const JANTAR_SUPPLEMENTS = supplementRows([
  { name: "Morosil", quantity_label: "1 dose (250 mg) — antes do jantar", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, supplement_timing: "antes" },
  { name: "Magnésio Inositol Relief 3.0", quantity_label: "1 dose — antes de dormir", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, supplement_timing: "depois" },
]);

export const MEAL_PLAN_SLOTS = [
  { id: "slot-ciclo", order_index: 0, time_label: null, title: "Ciclo das sementes", meal_type: "breakfast" },
  { id: "slot-jejum", order_index: 1, time_label: "06:00", title: "Em jejum", meal_type: "breakfast" },
  { id: "slot-shot", order_index: 2, time_label: "06:05", title: "Shot", meal_type: "breakfast" },
  { id: "slot-cafe", order_index: 3, time_label: "07:00", title: "Café da manhã", meal_type: "breakfast" },
  { id: "slot-almoco", order_index: 4, time_label: null, title: "Almoço", meal_type: "lunch" },
  { id: "slot-lanche1", order_index: 5, time_label: null, title: "Lanche I", meal_type: "afternoon_snack" },
  { id: "slot-postreino", order_index: 6, time_label: null, title: "Pós-treino", meal_type: "afternoon_snack" },
  { id: "slot-jantar", order_index: 7, time_label: null, title: "Jantar", meal_type: "dinner" },
];

const CYCLE_OBSERVATION =
  "Pode acrescentar em qualquer refeição — a sugestão é colocar nas que já estão no plano (ex.: no café da manhã).";

export const MEAL_PLAN_OPTIONS = [
  {
    id: "opt-ciclo-1",
    slot_id: "slot-ciclo",
    option_number: 1,
    option_label: "1º ao 14º dia (dia que menstrua)",
    observations: CYCLE_OBSERVATION,
  },
  {
    id: "opt-ciclo-2",
    slot_id: "slot-ciclo",
    option_number: 2,
    option_label: "15º ao 28º dia",
    observations: CYCLE_OBSERVATION,
  },

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
  { id: "opt-cafe-2", slot_id: "slot-cafe", option_number: 2, option_label: "Pudim de chia", observations: null },
  { id: "opt-cafe-3", slot_id: "slot-cafe", option_number: 3, option_label: "Mingau", observations: null },
  { id: "opt-cafe-4", slot_id: "slot-cafe", option_number: 4, option_label: "Pós-treino", observations: null },

  { id: "opt-almoco", slot_id: "slot-almoco", option_number: null, option_label: "Saladão", observations: null },

  { id: "opt-lanche1-1", slot_id: "slot-lanche1", option_number: 1, option_label: "Prático", observations: null },
  {
    id: "opt-lanche1-2",
    slot_id: "slot-lanche1",
    option_number: 2,
    option_label: "Banana + pasta de castanhas",
    observations: null,
  },
  { id: "opt-lanche1-3", slot_id: "slot-lanche1", option_number: 3, option_label: "Pipoca + shake com morango", observations: null },
  {
    id: "opt-lanche1-4",
    slot_id: "slot-lanche1",
    option_number: 4,
    option_label: "Pudim de chia (igual ao café da manhã)",
    observations: null,
  },

  {
    id: "opt-postreino",
    slot_id: "slot-postreino",
    option_number: null,
    option_label: null,
    observations: "Prescrição original — Proteína do colágeno - 1 dose (20 g).",
  },

  { id: "opt-jantar-1", slot_id: "slot-jantar", option_number: 1, option_label: "Shake", observations: null },
  { id: "opt-jantar-2", slot_id: "slot-jantar", option_number: 2, option_label: "Sopa + proteína", observations: null },
  { id: "opt-jantar-3", slot_id: "slot-jantar", option_number: 3, option_label: "Rap 10 caseiro", observations: null },
  { id: "opt-jantar-4", slot_id: "slot-jantar", option_number: 4, option_label: "Quiche sem massa", observations: null },
  { id: "opt-jantar-5", slot_id: "slot-jantar", option_number: 5, option_label: "Tilápia + batata doce", observations: null },
];

// Global counter, not per-call — itemsFor() is called more than once for
// the same option_id (food items, then supplements added separately), and
// a per-call index would collide and produce duplicate ids.
let nextItemId = 0;
function itemsFor(optionId, rows) {
  return rows.map((r) => ({ id: `item-${nextItemId++}`, option_id: optionId, ...r }));
}

export const MEAL_PLAN_ITEMS = [
  ...itemsFor("opt-ciclo-1", [
    { order_index: 1, name: "Semente de abóbora", quantity_label: "1 Colher de sopa (15 g)", kcal: 84, protein_g: 5, fat_g: 7, carbs_g: 2, is_supplement: false },
    { order_index: 2, name: "Semente de linhaça", quantity_label: "1 Colher de sopa (10 g)", kcal: 53, protein_g: 2, fat_g: 4, carbs_g: 3, is_supplement: false },
  ]),
  ...itemsFor("opt-ciclo-2", [
    { order_index: 1, name: "Semente de girassol", quantity_label: "1 Colher de sopa (9 g)", kcal: 53, protein_g: 2, fat_g: 5, carbs_g: 2, is_supplement: false },
    { order_index: 2, name: "Semente de gergelim", quantity_label: "1 Colher de sopa (9 g)", kcal: 51, protein_g: 2, fat_g: 5, carbs_g: 2, is_supplement: false },
  ]),

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

  ...itemsFor("opt-cafe-2", [
    { order_index: 1, name: "Morangos (e frutas vermelhas)", quantity_label: "1 Xícara de chá (120 g)", kcal: 38, protein_g: 1, fat_g: 0.3, carbs_g: 9, is_supplement: false, substitution_group: "g1" },
    { order_index: 2, name: "Banana", quantity_label: "1 Unidade (70 g)", kcal: 62, protein_g: 0.8, fat_g: 0.2, carbs_g: 16, is_supplement: false },
    { order_index: 3, name: "Iogurte Oikos Triple Zero Plain EUA", quantity_label: "180 g", kcal: 108, protein_g: 19.8, fat_g: 0, carbs_g: 7.2, is_supplement: false },
    { order_index: 4, name: "Proteína do Colágeno Neutro", quantity_label: "0,5 Dosador cheio (13 g)", kcal: 47, protein_g: 12, fat_g: 0, carbs_g: 0, is_supplement: true },
    { order_index: 5, name: "Chia (semente)", quantity_label: "1 Colher de sopa (12 g)", kcal: 58, protein_g: 2, fat_g: 3.7, carbs_g: 5, is_supplement: false },
    { order_index: 6, name: "Farelo de aveia", quantity_label: "2 Colheres de sopa (20 g)", kcal: 49, protein_g: 3.5, fat_g: 1.4, carbs_g: 13.2, is_supplement: false },
    { order_index: 7, name: "Kiwi", quantity_label: "1 Unidade (94 g)", kcal: 57, protein_g: 1, fat_g: 0.5, carbs_g: 14, is_supplement: false, substitution_group: "g1" },
  ]),

  ...itemsFor("opt-cafe-3", [
    { order_index: 1, name: "Leite de amêndoas", quantity_label: "200 mL", kcal: 34, protein_g: 1, fat_g: 3, carbs_g: 1, is_supplement: false },
    { order_index: 2, name: "Proteína do Colágeno Neutro", quantity_label: "1 Dosador cheio (26 g)", kcal: 94, protein_g: 23, fat_g: 0, carbs_g: 0, is_supplement: true },
    { order_index: 3, name: "Banana", quantity_label: "1 Unidade (70 g)", kcal: 62, protein_g: 0.8, fat_g: 0.2, carbs_g: 16, is_supplement: false, substitution_group: "g1" },
    { order_index: 4, name: "Farelo de aveia", quantity_label: "2 Colheres de sopa cheias (30 g)", kcal: 74, protein_g: 5, fat_g: 2, carbs_g: 20, is_supplement: false },
    { order_index: 5, name: "Chia (semente)", quantity_label: "2 Colheres de sobremesa (20 g)", kcal: 97, protein_g: 3, fat_g: 6, carbs_g: 8, is_supplement: false, substitution_group: "g2" },
    { order_index: 6, name: "Canela em pó", quantity_label: "À vontade", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, is_supplement: false },
    { order_index: 7, name: "Maçã", quantity_label: "1 Unidade (130 g)", kcal: 68, protein_g: 0.4, fat_g: 0.3, carbs_g: 18, is_supplement: false, substitution_group: "g1" },
    { order_index: 8, name: "Nibs de cacau", quantity_label: "1 Colher de sopa cheia (15 g)", kcal: 72, protein_g: 2, fat_g: 7, carbs_g: 4, is_supplement: false, substitution_group: "g2" },
  ]),

  ...itemsFor("opt-cafe-4", [
    { order_index: 1, name: "Leite de cânhamo", quantity_label: "1 Copo (240 mL)", kcal: 134, protein_g: 5, fat_g: 8, carbs_g: 8, is_supplement: false },
    { order_index: 2, name: "Proteína do Colágeno Neutro", quantity_label: "1 Dosador cheio (26 g)", kcal: 94, protein_g: 23, fat_g: 0, carbs_g: 0, is_supplement: true },
    { order_index: 3, name: "Banana", quantity_label: "1 Unidade (70 g)", kcal: 62, protein_g: 0.8, fat_g: 0.2, carbs_g: 16, is_supplement: false },
    { order_index: 4, name: "Frutas vermelhas", quantity_label: "1 Xícara de chá (120 mL)", kcal: 60, protein_g: 1, fat_g: 0.5, carbs_g: 14, is_supplement: false },
    { order_index: 5, name: "Farelo de aveia", quantity_label: "2 Colheres de sopa (20 g)", kcal: 49, protein_g: 3.5, fat_g: 1.4, carbs_g: 13.2, is_supplement: false },
    { order_index: 6, name: "Chia (semente)", quantity_label: "1 Colher de sopa (12 g)", kcal: 58, protein_g: 2, fat_g: 3.7, carbs_g: 5, is_supplement: false },
  ]),
  ...itemsFor("opt-cafe-1", MORNING_SUPPLEMENTS),
  ...itemsFor("opt-cafe-2", MORNING_SUPPLEMENTS),
  ...itemsFor("opt-cafe-3", MORNING_SUPPLEMENTS),
  ...itemsFor("opt-cafe-4", MORNING_SUPPLEMENTS),

  ...itemsFor("opt-almoco", [
    { order_index: 1, name: "Salada de folhas", quantity_label: "À vontade", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, is_supplement: false },
    { order_index: 2, name: "Azeite de oliva", quantity_label: "1 Colher de sobremesa rasa (5 mL)", kcal: 41, protein_g: 0, fat_g: 4.6, carbs_g: 0, is_supplement: false },
    { order_index: 3, name: "Salmão grelhado", quantity_label: "130 g", kcal: 270, protein_g: 26, fat_g: 16.9, carbs_g: 0, is_supplement: false, substitution_group: "g1" },
    { order_index: 4, name: "Arroz branco", quantity_label: "3 Colheres de sopa (60 g)", kcal: 78, protein_g: 1.6, fat_g: 0.2, carbs_g: 16.8, is_supplement: false, substitution_group: "g2" },
    { order_index: 5, name: "Beterraba, cenoura, abóbora...", quantity_label: "À vontade", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, is_supplement: false },
    { order_index: 6, name: "Laranja", quantity_label: "1 Unidade (140 g)", kcal: 66, protein_g: 1.3, fat_g: 0.1, carbs_g: 16.5, is_supplement: false, substitution_group: "g3" },
    { order_index: 7, name: "Barra de proteína RX Bar", quantity_label: "0,5 barra (26 g)", kcal: 105, protein_g: 6, fat_g: 3.5, carbs_g: 11.5, is_supplement: false },
    // "junto com alguma refeição" (unspecified) — anchored here as a
    // neutral main meal; "antes do almoço" and the 10h dose, both
    // exactly as prescribed for this slot.
    { order_index: 8, name: "Ômega-3", quantity_label: "1 cápsula", kcal: 9, protein_g: 0, fat_g: 1, carbs_g: 0, is_supplement: true, supplement_timing: "depois" },
    { order_index: 9, name: "Morosil", quantity_label: "1 dose (250 mg) — antes do almoço", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, is_supplement: true, supplement_timing: "antes" },
    { order_index: 10, name: "Rhodiola rosea", quantity_label: "1 dose (150 mg) — 10h", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, is_supplement: true, supplement_timing: "antes" },
    { order_index: 11, name: "Peito de frango grelhado", quantity_label: "1 Filé grande (180 g)", kcal: 297, protein_g: 56, fat_g: 6.5, carbs_g: 0, is_supplement: false, substitution_group: "g1" },
    { order_index: 12, name: "Batata inglesa cozida", quantity_label: "5 Colheres de sopa (150 g)", kcal: 131, protein_g: 3, fat_g: 0, carbs_g: 30, is_supplement: false, substitution_group: "g2" },
    { order_index: 13, name: "Quinoa em grão cozida", quantity_label: "2,5 Colheres de sopa cheias (62,5 g)", kcal: 75, protein_g: 3, fat_g: 1, carbs_g: 13, is_supplement: false, substitution_group: "g2" },
    { order_index: 14, name: "Tangerina", quantity_label: "1 Unidade (135 g)", kcal: 72, protein_g: 1, fat_g: 0.4, carbs_g: 18, is_supplement: false, substitution_group: "g3" },
    { order_index: 15, name: "Abacaxi", quantity_label: "2 Rodelas (150 g)", kcal: 75, protein_g: 1, fat_g: 0, carbs_g: 20, is_supplement: false, substitution_group: "g3" },
  ]),

  ...itemsFor("opt-lanche1-1", [
    { order_index: 1, name: "Orgain Vegan Protein Shake", quantity_label: "1 caixinha (330 mL)", kcal: 220, protein_g: 20, fat_g: 7, carbs_g: 23, is_supplement: false },
    { order_index: 2, name: "Banana", quantity_label: "1 Unidade (70 g)", kcal: 62, protein_g: 0.8, fat_g: 0.2, carbs_g: 16, is_supplement: false, substitution_group: "g1" },
    { order_index: 3, name: "Morango", quantity_label: "8 Unidades (96 g)", kcal: 31, protein_g: 0.7, fat_g: 0.3, carbs_g: 7, is_supplement: false, substitution_group: "g1" },
    { order_index: 4, name: "Manga", quantity_label: "5 Colheres de sopa (110 g)", kcal: 66, protein_g: 0.9, fat_g: 0.4, carbs_g: 17, is_supplement: false, substitution_group: "g1" },
    { order_index: 5, name: "Tangerina", quantity_label: "1 Unidade (135 g)", kcal: 72, protein_g: 1.1, fat_g: 0.4, carbs_g: 18, is_supplement: false, substitution_group: "g1" },
    { order_index: 6, name: "Uva", quantity_label: "15 Unidades (75 g)", kcal: 52, protein_g: 0.5, fat_g: 0.2, carbs_g: 14, is_supplement: false, substitution_group: "g1" },
    { order_index: 7, name: "Maçã pequena", quantity_label: "1 Unidade (90 g)", kcal: 47, protein_g: 0.3, fat_g: 0.2, carbs_g: 12, is_supplement: false, substitution_group: "g1" },
    { order_index: 8, name: "Melancia", quantity_label: "1 Fatia grande (200 g)", kcal: 60, protein_g: 1.2, fat_g: 0.4, carbs_g: 16, is_supplement: false, substitution_group: "g1" },
    { order_index: 9, name: "Melão", quantity_label: "2 Fatias médias (200 g)", kcal: 68, protein_g: 1.6, fat_g: 0.4, carbs_g: 16, is_supplement: false, substitution_group: "g1" },
    { order_index: 10, name: "Kiwi", quantity_label: "1 Unidade (94 g)", kcal: 57, protein_g: 1, fat_g: 0.5, carbs_g: 14, is_supplement: false, substitution_group: "g1" },
  ]),
  ...itemsFor("opt-lanche1-2", [
    { order_index: 1, name: "Banana", quantity_label: "1 Unidade (70 g)", kcal: 62, protein_g: 0.8, fat_g: 0.2, carbs_g: 16, is_supplement: false, substitution_group: "g1" },
    { order_index: 2, name: "Pasta de Castanha de Caju", quantity_label: "1 Colher de sopa (15 g)", kcal: 88, protein_g: 3, fat_g: 7, carbs_g: 4, is_supplement: false },
    { order_index: 3, name: "Proteína do Colágeno Neutro", quantity_label: "20 g", kcal: 72, protein_g: 18, fat_g: 0, carbs_g: 0, is_supplement: true },
    { order_index: 4, name: "Morangos", quantity_label: "5 Unidades (60 g)", kcal: 19, protein_g: 0.4, fat_g: 0.2, carbs_g: 5, is_supplement: false, substitution_group: "g1" },
    { order_index: 5, name: "Uvas", quantity_label: "10 Unidades (50 g)", kcal: 35, protein_g: 0.4, fat_g: 0.1, carbs_g: 9, is_supplement: false, substitution_group: "g1" },
  ]),
  ...itemsFor("opt-lanche1-3", [
    { order_index: 1, name: "Proteína do Colágeno Neutro", quantity_label: "20 g", kcal: 72, protein_g: 18, fat_g: 0, carbs_g: 0, is_supplement: true },
    { order_index: 2, name: "Morango", quantity_label: "1 Xícara de chá (120 mL)", kcal: 38, protein_g: 1, fat_g: 0, carbs_g: 9, is_supplement: false },
    { order_index: 3, name: "Pipoca doce ou salgada", quantity_label: "20 g", kcal: 77, protein_g: 3, fat_g: 1, carbs_g: 16, is_supplement: false },
  ]),
  ...itemsFor("opt-lanche1-4", [
    { order_index: 1, name: "Morangos (e frutas vermelhas)", quantity_label: "1 Xícara de chá (120 g)", kcal: 38, protein_g: 1, fat_g: 0.3, carbs_g: 9, is_supplement: false },
    { order_index: 2, name: "Banana", quantity_label: "1 Unidade (70 g)", kcal: 62, protein_g: 0.8, fat_g: 0.2, carbs_g: 16, is_supplement: false },
    { order_index: 3, name: "Iogurte Oikos Triple Zero Plain EUA", quantity_label: "180 g", kcal: 108, protein_g: 19.8, fat_g: 0, carbs_g: 7.2, is_supplement: false },
    { order_index: 4, name: "Proteína do Colágeno Neutro", quantity_label: "0,5 Dosador cheio (13 g)", kcal: 47, protein_g: 12, fat_g: 0, carbs_g: 0, is_supplement: true },
    { order_index: 5, name: "Chia (semente)", quantity_label: "1 Colher de sopa (12 g)", kcal: 58, protein_g: 2, fat_g: 3.7, carbs_g: 5, is_supplement: false },
    { order_index: 6, name: "Farelo de aveia", quantity_label: "2 Colheres de sopa (20 g)", kcal: 49, protein_g: 3.5, fat_g: 1.4, carbs_g: 13.2, is_supplement: false },
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

  ...itemsFor("opt-jantar-1", [
    { order_index: 1, name: "Frutas vermelhas", quantity_label: "1 Xícara de chá (120 g)", kcal: 60, protein_g: 1, fat_g: 0.5, carbs_g: 14, is_supplement: false },
    { order_index: 2, name: "Banana", quantity_label: "1 Unidade (70 g)", kcal: 62, protein_g: 0.8, fat_g: 0.2, carbs_g: 16, is_supplement: false, substitution_group: "g1" },
    { order_index: 3, name: "Iogurte Oikos Triple Zero Plain EUA", quantity_label: "180 g", kcal: 108, protein_g: 19.8, fat_g: 0, carbs_g: 7.2, is_supplement: false },
    { order_index: 4, name: "Proteína do Colágeno Neutro", quantity_label: "20 g", kcal: 72, protein_g: 18, fat_g: 0, carbs_g: 0, is_supplement: true },
    { order_index: 5, name: "Hemp Seeds (semente de cânhamo)", quantity_label: "1,5 Colheres de sopa (15 g)", kcal: 83, protein_g: 5, fat_g: 7, carbs_g: 1, is_supplement: false },
    { order_index: 6, name: "Mel", quantity_label: "1 Colher de sopa (15 g)", kcal: 46, protein_g: 0, fat_g: 0, carbs_g: 12, is_supplement: false, substitution_group: "g1" },
  ]),
  ...itemsFor("opt-jantar-2", [
    { order_index: 1, name: "Sopa de legumes, abóbora, brócolis etc", quantity_label: "3 Conchas cheias (390 g)", kcal: 137, protein_g: 6, fat_g: 4, carbs_g: 23, is_supplement: false },
    { order_index: 2, name: "Frango desfiado", quantity_label: "5 Colheres de sopa cheias (100 g)", kcal: 165, protein_g: 31, fat_g: 3.6, carbs_g: 0, is_supplement: false, substitution_group: "g1" },
    { order_index: 3, name: "Folha de espinafre crua", quantity_label: "1 Xícara de chá (30 g)", kcal: 7, protein_g: 1, fat_g: 0, carbs_g: 1, is_supplement: false },
    { order_index: 4, name: "Azeite de oliva", quantity_label: "1 Colher de sobremesa rasa (5 mL)", kcal: 41, protein_g: 0, fat_g: 4.6, carbs_g: 0, is_supplement: false },
    { order_index: 5, name: "Semente de abóbora inteira torrada", quantity_label: "1 Colher de sopa rasa (15 g)", kcal: 84, protein_g: 5, fat_g: 7, carbs_g: 2, is_supplement: false },
    { order_index: 6, name: "Proteína do Colágeno Neutro", quantity_label: "1,5 Dosadores cheios (39 g)", kcal: 140, protein_g: 35, fat_g: 0, carbs_g: 0, is_supplement: true, substitution_group: "g1" },
  ]),
  ...itemsFor("opt-jantar-3", [
    { order_index: 1, name: "Farelo de aveia", quantity_label: "4 Colheres de sopa (40 g)", kcal: 98, protein_g: 6.9, fat_g: 2.8, carbs_g: 26.5, is_supplement: false },
    { order_index: 2, name: "Frango desfiado", quantity_label: "5 Colheres de sopa cheias (100 g)", kcal: 165, protein_g: 31, fat_g: 3.6, carbs_g: 0, is_supplement: false },
    { order_index: 3, name: "Queijo cottage", quantity_label: "2 Colheres de sopa (50 g)", kcal: 49, protein_g: 5.5, fat_g: 2.2, carbs_g: 1.7, is_supplement: false },
    { order_index: 4, name: "Semente de gergelim", quantity_label: "1 Colher de sobremesa (10 g)", kcal: 57, protein_g: 1.8, fat_g: 5, carbs_g: 2.3, is_supplement: false },
  ]),
  ...itemsFor("opt-jantar-4", [
    { order_index: 1, name: "Ovo", quantity_label: "2 Unidades (100 g)", kcal: 156, protein_g: 13, fat_g: 11, carbs_g: 1, is_supplement: false },
    { order_index: 2, name: "Iogurte Oikos Triple Zero Plain EUA", quantity_label: "100 g", kcal: 60, protein_g: 11, fat_g: 0, carbs_g: 4, is_supplement: false },
    { order_index: 3, name: "Queijo cottage", quantity_label: "2 Colheres de sopa (50 g)", kcal: 49, protein_g: 5.5, fat_g: 2.2, carbs_g: 1.7, is_supplement: false },
    { order_index: 4, name: "Espinafre", quantity_label: "1 Porção (67 g)", kcal: 15, protein_g: 2, fat_g: 0, carbs_g: 2, is_supplement: false, substitution_group: "g1" },
    { order_index: 5, name: "Barra de proteína RX Bar", quantity_label: "0,5 barra (26 g)", kcal: 105, protein_g: 6, fat_g: 3.5, carbs_g: 11.5, is_supplement: false },
    { order_index: 6, name: "Couve", quantity_label: "2 Folhas (50 g)", kcal: 18, protein_g: 1.5, fat_g: 0.3, carbs_g: 3, is_supplement: false, substitution_group: "g1" },
    { order_index: 7, name: "Cebola", quantity_label: "40 g", kcal: 16, protein_g: 0.4, fat_g: 0, carbs_g: 4, is_supplement: false, substitution_group: "g1" },
  ]),
  ...itemsFor("opt-jantar-5", [
    { order_index: 1, name: "Filé de tilápia grelhado", quantity_label: "1 Filé grande (150 g)", kcal: 192, protein_g: 39, fat_g: 4, carbs_g: 0, is_supplement: false },
    { order_index: 2, name: "Batata doce cozida", quantity_label: "2 Fatias (140 g)", kcal: 120, protein_g: 2, fat_g: 0, carbs_g: 28, is_supplement: false },
    { order_index: 3, name: "Semente de abóbora inteira torrada", quantity_label: "1,5 Colheres de sobremesa rasas (15 g)", kcal: 84, protein_g: 5, fat_g: 7, carbs_g: 2, is_supplement: false },
  ]),
  ...itemsFor("opt-jantar-1", JANTAR_SUPPLEMENTS),
  ...itemsFor("opt-jantar-2", JANTAR_SUPPLEMENTS),
  ...itemsFor("opt-jantar-3", JANTAR_SUPPLEMENTS),
  ...itemsFor("opt-jantar-4", JANTAR_SUPPLEMENTS),
  ...itemsFor("opt-jantar-5", JANTAR_SUPPLEMENTS),
];
