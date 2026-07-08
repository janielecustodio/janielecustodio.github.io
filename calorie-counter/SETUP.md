# Calorie Counter — setup

Everything below is free. Total time: ~15 minutes.

## 1. Create a Supabase project

1. Go to https://supabase.com and sign up (GitHub login is easiest).
2. Click **New project**. Pick an org, name it (e.g. `calorie-counter`), set
   a database password (save it somewhere — you won't need it day-to-day,
   Supabase manages auth separately), pick the region closest to you.
3. Wait ~2 minutes for it to provision.
4. **Project Settings → API**. Copy:
   - **Project URL** → paste into `src/config.js` as `SUPABASE_URL`
   - **anon public** key → paste into `src/config.js` as `SUPABASE_ANON_KEY`
   (The anon key is safe to ship in client code — Row Level Security, set
   up in the next step, decides what it can actually read or write.)
5. **SQL Editor → New query**. Paste the entire contents of
   `sql/schema.sql` and click **Run**. This creates the `foods` and
   `food_logs` tables with Row Level Security policies already applied.
6. **Authentication → Sign In / Providers**: Email should already be
   enabled by default — nothing to do here.
7. Open `calorie-counter/index.html` in a browser (or visit it once it's
   deployed) and use the **Sign up** link to create your one account.
8. Lock the app down to just you: **Authentication → Settings**, turn off
   **Allow new users to sign up**. From now on only accounts that already
   exist can sign in.

## 2. Get a free USDA FoodData Central API key

1. Go to https://fdc.nal.usda.gov/api-key-signup.html
2. Fill in first name, last name, email — no approval wait, the key is
   shown immediately and emailed to you.
3. Paste it into `src/config.js` as `USDA_API_KEY`.

## 3. Open Food Facts

Nothing to do — it's a public API with no key required, already wired up
for both search and barcode lookup.

## 4. Import TACO / TBCA (Brazilian food composition data)

There's no live API for these, so they're imported once into the `foods`
table and then queried like any other cached food:

1. Download the source data:
   - **TACO** (UNICAMP/NEPA, 4th edition) — search "Tabela TACO 4ª edição
     download" for the current official PDF/spreadsheet link from NEPA.
   - **TBCA** (USP) — https://www.tbca.net.br lets you browse and export
     food composition data.
2. Reformat the spreadsheet into a CSV with these exact column headers
   (matching the `foods` table):

   | column | notes |
   |---|---|
   | `source` | literal `taco` or `tbca` |
   | `source_id` | the food's code from the original table (e.g. TACO's numeric code) — must be unique per source |
   | `name` | food name |
   | `kcal_100g` | energy per 100g |
   | `protein_100g` | protein per 100g |
   | `fat_100g` | fat per 100g |
   | `carbs_100g` | carbohydrate per 100g |
   | `fiber_100g` | fiber per 100g (optional, can leave blank) |

   Leave `brand`, `barcode`, `micros` blank/empty — they're not used for
   whole foods.
3. In Supabase: **Table Editor → foods → Insert → Import data from CSV**,
   upload the file, map the columns (they should auto-match by name), and
   import.

That's it — the app's search bar will immediately start returning TACO/TBCA
results alongside USDA and Open Food Facts once the table has rows.
