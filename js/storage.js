/**
 * storage.js
 * Pure persistence layer for the Business Growth & Resilience Coach.
 * Owns every localStorage key and the schema guards around them, so the
 * render layer never touches raw storage.
 *
 * Keys:
 *  - coach-profile-v1    -> { businessName, industry, stage, employeeRange, mainGoal, mainChallenge }
 *  - coach-answers-v1    -> { "<categoryId>__<qIndex>": number(1-5) | null }
 *  - coach-actions-v1    -> array of action plan items
 *  - coach-scenarios-v1  -> { "<scenarioId>": { six scenario fields } }
 *  - business-evaluator-history-v1 -> array of assessment snapshots (capped)
 *
 * All reads are wrapped in try/catch so a corrupt value can never take the
 * whole app down, and all writes go through a quota-safe setItem().
 * Imported profile dictionaries are sanity-checked field by field.
 */

const STORE = {
  profile: "coach-profile-v1",
  answers: "coach-answers-v1",
  actions: "coach-actions-v1",
  scenarios: "coach-scenarios-v1",
  history: "business-evaluator-history-v1"
};

const STORE_LIMITS = {
  historyMax: 120
};

/* ---- safe primitives ---------------------------------------------------- */

function storeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === undefined ? fallback : parsed;
  } catch (e) {
    return fallback;
  }
}

function storeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Quota / private-mode failures must not crash the app.
  }
}

function storeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    /* ignore */
  }
}

function newId(prefix) {
  return (prefix || "id") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}

/* ---- profile ------------------------------------------------------------ */

const PROFILE_DEFAULT = {
  businessName: "",
  industry: "",
  stage: "",
  employeeRange: "",
  mainGoal: "",
  mainChallenge: ""
};

function isBlank(value) {
  return value == null || String(value).trim() === "";
}

function sanitizeProfile(input) {
  const src = input && typeof input === "object" ? input : {};
  const out = {};
  Object.keys(PROFILE_DEFAULT).forEach((k) => {
    out[k] = typeof src[k] === "string" ? src[k].slice(0, 120) : "";
  });
  return out;
}

function loadProfile() {
  return sanitizeProfile(storeGet(STORE.profile, {}));
}

function saveProfile(patch) {
  const merged = Object.assign({}, loadProfile(), sanitizeProfile(patch));
  storeSet(STORE.profile, merged);
  return merged;
}

function hasProfile(profile) {
  const p = profile || loadProfile();
  return !isBlank(p.businessName) && !isBlank(p.industry);
}

/* ---- answers ------------------------------------------------------------ */

function loadAnswers() {
  const raw = storeGet(STORE.answers, {});
  const out = {};
  if (raw && typeof raw === "object") {
    Object.keys(raw).forEach((k) => {
      const v = raw[k];
      if (v === null || (v >= 1 && v <= 5 && Number.isInteger(v))) out[k] = v;
    });
  }
  return out;
}

function saveAnswers(answers) {
  storeSet(STORE.answers, answers || {});
}

function clearAnswers() {
  storeRemove(STORE.answers);
}

function answeredCount(answers) {
  return Object.values(answers || {}).filter((v) => v !== null && v !== undefined).length;
}

/* ---- actions ------------------------------------------------------------ */

function sanitizeAction(input) {
  const src = input && typeof input === "object" ? input : {};
  return {
    id: typeof src.id === "string" ? src.id : newId("act"),
    title: typeof src.title === "string" ? src.title.slice(0, 120) : "",
    description: typeof src.description === "string" ? src.description.slice(0, 800) : "",
    benefit: typeof src.benefit === "string" ? src.benefit.slice(0, 400) : "",
    priority: ["high", "medium", "low"].includes(src.priority) ? src.priority : "medium",
    responsible: typeof src.responsible === "string" ? src.responsible.slice(0, 80) : "",
    targetDate: typeof src.targetDate === "string" ? src.targetDate.slice(0, 10) : "",
    successMeasure: typeof src.successMeasure === "string" ? src.successMeasure.slice(0, 400) : "",
    status: ["open", "in-progress", "done"].includes(src.status) ? src.status : "open",
    horizon: ["short", "long"].includes(src.horizon) ? src.horizon : "short",
    createdAt: typeof src.createdAt === "number" ? src.createdAt : Date.now(),
    updatedAt: typeof src.updatedAt === "number" ? src.updatedAt : Date.now()
  };
}

function loadActions() {
  const raw = storeGet(STORE.actions, []);
  return Array.isArray(raw) ? raw.map(sanitizeAction).filter((a) => a.title !== "") : [];
}

function saveActions(actions) {
  storeSet(STORE.actions, Array.isArray(actions) ? actions : []);
}

function upsertAction(action) {
  const clean = sanitizeAction(action);
  const list = loadActions();
  const idx = list.findIndex((a) => a.id === clean.id);
  if (idx >= 0) list[idx] = clean;
  else list.push(clean);
  saveActions(list);
  return clean;
}

function deleteAction(id) {
  saveActions(loadActions().filter((a) => a.id !== id));
}

/* ---- scenarios ---------------------------------------------------------- */

function loadScenarios() {
  const raw = storeGet(STORE.scenarios, {});
  return raw && typeof raw === "object" ? raw : {};
}

function saveScenario(id, fields) {
  const all = loadScenarios();
  const next = {};
  Object.keys(fields || {}).forEach((k) => {
    next[k] = typeof fields[k] === "string" ? fields[k].slice(0, 1000) : "";
  });
  all[id] = next;
  storeSet(STORE.scenarios, all);
  return all;
}

/* ---- history (assessment snapshots) ------------------------------------- */

function sanitizeSnapshot(input) {
  const src = input && typeof input === "object" ? input : {};
  const categories = Array.isArray(src.categories)
    ? src.categories
        .filter((c) => c && typeof c.id === "string")
        .map((c) => ({
          id: c.id,
          label: typeof c.label === "string" ? c.label : c.id,
          icon: typeof c.icon === "string" ? c.icon : "",
          score100: typeof c.score100 === "number" ? c.score100 : null,
          avg: typeof c.avg === "number" ? c.avg : null
        }))
    : [];
  const profile = src.profile && typeof src.profile === "object"
    ? sanitizeProfile(src.profile)
    : {};
  const total = src.overall;
  return {
    id: typeof src.id === "string" ? src.id : newId("snap"),
    label: typeof src.label === "string" ? src.label.slice(0, 140) : "",
    createdAt: typeof src.createdAt === "number" ? src.createdAt : Date.now(),
    overall: typeof total === "number" ? Math.max(0, Math.min(100, Math.round(total))) : null,
    level: typeof src.level === "string" ? src.level.slice(0, 60) : "",
    categories: categories,
    profile: profile
  };
}

function loadHistory() {
  const raw = storeGet(STORE.history, []);
  return Array.isArray(raw) ? raw.map(sanitizeSnapshot) : [];
}

function saveHistory(history) {
  const list = Array.isArray(history) ? history.slice(-STORE_LIMITS.historyMax) : [];
  storeSet(STORE.history, list);
  return list;
}

function pushSnapshot(snapshot) {
  const list = saveHistory(loadHistory().concat([snapshot]));
  return list;
}

/* ---- export / restore --------------------------------------------------- */

function exportAll() {
  return JSON.stringify(
    {
      app: "business-growth-coach",
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: loadProfile(),
      answers: loadAnswers(),
      actions: loadActions(),
      scenarios: loadScenarios(),
      history: loadHistory()
    },
    null,
    2
  );
}

function importAll(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || parsed.app !== "business-growth-coach") {
    throw new Error("This file does not look like a Coach backup.");
  }

  saveProfile(parsed.profile);
  saveAnswers(parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {});
  saveActions(parsed.actions);
  storeSet(STORE.scenarios, parsed.scenarios && typeof parsed.scenarios === "object" ? parsed.scenarios : {});
  if (Array.isArray(parsed.history)) saveHistory(parsed.history);
  return true;
}

/* ---- reset -------------------------------------------------------------- */

function resetAllData() {
  [STORE.profile, STORE.answers, STORE.actions, STORE.scenarios].forEach(storeRemove);
}