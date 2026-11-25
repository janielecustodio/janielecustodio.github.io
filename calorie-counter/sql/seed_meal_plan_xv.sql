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
-- IMPORTANT — macro values below are estimates, not verified nutrition
-- facts: I don't have access to USDA/brand label data for the specific
-- products (Oikos Triple Zero, Orgain, RX Bar, etc.) from here, so I
-- estimated from typical values per 100g/mL for each food and scaled to
-- the plan's quantity. Treat these as "close enough to track trends",
-- not exact — worth spot-checking against the real labels when you have
-- a moment, especially for the branded products.
--
-- COVERAGE — the 7 time slots visible in the screenshots: Em jejum,
-- Shot, Café da manhã, Almoço, Lanche I, Pós-treino, Jantar. Only the
-- option(s) whose contents were visible are filled in with real food
-- items; other options for a multi-option slot are empty placeholders
-- (so the tabs already show up) — send more screenshots to fill them in.
--
-- SUPPLEMENTS from the "Suplementação EUA + Brasil IX" PDF that don't
-- appear in the 7 slots above are placed in whichever existing slot is
-- closest to their prescribed timing (per instruction — no exact slot
-- was confirmed for these, this is a best-fit placement, not from a
-- screenshot):
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
-- to EVERY option of a multi-option slot (Café da manhã, Jantar), not
-- just the one with real food data — it'll keep showing up once more
-- options are filled in.

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

  -- ── Café da manhã (07:00) — 4 options, only Opção 1 known ────────
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

  insert into public.meal_plan_options (slot_id, option_number, option_label) values
    (v_slot_id, 2, null), (v_slot_id, 3, null), (v_slot_id, 4, null);

  -- Supplements taken "pela manhã" / "após café da manhã" — added to
  -- every option of this slot, see note at the top of this file.
  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement)
  select o.id, 7, v.name, v.qty, v.kcal, v.protein_g, v.fat_g, v.carbs_g, true
  from public.meal_plan_options o
  cross join (values
    ('Vitamina D', '1 dose', 0, 0, 0, 0),
    ('Ferro', '1 dose', 0, 0, 0, 0),
    ('Red Yeast Rice + CoQ10', '2 cápsulas', 0, 0, 0, 0),
    ('Manipulado (zinco, selênio, magnésio, B6, B2, B9, B12, colina, vit. C, PQQ, vit. E)', '1 dose', 0, 0, 0, 0)
  ) as v(name, qty, kcal, protein_g, fat_g, carbs_g)
  where o.slot_id = v_slot_id;

  -- ── Almoço — single fixed option ─────────────────────────────────
  insert into public.meal_plan_slots (order_index, time_label, title, meal_type)
  values (4, null, 'Almoço', 'lunch')
  returning id into v_slot_id;

  insert into public.meal_plan_options (slot_id, option_number, option_label)
  values (v_slot_id, null, null)
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
    (v_opt_id, 9, 'Morosil', '1 dose (250 mg)', 0, 0, 0, 0, true),
    (v_opt_id, 10, 'Rhodiola rosea', '1 dose (150 mg) — 10h', 0, 0, 0, 0, true);

  -- ── Lanche I — 4 options, only Opção 1 known ─────────────────────
  insert into public.meal_plan_slots (order_index, time_label, title, meal_type)
  values (5, null, 'Lanche I', 'afternoon_snack')
  returning id into v_slot_id;

  insert into public.meal_plan_options (slot_id, option_number, option_label)
  values (v_slot_id, 1, 'Prático')
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement) values
    (v_opt_id, 1, 'Orgain Vegan Protein Shake', '1 caixinha (330 mL)', 220, 20, 7, 23, false),
    (v_opt_id, 2, 'Banana', '1 Unidade (70 g)', 62, 0.8, 0.2, 16, false);

  insert into public.meal_plan_options (slot_id, option_number, option_label) values
    (v_slot_id, 2, null), (v_slot_id, 3, null), (v_slot_id, 4, null);

  -- Rhodiola's 17h dose + gengibre ("antes do treino", the slot right
  -- before Pós-treino) — added to every option of this slot.
  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement)
  select o.id, 3, v.name, v.qty, v.kcal, v.protein_g, v.fat_g, v.carbs_g, true
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

  -- ── Jantar — 5 options, only Opção 3 known ───────────────────────
  insert into public.meal_plan_slots (order_index, time_label, title, meal_type)
  values (7, null, 'Jantar', 'dinner')
  returning id into v_slot_id;

  insert into public.meal_plan_options (slot_id, option_number, option_label) values
    (v_slot_id, 1, null), (v_slot_id, 2, null);

  insert into public.meal_plan_options (slot_id, option_number, option_label)
  values (v_slot_id, 3, 'Rap10 caseiro')
  returning id into v_opt_id;

  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement) values
    (v_opt_id, 1, 'Farelo de aveia', '4 Colheres de sopa (40 g)', 98, 6.9, 2.8, 26.5, false),
    (v_opt_id, 2, 'Frango desfiado', '5 Colheres de sopa cheias (100 g)', 165, 31, 3.6, 0, false),
    (v_opt_id, 3, 'Queijo cottage', '2 Colheres de sopa (50 g)', 49, 5.5, 2.2, 1.7, false),
    (v_opt_id, 4, 'Semente de gergelim', '1 Colher de sobremesa (10 g)', 57, 1.8, 5, 2.3, false);

  insert into public.meal_plan_options (slot_id, option_number, option_label) values
    (v_slot_id, 4, null), (v_slot_id, 5, null);

  -- Morosil's "antes do jantar" dose + Magnésio Inositol ("à noite
  -- antes de dormir", nearest meal = dinner) — every option of this slot.
  insert into public.meal_plan_items (option_id, order_index, name, quantity_label, kcal, protein_g, fat_g, carbs_g, is_supplement)
  select o.id, 5, v.name, v.qty, v.kcal, v.protein_g, v.fat_g, v.carbs_g, true
  from public.meal_plan_options o
  cross join (values
    ('Morosil', '1 dose (250 mg)', 0, 0, 0, 0),
    ('Magnésio Inositol Relief 3.0', '1 dose', 0, 0, 0, 0)
  ) as v(name, qty, kcal, protein_g, fat_g, carbs_g)
  where o.slot_id = v_slot_id;

end $$;
