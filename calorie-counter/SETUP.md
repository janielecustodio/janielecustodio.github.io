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
6. **Authentication → Providers → Email**: turn **off** "Confirm email".
   This is what makes daily sign-in reliable — with it off, creating your
   account and every sign-in after that use email + password only, and
   Supabase never needs to send an email at all. (An earlier version of
   this app used passwordless one-time-code sign-in instead, but the
   free-tier email sender has a low rate limit and isn't reliable enough
   for something you'll use multiple times a day — password auth sidesteps
   that completely while keeping the same per-user Row Level Security.)
7. Open `calorie-counter/index.html` in a browser (or visit it once it's
   deployed), click **Sign up**, and create your account with an email
   and password (6+ characters). You're signed in immediately — no email
   confirmation step.
8. Lock the app down to just you: **Authentication → Settings**, turn off
   **Allow new users to sign up**. From now on only your existing account
   can sign in.

## 2. Get a free USDA FoodData Central API key

1. Go to https://fdc.nal.usda.gov/api-key-signup.html
2. Fill in first name, last name, email — no approval wait, the key is
   shown immediately and emailed to you.
3. Paste it into `src/config.js` as `USDA_API_KEY`.

**Before you commit this**, understand the tradeoff: this site is classic
branch-deployed GitHub Pages with no build step, so whatever is committed
to `src/config.js` is served as plain client JS — visible in the repo,
its history, and to anyone who views source on the live site. USDA (and
GitHub's own secret scanning) actively scan public repos for exactly this
pattern and will revoke a key within minutes of it being pushed, which is
exactly what happened the first time around. If that's an acceptable
tradeoff for a free, individually-rate-limited key on a personal project,
committing it is fine and matches how this app was originally designed to
work. If not, the key needs to move behind a server component (e.g. a
Supabase Edge Function, since this app already uses Supabase) so it never
ships to the client at all — that's a real code change, not a config one,
so ask for it explicitly if you want it built.

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
2. Open `sql/taco_tbca_import_template.csv` in Excel/Numbers/Google
   Sheets — it already has the exact column headers the `foods` table
   expects (`source`, `source_id`, `name`, `kcal_100g`, `protein_100g`,
   `fat_100g`, `carbs_100g`, `fiber_100g`). Delete the placeholder
   `REPLACE-WITH-...` row and fill in one row per food from the source
   spreadsheet:
   - `source`: literal `taco` or `tbca`
   - `source_id`: the food's code from the original table — must be
     unique per source
   - the rest: copy the matching nutrient values per 100g
   Leave `brand`, `barcode`, `micros` out entirely — not used for whole
   foods.
3. In Supabase: **Table Editor → foods → Insert → Import data from CSV**,
   upload your filled-in file, map the columns (they should auto-match by
   name), and import.

That's it — the app's search bar will immediately start returning TACO/TBCA
results alongside USDA and Open Food Facts once the table has rows.
