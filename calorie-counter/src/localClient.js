// A drop-in stand-in for the Supabase client, backed by the browser's own
// localStorage instead of a real project — for when Supabase access isn't
// available (e.g. the account is locked out) but the app should still be
// usable. Implements only the subset of the client surface this app
// actually calls: auth (always "signed in", no real accounts) and a
// generic query builder over a per-table store (select/eq/gte/lt/in/
// order/limit/single/maybeSingle/upsert/insert/update/delete).
//
// Nothing here is synced anywhere — it's just this one browser, which is
// exactly the tradeoff local mode is for. See supabaseClient.js for how
// this gets swapped in, and index.html/main.js for the "Usar sem conta"
// entry point and the way back out.
import { MEAL_PLAN_SLOTS, MEAL_PLAN_OPTIONS, MEAL_PLAN_ITEMS } from "./mealPlanSeed.js";

const DB_KEY = "jc_local_db";
const LOCAL_USER = { id: "local-device-user", email: "local@device" };

function freshDb() {
  // Deep-copied, not shared by reference — nothing currently writes to
  // the meal_plan_* tables, but cloning keeps the imported seed module's
  // own arrays untouched regardless, in case that ever changes.
  return {
    foods: [],
    food_logs: [],
    weight_logs: [],
    user_targets: [],
    meal_plan_notes: [],
    cycle_settings: [],
    meal_plan_slots: JSON.parse(JSON.stringify(MEAL_PLAN_SLOTS)),
    meal_plan_options: JSON.parse(JSON.stringify(MEAL_PLAN_OPTIONS)),
    meal_plan_items: JSON.parse(JSON.stringify(MEAL_PLAN_ITEMS)),
  };
}

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupt/unavailable storage — fall through to a fresh db rather than
    // crash the whole app over locally-cached data.
  }
  return freshDb();
}

let db = loadDb();
let nextId = 0;

function persist() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // storage full or unavailable (private browsing) — the session still
    // works, it just won't survive a reload.
  }
}

function matchFilters(row, filters) {
  return filters.every(({ type, col, val }) => {
    const v = row[col];
    if (type === "eq") return v === val;
    if (type === "gte") return v >= val;
    if (type === "lt") return v < val;
    if (type === "in") return val.includes(v);
    return true;
  });
}

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.orderCol = null;
    this.orderAsc = true;
    this.limitN = null;
    this.selectCols = "*";
    this.mode = "select";
    this.payload = null;
    this.upsertOpts = null;
    this.wantSingle = false;
    this.wantMaybeSingle = false;
  }
  select(cols) {
    this.selectCols = cols;
    return this;
  }
  eq(col, val) {
    this.filters.push({ type: "eq", col, val });
    return this;
  }
  gte(col, val) {
    this.filters.push({ type: "gte", col, val });
    return this;
  }
  lt(col, val) {
    this.filters.push({ type: "lt", col, val });
    return this;
  }
  in(col, val) {
    this.filters.push({ type: "in", col, val });
    return this;
  }
  order(col, { ascending = true } = {}) {
    this.orderCol = col;
    this.orderAsc = ascending;
    return this;
  }
  limit(n) {
    this.limitN = n;
    return this;
  }
  single() {
    this.wantSingle = true;
    return this;
  }
  maybeSingle() {
    this.wantMaybeSingle = true;
    return this;
  }
  upsert(obj, opts) {
    this.mode = "upsert";
    this.payload = obj;
    this.upsertOpts = opts || {};
    return this;
  }
  insert(obj) {
    this.mode = "insert";
    this.payload = obj;
    return this;
  }
  update(obj) {
    this.mode = "update";
    this.payload = obj;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }

  _rows() {
    return (db[this.table] || []).filter((r) => matchFilters(r, this.filters));
  }

  async _execSelect() {
    let rows = this._rows();
    if (this.orderCol) {
      const col = this.orderCol;
      const asc = this.orderAsc;
      rows = [...rows].sort((a, b) => {
        const av = a[col];
        const bv = b[col];
        if (av == null && bv == null) return 0;
        if (av == null) return asc ? -1 : 1;
        if (bv == null) return asc ? 1 : -1;
        if (av < bv) return asc ? -1 : 1;
        if (av > bv) return asc ? 1 : -1;
        return 0;
      });
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    rows = this._resolveJoins(rows);
    if (this.wantSingle) return { data: rows[0] || null, error: rows[0] ? null : { message: "no rows" } };
    if (this.wantMaybeSingle) return { data: rows[0] || null, error: null };
    return { data: rows, error: null };
  }

  // The one join this app actually does: food_logs selecting its related
  // foods row inline as `foods(...)` — log.js's FOODS_JOIN constant.
  _resolveJoins(rows) {
    if (this.table !== "food_logs" || typeof this.selectCols !== "string" || !this.selectCols.includes("foods(")) {
      return rows;
    }
    return rows.map((r) => ({ ...r, foods: (db.foods || []).find((f) => f.id === r.food_id) || null }));
  }

  async _execUpsert() {
    const table = db[this.table];
    const conflictCols = (this.upsertOpts.onConflict || "id").split(",");
    const existing = table.find((r) => conflictCols.every((c) => r[c] === this.payload[c]));
    let row;
    if (existing) {
      Object.assign(existing, this.payload);
      row = existing;
    } else {
      row = { id: `local-${nextId++}`, ...this.payload };
      table.push(row);
    }
    persist();
    if (this.wantSingle) return { data: row, error: null };
    return { data: [row], error: null };
  }

  async _execInsert() {
    const table = db[this.table];
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
    const inserted = rows.map((r) => ({ id: `local-${nextId++}`, ...r }));
    table.push(...inserted);
    persist();
    if (this.wantSingle) return { data: inserted[0], error: null };
    return { data: inserted, error: null };
  }

  async _execUpdate() {
    const rows = this._rows();
    for (const row of rows) Object.assign(row, this.payload);
    persist();
    return { data: rows, error: null };
  }

  async _execDelete() {
    const toDelete = new Set(this._rows());
    db[this.table] = (db[this.table] || []).filter((r) => !toDelete.has(r));
    persist();
    return { data: null, error: null };
  }

  then(resolve, reject) {
    const exec =
      this.mode === "upsert"
        ? this._execUpsert()
        : this.mode === "insert"
        ? this._execInsert()
        : this.mode === "update"
        ? this._execUpdate()
        : this.mode === "delete"
        ? this._execDelete()
        : this._execSelect();
    return exec.then(resolve, reject);
  }
}

export function createLocalClient() {
  return {
    auth: {
      async getSession() {
        return { data: { session: { user: LOCAL_USER } } };
      },
      async getUser() {
        return { data: { user: LOCAL_USER } };
      },
      onAuthStateChange() {
        // Local mode has exactly one always-signed-in "user" for the
        // lifetime of the page — nothing ever fires a state change, so
        // there's no listener to keep. Exiting local mode is a page
        // reload (see auth.signOut below and the UI toggle in main.js),
        // not an in-place auth transition.
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async signInWithPassword() {
        return { error: null };
      },
      async signUp() {
        return { error: null };
      },
      // "Signing out" of local mode doesn't mean "sign back in locally" —
      // there's only ever one local user — it means leaving local mode
      // entirely, back to the real sign-in screen (useful once Supabase
      // access is restored). The locally-logged data stays on disk;
      // re-entering local mode later picks it back up.
      async signOut() {
        try {
          localStorage.removeItem("jc_local_mode");
        } catch {
          // ignore — worst case the toggle in main.js still forces it
        }
        location.reload();
        return { error: null };
      },
    },
    from(table) {
      return new QueryBuilder(table);
    },
  };
}
