-- Seeds "Plano Alimentar XV" (the nutritionist's current plan) into the
-- meal_plan_* tables added by migrations/008_add_meal_plan.sql — run that
-- migration (or schema.sql on a fresh install) first, then run this once.
--
-- Re-running this script is safe: it deletes the previous "Plano
-- Alimentar XV" slots (cascading to their options/items) before
-- re-inserting, so you can paste an updated version of this file after
-- a plan revision without manually cleaning up first. It does NOT touch
-- food_logs — anything already logged stays logged.
--
-- SOURCE — transcribed from the nutritionist's own PDF ("Plano Alimentar
-- XV A - Janiele Custódio", Isabel Vieira, emitted 25/11/2026), so every
-- slot/option/item below is complete and confirmed — no empty
-- placeholders left.
--
-- IMPORTANT — macro values below are still estimates, not verified
-- nutrition facts: the PDF gives quantities but no kcal/macros, and I
-- don't have access to USDA/brand label data for the specific products
-- (Oikos Triple Zero, Orgain, RX Bar, etc.) from here, so I estimated
-- from typical values per 100g/mL for each food and scaled to the
-- plan's quantity. Treat these as "close enough to track trends", not
-- exact — worth spot-checking against the real labels when you have a
-- moment, especially for the branded products.
--
-- ITEM-LEVEL SUBSTITUTIONS ("ou X") — the PDF lists an alternate food for
-- many items (e.g. "Salmão grelhado ou Peito de frango grelhado"). The
-- schema only models one food per item row (no per-item substitution
-- list), so these are folded into each option's `observations` text
-- instead of separate rows — same approach already used for the
-- egg/cheese swap in Café da manhã Opção 1.
--
-- SUPPLEMENTS from the "Suplementação EUA + Brasil IX" PDF that don't
-- appear in a specific slot are placed in whichever existing slot is
-- closest to their prescribed timing (per instruction — this is a
-- best-fit placement):
--   Vitamina D, Ferro, Red Yeast Rice + CoQ10, manipulado (zinco/
--     selênio/magnésio/B6/B2/B9/B12/colina/vit C/PQQ/vit E)
--     -> "pela manhã" / "após café da manhã" -> Café da manhã
--   Ômega-3 ("junto com alguma refeição", unspecified)
--     -> Almoço, as a neutral anchor meal
--   Morosil ("antes do almoço e antes do jantar") -> split: Almoço + Jantar
--   Rhodiola ("10h e 17h") -> split: Almoço (nearest to 10h) + Lanche I
--     (nearest to 17h)
--   Gengibre ("junto com a refeição antes do treino") -> Lanche I, the
--     slot right before Pós-treino
--   Magnésio Inositol ("à noite antes de dormir") -> Jantar, the last
--     meal of the day
-- A supplement isn't tied to which food option you pick, so it's added
-- to EVERY option of a multi-option slot (Café da manhã, Lanche I,
-- Jantar), not just one.
--
-- NOT YET MODELED — two things from the PDF's "Orientações" page don't
-- fit the meal-item structure and aren't included here; flagged for a
-- separate decision rather than guessed at:
--   Ciclo das sementes (seed cycling) — alternates which seeds to add
--     depending on day of the menstrual cycle, not a fixed daily item.
--   Hidratação — a 2.5 L/day water target. There's an unused water_logs
--     table in the schema already (migration 006) but no UI built on it.

delete from public.meal_plan_slots where title in (
  'Em jejum', 'Shot', 'Café da manhã', 'Almoço', 'Lanche I', 'Pós-treino', 'Jantar'
);

do $$
declare
  v_slot_id uuid;
  v_opt_id uuid;
begin

  -- ── Em jejum (06:00) ──────────────────────────────────────────────
  insert into public.meal_plan_slots (order_index, time_label, title, meal_type)
  values (1, '06:00', 'Em jejum', 'breakfast')
  returning id into v_slot_id;

  insert into public.meal_plan_options (slot_id, option_number, option_label)
  values (v_slot_id, null, null)
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement)
  values (v_opt_id, 1, 'Água', '500 mL', 0, 0, 0, 0, false);

  -- ── Shot (06:05) ──────────────────────────────────────────────────
  insert into public.meal_plan_slots (order_index, time_label, title, meal_type)
  values (2, '06:05', 'Shot', 'breakfast')
  returning id into v_slot_id;

  insert into public.meal_plan_options (slot_id, option_number, option_label, observations)
  values (v_slot_id, null, null,
    'Conferir no PDF: Glutamina - 1 colher medidora (5 g). Prescrição original — Própolis alcoólica - 20 gota.')
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement) values
    (v_opt_id, 1, 'Água', '100 mL', 0, 0, 0, 0, false),
    (v_opt_id, 2, 'Glutamina', '5 g', 20, 5, 0, 0, true),
    (v_opt_id, 3, 'Própolis Alcoólico', '20 Gotas (0,6 mL)', 0, 0, 0, 0, true);

  -- ── Café da manhã (07:00) — 4 options, all confirmed ─────────────
  insert into public.meal_plan_slots (order_index, time_label, title, meal_type)
  values (3, '07:00', 'Café da manhã', 'breakfast')
  returning id into v_slot_id;

  insert into public.meal_plan_options (slot_id, option_number, option_label, observations)
  values (v_slot_id, 1, 'Pão com queijo + iogurte e fruta',
    'Ou substituir ovo + queijo gouda por pastinha de ovo (1 ovo cozido amassado com 1 colher de sopa de queijo cottage + temperos).')
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement) values
    (v_opt_id, 1, 'Frutas vermelhas', '1 Xícara de chá (120 mL)', 60, 1, 0.5, 14, false),
    (v_opt_id, 2, 'Farelo de aveia', '2 Colheres de sopa (20 g)', 49, 3.5, 1.4, 13.2, false),
    (v_opt_id, 3, 'Iogurte Oikos Triple Zero Plain EUA', '180 g', 108, 19.8, 0, 7.2, false),
    (v_opt_id, 4, 'Pão sem glúten', '1 Fatia (38 g)', 95, 1.1, 1.5, 19, false),
    (v_opt_id, 5, 'Queijo gouda', '15 g', 53, 3.7, 4.1, 0.3, false),
    (v_opt_id, 6, 'Ovo cozido/mexido', '1 Unidade (50 g)', 78, 6.5, 5.5, 0.6, false);

  insert into public.meal_plan_options (slot_id, option_number, option_label, observations)
  values (v_slot_id, 2, 'Pudim de chia', 'Ou Kiwi - 1 Unidade (94 g), no lugar das morangos/frutas vermelhas.')
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement) values
    (v_opt_id, 1, 'Morangos (e frutas vermelhas)', '1 Xícara de chá (120 g)', 38, 1, 0.3, 9, false),
    (v_opt_id, 2, 'Banana', '1 Unidade (70 g)', 62, 0.8, 0.2, 16, false),
    (v_opt_id, 3, 'Iogurte Oikos Triple Zero Plain EUA', '180 g', 108, 19.8, 0, 7.2, false),
    (v_opt_id, 4, 'Proteína do Colágeno Neutro', '0,5 Dosador cheio (13 g)', 47, 12, 0, 0, true),
    (v_opt_id, 5, 'Chia (semente)', '1 Colher de sopa (12 g)', 58, 2, 3.7, 5, false),
    (v_opt_id, 6, 'Farelo de aveia', '2 Colheres de sopa (20 g)', 49, 3.5, 1.4, 13.2, false);

  insert into public.meal_plan_options (slot_id, option_number, option_label, observations)
  values (v_slot_id, 3, 'Mingau',
    'Ou Maçã - 1 Unidade (130 g), no lugar da banana. Ou Nibs de cacau - 1 Colher de sopa cheia (15 g), no lugar da chia.')
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement) values
    (v_opt_id, 1, 'Leite de amêndoas', '200 mL', 34, 1, 3, 1, false),
    (v_opt_id, 2, 'Proteína do Colágeno Neutro', '1 Dosador cheio (26 g)', 94, 23, 0, 0, true),
    (v_opt_id, 3, 'Banana', '1 Unidade (70 g)', 62, 0.8, 0.2, 16, false),
    (v_opt_id, 4, 'Farelo de aveia', '2 Colheres de sopa cheias (30 g)', 74, 5, 2, 20, false),
    (v_opt_id, 5, 'Chia (semente)', '2 Colheres de sobremesa (20 g)', 97, 3, 6, 8, false),
    (v_opt_id, 6, 'Canela em pó', 'À vontade', 0, 0, 0, 0, false);

  insert into public.meal_plan_options (slot_id, option_number, option_label)
  values (v_slot_id, 4, 'Pós-treino')
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement) values
    (v_opt_id, 1, 'Leite de cânhamo', '1 Copo (240 mL)', 134, 5, 8, 8, false),
    (v_opt_id, 2, 'Proteína do Colágeno Neutro', '1 Dosador cheio (26 g)', 94, 23, 0, 0, true),
    (v_opt_id, 3, 'Banana', '1 Unidade (70 g)', 62, 0.8, 0.2, 16, false),
    (v_opt_id, 4, 'Frutas vermelhas', '1 Xícara de chá (120 mL)', 60, 1, 0.5, 14, false),
    (v_opt_id, 5, 'Farelo de aveia', '2 Colheres de sopa (20 g)', 49, 3.5, 1.4, 13.2, false),
    (v_opt_id, 6, 'Chia (semente)', '1 Colher de sopa (12 g)', 58, 2, 3.7, 5, false);

  -- Supplements taken "pela manhã" / "após café da manhã" — added to
  -- every option of this slot, see note at the top of this file.
  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement)
  select o.id, 100, v.name, v.qty, v.kcal, v.protein_g, v.fat_g, v.carbs_g, true
  from public.meal_plan_options o
  cross join (values
    ('Vitamina D', '1 dose', 0, 0, 0, 0),
    ('Ferro', '1 dose', 0, 0, 0, 0),
    ('Red Yeast Rice + CoQ10', '2 cápsulas', 0, 0, 0, 0),
    ('Manipulado (zinco, selênio, magnésio, B6, B2, B9, B12, colina, vit. C, PQQ, vit. E)', '1 dose', 0, 0, 0, 0)
  ) as v(name, qty, kcal, protein_g, fat_g, carbs_g)
  where o.slot_id = v_slot_id;

  -- ── Almoço — single fixed option ("Saladão") ──────────────────────
  insert into public.meal_plan_slots (order_index, time_label, title, meal_type)
  values (4, null, 'Almoço', 'lunch')
  returning id into v_slot_id;

  insert into public.meal_plan_options (slot_id, option_number, option_label, observations)
  values (v_slot_id, null, 'Saladão',
    'Ou substituir: salmão grelhado por peito de frango grelhado (1 filé grande, 180 g); arroz branco por batata inglesa cozida (5 colheres de sopa, 150 g) ou quinoa em grão cozida (2,5 colheres de sopa cheias, 62,5 g); laranja por tangerina (135 g) ou abacaxi (2 rodelas, 150 g).')
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement) values
    (v_opt_id, 1, 'Salada de folhas', 'À vontade', 0, 0, 0, 0, false),
    (v_opt_id, 2, 'Azeite de oliva', '1 Colher de sobremesa rasa (5 mL)', 41, 0, 4.6, 0, false),
    (v_opt_id, 3, 'Salmão grelhado', '130 g', 270, 26, 16.9, 0, false),
    (v_opt_id, 4, 'Arroz branco', '3 Colheres de sopa (60 g)', 78, 1.6, 0.2, 16.8, false),
    (v_opt_id, 5, 'Beterraba, cenoura, abóbora...', 'À vontade', 0, 0, 0, 0, false),
    (v_opt_id, 6, 'Laranja', '1 Unidade (140 g)', 66, 1.3, 0.1, 16.5, false),
    (v_opt_id, 7, 'Barra de proteína RX Bar', '0,5 barra (26 g)', 105, 6, 3.5, 11.5, false),
    -- "junto com alguma refeição" (unspecified) — anchored here as a
    -- neutral main meal; "antes do almoço" and the 10h dose, both
    -- exactly as prescribed for this slot.
    (v_opt_id, 8, 'Ômega-3', '1 cápsula', 9, 0, 1, 0, true),
    (v_opt_id, 9, 'Morosil', '1 dose (250 mg) — antes do almoço', 0, 0, 0, 0, true),
    (v_opt_id, 10, 'Rhodiola rosea', '1 dose (150 mg) — 10h', 0, 0, 0, 0, true);

  -- ── Lanche I — 4 options, all confirmed ──────────────────────────
  insert into public.meal_plan_slots (order_index, time_label, title, meal_type)
  values (5, null, 'Lanche I', 'afternoon_snack')
  returning id into v_slot_id;

  insert into public.meal_plan_options (slot_id, option_number, option_label, observations)
  values (v_slot_id, 1, 'Prático',
    'Ou, no lugar da banana: morango (8 unidades, 96 g); manga (5 colheres de sopa, 110 g); tangerina (135 g); uva (15 unidades, 75 g); maçã pequena (90 g); melancia (1 fatia grande, 200 g); melão (2 fatias médias, 200 g); kiwi (94 g).')
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement) values
    (v_opt_id, 1, 'Orgain Vegan Protein Shake', '1 caixinha (330 mL)', 220, 20, 7, 23, false),
    (v_opt_id, 2, 'Banana', '1 Unidade (70 g)', 62, 0.8, 0.2, 16, false);

  insert into public.meal_plan_options (slot_id, option_number, option_label, observations)
  values (v_slot_id, 2, 'Banana + pasta de castanhas',
    'Ou, no lugar da banana: morangos (5 unidades, 60 g); uvas (10 unidades, 50 g).')
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement) values
    (v_opt_id, 1, 'Banana', '1 Unidade (70 g)', 62, 0.8, 0.2, 16, false),
    (v_opt_id, 2, 'Pasta de Castanha de Caju', '1 Colher de sopa (15 g)', 88, 3, 7, 4, false),
    (v_opt_id, 3, 'Proteína do Colágeno Neutro', '20 g', 72, 18, 0, 0, true);

  insert into public.meal_plan_options (slot_id, option_number, option_label)
  values (v_slot_id, 3, 'Pipoca + shake com morango')
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement) values
    (v_opt_id, 1, 'Proteína do Colágeno Neutro', '20 g', 72, 18, 0, 0, true),
    (v_opt_id, 2, 'Morango', '1 Xícara de chá (120 mL)', 38, 1, 0, 9, false),
    (v_opt_id, 3, 'Pipoca doce ou salgada', '20 g', 77, 3, 1, 16, false);

  insert into public.meal_plan_options (slot_id, option_number, option_label)
  values (v_slot_id, 4, 'Pudim de chia (igual ao café da manhã)')
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement) values
    (v_opt_id, 1, 'Morangos (e frutas vermelhas)', '1 Xícara de chá (120 g)', 38, 1, 0.3, 9, false),
    (v_opt_id, 2, 'Banana', '1 Unidade (70 g)', 62, 0.8, 0.2, 16, false),
    (v_opt_id, 3, 'Iogurte Oikos Triple Zero Plain EUA', '180 g', 108, 19.8, 0, 7.2, false),
    (v_opt_id, 4, 'Proteína do Colágeno Neutro', '0,5 Dosador cheio (13 g)', 47, 12, 0, 0, true),
    (v_opt_id, 5, 'Chia (semente)', '1 Colher de sopa (12 g)', 58, 2, 3.7, 5, false),
    (v_opt_id, 6, 'Farelo de aveia', '2 Colheres de sopa (20 g)', 49, 3.5, 1.4, 13.2, false);

  -- Rhodiola's 17h dose + gengibre ("antes do treino", the slot right
  -- before Pós-treino) — added to every option of this slot.
  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement)
  select o.id, 100, v.name, v.qty, v.kcal, v.protein_g, v.fat_g, v.carbs_g, true
  from public.meal_plan_options o
  cross join (values
    ('Rhodiola rosea', '1 dose (150 mg) — 17h', 0, 0, 0, 0),
    ('Gengibre extrato seco', '1 dose (500 mg)', 0, 0, 0, 0)
  ) as v(name, qty, kcal, protein_g, fat_g, carbs_g)
  where o.slot_id = v_slot_id;

  -- ── Pós-treino — single fixed option ─────────────────────────────
  insert into public.meal_plan_slots (order_index, time_label, title, meal_type)
  values (6, null, 'Pós-treino', 'afternoon_snack')
  returning id into v_slot_id;

  insert into public.meal_plan_options (slot_id, option_number, option_label, observations)
  values (v_slot_id, null, null, 'Prescrição original — Proteína do colágeno - 1 dose (20 g).')
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement) values
    (v_opt_id, 1, 'Água', '200 mL', 0, 0, 0, 0, false),
    (v_opt_id, 2, 'Proteína do Colágeno Neutro', '20 g', 72, 18, 0, 0, true),
    (v_opt_id, 3, 'Suco prensado (rosa, verde, laranja...)', '240 mL', 120, 1, 0.2, 29, false);

  -- ── Jantar — 5 options, all confirmed ────────────────────────────
  insert into public.meal_plan_slots (order_index, time_label, title, meal_type)
  values (7, null, 'Jantar', 'dinner')
  returning id into v_slot_id;

  insert into public.meal_plan_options (slot_id, option_number, option_label, observations)
  values (v_slot_id, 1, 'Shake', 'Ou Mel - 1 Colher de sopa (15 g), no lugar da banana.')
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement) values
    (v_opt_id, 1, 'Frutas vermelhas', '1 Xícara de chá (120 g)', 60, 1, 0.5, 14, false),
    (v_opt_id, 2, 'Banana', '1 Unidade (70 g)', 62, 0.8, 0.2, 16, false),
    (v_opt_id, 3, 'Iogurte Oikos Triple Zero Plain EUA', '180 g', 108, 19.8, 0, 7.2, false),
    (v_opt_id, 4, 'Proteína do Colágeno Neutro', '20 g', 72, 18, 0, 0, true),
    (v_opt_id, 5, 'Hemp Seeds (semente de cânhamo)', '1,5 Colheres de sopa (15 g)', 83, 5, 7, 1, false);

  insert into public.meal_plan_options (slot_id, option_number, option_label, observations)
  values (v_slot_id, 2, 'Sopa + proteína',
    'Ou Proteína do Colágeno Neutro - 1,5 Dosadores cheios (39 g), no lugar do frango desfiado.')
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement) values
    (v_opt_id, 1, 'Sopa de legumes, abóbora, brócolis etc', '3 Conchas cheias (390 g)', 137, 6, 4, 23, false),
    (v_opt_id, 2, 'Frango desfiado', '5 Colheres de sopa cheias (100 g)', 165, 31, 3.6, 0, false),
    (v_opt_id, 3, 'Folha de espinafre crua', '1 Xícara de chá (30 g)', 7, 1, 0, 1, false),
    (v_opt_id, 4, 'Azeite de oliva', '1 Colher de sobremesa rasa (5 mL)', 41, 0, 4.6, 0, false),
    (v_opt_id, 5, 'Semente de abóbora inteira torrada', '1 Colher de sopa rasa (15 g)', 84, 5, 7, 2, false);

  insert into public.meal_plan_options (slot_id, option_number, option_label)
  values (v_slot_id, 3, 'Rap 10 caseiro')
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement) values
    (v_opt_id, 1, 'Farelo de aveia', '4 Colheres de sopa (40 g)', 98, 6.9, 2.8, 26.5, false),
    (v_opt_id, 2, 'Frango desfiado', '5 Colheres de sopa cheias (100 g)', 165, 31, 3.6, 0, false),
    (v_opt_id, 3, 'Queijo cottage', '2 Colheres de sopa (50 g)', 49, 5.5, 2.2, 1.7, false),
    (v_opt_id, 4, 'Semente de gergelim', '1 Colher de sobremesa (10 g)', 57, 1.8, 5, 2.3, false);

  insert into public.meal_plan_options (slot_id, option_number, option_label, observations)
  values (v_slot_id, 4, 'Quiche sem massa',
    'Ou, no lugar do espinafre: couve (2 folhas, 50 g); cebola (40 g).')
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement) values
    (v_opt_id, 1, 'Ovo', '2 Unidades (100 g)', 156, 13, 11, 1, false),
    (v_opt_id, 2, 'Iogurte Oikos Triple Zero Plain EUA', '100 g', 60, 11, 0, 4, false),
    (v_opt_id, 3, 'Queijo cottage', '2 Colheres de sopa (50 g)', 49, 5.5, 2.2, 1.7, false),
    (v_opt_id, 4, 'Espinafre', '1 Porção (67 g)', 15, 2, 0, 2, false),
    (v_opt_id, 5, 'Barra de proteína RX Bar', '0,5 barra (26 g)', 105, 6, 3.5, 11.5, false);

  insert into public.meal_plan_options (slot_id, option_number, option_label)
  values (v_slot_id, 5, 'Tilápia + batata doce')
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement) values
    (v_opt_id, 1, 'Filé de tilápia grelhado', '1 Filé grande (150 g)', 192, 39, 4, 0, false),
    (v_opt_id, 2, 'Batata doce cozida', '2 Fatias (140 g)', 120, 2, 0, 28, false),
    (v_opt_id, 3, 'Semente de abóbora inteira torrada', '1,5 Colheres de sobremesa rasas (15 g)', 84, 5, 7, 2, false);

  -- Morosil's "antes do jantar" dose + Magnésio Inositol ("à noite
  -- antes de dormir", nearest meal = dinner) — every option of this slot.
  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement)
  select o.id, 100, v.name, v.qty, v.kcal, v.protein_g, v.fat_g, v.carbs_g, true
  from public.meal_plan_options o
  cross join (values
    ('Morosil', '1 dose (250 mg) — antes do jantar', 0, 0, 0, 0),
    ('Magnésio Inositol Relief 3.0', '1 dose — antes de dormir', 0, 0, 0, 0)
  ) as v(name, qty, kcal, protein_g, fat_g, carbs_g)
  where o.slot_id = v_slot_id;

end $$;
