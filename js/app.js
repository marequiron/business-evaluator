/**
 * app.js
 * Orchestrator for the Business Growth & Resilience Coach.
 *
 * Loads with data.js -> scoring.js -> storage.js -> analyzer-parse.js ->
 * analyzer.js. The DOM here is built with createElement + textContent (no
 * innerHTML for user content), so everything a user types is rendered safely.
 *
 * Section map:
 *  - profile     -> guided "about your business" step (Phase 1)
 *  - assessment  -> one category at a time, N/A, validation (Phase 2)
 *  - dashboard   -> readiness 0-100 + supportive blocks (Phase 3)
 *  - action-plan -> actions CRUD (Phase 4)
 *  - roadmap     -> short/long-term alignment (Phase 4)
 *  - scenarios   -> resilience "what if" forms (Phase 5)
 *  - progress    -> tracking + comparison (Phase 5)
 *  - data        -> backup/restore/privacy (Phase 5)
 */

/* ---- shared helpers ----------------------------------------------------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function profileName() {
  const p = loadProfile();
  const name = p.businessName || p.industry;
  return name ? name.trim() : "";
}

function greetingText() {
  const p = loadProfile();
  const parts = [];
  if (p.businessName) parts.push(p.businessName);
  if (p.stage && p.stage !== "Just me") parts.push(p.stage.toLowerCase());
  return parts.length ? parts.join(" · ") : "";
}

function renderGreeting() {
  const h1 = document.getElementById("greeting");
  const sub = document.getElementById("greeting-sub");
  if (!h1 || !sub) return;
  const name = profileName();
  h1.textContent = name ? `Welcome, ${name}` : "Welcome";
  const hint = greetingText();
  sub.textContent = hint
    ? `${hint} — everything runs in your browser and stays on this device.`
    : "Your privacy is built in — everything below runs in your browser and stays on this device.";
}

/* ---- navigation --------------------------------------------------------- */

const PANEL_ORDER = ["profile", "assessment", "dashboard", "action-plan", "roadmap", "scenarios", "progress"];
let currentPanel = "profile";

function showPanel(name) {
  currentPanel = name;
  document.querySelectorAll(".panel[data-panel]").forEach((panel) => {
    panel.hidden = panel.getAttribute("data-panel") !== name;
  });
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    const active = tab.getAttribute("data-tab") === name;
    tab.setAttribute("aria-current", active ? "true" : "false");
  });

  if (name === "assessment") renderAssessment();
  if (name === "dashboard") renderDashboard();
  if (name === "action-plan") renderActions();
  if (name === "roadmap") renderRoadmap();
  if (name === "scenarios") renderScenarios();
  if (name === "progress") renderProgress();

  window.scrollTo({ top: 0 });
}

function initNav() {
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => showPanel(tab.getAttribute("data-tab")));
  });
}

/* ---- info button / overlay (plain-language ⓘ) --------------------------- */

const INFO_OVERLAY_ID = "info-overlay";
let activeInfoButton = null;

function getInfoOverlay() {
  let o = document.getElementById(INFO_OVERLAY_ID);
  if (!o) {
    o = el("div", "info-overlay");
    o.id = INFO_OVERLAY_ID;
    o.setAttribute("role", "dialog");
    o.setAttribute("aria-hidden", "true");
    o.hidden = true;
    document.body.appendChild(o);
  }
  return o;
}

function closeInfoOverlay() {
  const overlay = getInfoOverlay();
  if (overlay.hidden) return;
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  if (activeInfoButton) {
    activeInfoButton.setAttribute("aria-expanded", "false");
    activeInfoButton = null;
  }
}

function toggleInfoOverlay(button, title, text) {
  const overlay = getInfoOverlay();
  if (activeInfoButton === button && !overlay.hidden) { closeInfoOverlay(); return; }
  if (activeInfoButton) activeInfoButton.setAttribute("aria-expanded", "false");
  activeInfoButton = button;
  button.setAttribute("aria-expanded", "true");

  clearChildren(overlay);
  const label = el("span", "info-overlay-title", title);
  const body = el("p", "info-overlay-text", text);
  body.tabIndex = -1;
  overlay.appendChild(label);
  overlay.appendChild(body);

  const margin = 10;
  const rect = button.getBoundingClientRect();
  overlay.style.visibility = "hidden";
  overlay.hidden = false;
  const oRect = overlay.getBoundingClientRect();
  let top = rect.bottom + margin;
  if (top + oRect.height > window.innerHeight - margin && rect.top - margin - oRect.height > margin) top = rect.top - margin - oRect.height;
  let left = rect.left;
  if (left + oRect.width > window.innerWidth - margin) left = window.innerWidth - margin - oRect.width;
  if (left < margin) left = margin;
  overlay.style.top = Math.round(top) + "px";
  overlay.style.left = Math.round(left) + "px";
  overlay.style.visibility = "visible";
  overlay.setAttribute("aria-hidden", "false");
  body.focus({ preventScroll: true });
}

function createInfoButton(title, text) {
  if (!text) return null;
  const btn = el("button", "info-btn", "i");
  btn.type = "button";
  btn.setAttribute("aria-label", title);
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("title", title);
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleInfoOverlay(btn, title, text);
  });
  return btn;
}

function initOverlayGlobals() {
  document.addEventListener("click", (event) => {
    const overlay = getInfoOverlay();
    if (overlay.hidden) return;
    if (overlay.contains(event.target)) return;
    if (activeInfoButton && activeInfoButton.contains(event.target)) return;
    closeInfoOverlay();
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeInfoOverlay(); });
  window.addEventListener("resize", closeInfoOverlay);
  window.addEventListener("scroll", closeInfoOverlay, true);
}

/* ---- Phase 1: business profile ------------------------------------------ */

function wrapField(field) {
  const wrap = el("div", "field");

  const label = el("label", "", field.label);
  label.htmlFor = "profile_" + field.key;
  if (field.required) label.textContent += " *";

  let control;
  if (field.type === "select") {
    control = document.createElement("select");
    control.id = "profile_" + field.key;
    control.name = field.key;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select…";
    control.appendChild(placeholder);
    (field.options || []).forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      control.appendChild(o);
    });
  } else {
    control = document.createElement("input");
    control.type = "text";
    control.id = "profile_" + field.key;
    control.name = field.key;
    control.placeholder = field.placeholder || "";
    control.maxLength = 120;
  }

  wrap.appendChild(label);
  wrap.appendChild(control);
  return wrap;
}

function renderProfileForm(form) {
  const profile = loadProfile();
  PROFILE_FIELDS.forEach((field) => {
    const wrap = wrapField(field);
    const control = wrap.querySelector("input, select");
    control.value = profile[field.key] || "";
    form.appendChild(wrap);
  });
  const actions = el("div", "form-actions");
  const submitBtn = el("button", "", "Save my profile");
  submitBtn.type = "submit";
  actions.appendChild(submitBtn);
  form.appendChild(actions);
}

function initProfile() {
  const form = document.getElementById("profile-form");
  if (!form) return;

  renderProfileForm(form);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = {};
    PROFILE_FIELDS.forEach((field) => {
      const control = form.querySelector('[name="' + field.key + '"]');
      data[field.key] = control ? control.value.trim() : "";
    });

    const firstMissing = PROFILE_FIELDS.find((f) => f.required && !data[f.key]);
    if (firstMissing) {
      showProfileNote("Please add " + firstMissing.label.toLowerCase() + " before continuing.", true);
      return;
    }

    saveProfile(data);
    renderGreeting();
    showProfileNote("Saved. Your plan will be personalized from here.", false);

    const profileTab = document.querySelector('.nav-tab[data-tab="profile"]');
    if (profileTab) profileTab.setAttribute("data-visited", "true");
  });
}

function showProfileNote(message, isError) {
  const note = document.getElementById("profile-save-note");
  if (!note) return;
  note.textContent = message;
  note.style.color = isError ? "var(--weakness)" : "var(--strength)";
  note.hidden = false;
  setTimeout(() => { note.hidden = true; }, 4000);
}

/* ---- analyzer glue (kept from previous app) ----------------------------- */

function analyzeEl(id) { return document.getElementById(id); }

function setAnalyzeStatus(message, isError) {
  const box = analyzeEl("analyze-status");
  const text = analyzeEl("analyze-status-text");
  if (!box || !text) return;
  if (!message) {
    box.hidden = true;
    box.classList.remove("is-error");
    text.textContent = "";
    return;
  }
  box.hidden = false;
  box.classList.toggle("is-error", !!isError);
  text.textContent = message;
}

function setAnalyzeProgress(percent) {
  const wrap = analyzeEl("analyze-progress");
  const bar = analyzeEl("analyze-progress-bar");
  if (!wrap || !bar) return;
  if (percent == null) {
    wrap.hidden = true;
    bar.style.width = "0%";
    return;
  }
  wrap.hidden = false;
  bar.style.width = Math.max(0, Math.min(100, percent)) + "%";
}

function initAnalyze() {
  const btn = analyzeEl("analyze-btn");
  const clearBtn = analyzeEl("analyze-clear-btn");
  if (btn) btn.addEventListener("click", runAnalyze);
  if (clearBtn) clearBtn.addEventListener("click", clearAnalyzeResults);
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsText(file);
  });
}

async function runAnalyze() {
  if (analyzeState.busy) return;
  const fileInput = analyzeEl("analyze-file");
  const file = fileInput && fileInput.files && fileInput.files[0];
  if (!file) {
    setAnalyzeStatus("Choose a text, CSV, or JSON file first.", true);
    return;
  }
  const config = typeof ANALYZE !== "undefined" ? ANALYZE : null;
  if (!config) {
    setAnalyzeStatus("Analysis is not configured (ANALYZE is missing in js/data.js).", true);
    return;
  }

  setAnalyzeBusy(true);
  setAnalyzeProgress(null);
  const cpuNote = Analyzer.isWebGpuAvailable() ? "" : " (no WebGPU — CPU mode, may be slow)";
  setAnalyzeStatus("Reading " + file.name + "…" + cpuNote);

  try {
    const raw = await readFileText(file);
    const asText = AnalyzerParse.documentToText(file.name, raw);
    const trimmed = AnalyzerParse.truncateDocument(asText, config.maxChars);
    if (!trimmed.text.trim()) throw new Error("That file appears to be empty.");

    if (!analyzeState.analyzer) {
      analyzeState.analyzer = Analyzer.createAnalyzer(config, CATEGORIES);
    }

    const handlers = {
      onStatus: (message) => setAnalyzeStatus(message),
      onProgress: (p) => {
        if (p && p.total) {
          setAnalyzeProgress(p.percent);
          setAnalyzeStatus("Downloading model… " + p.percent + "%");
        }
      }
    };

    const result = await analyzeState.analyzer.analyze(trimmed.text, handlers);
    setAnalyzeProgress(null);
    setAnalyzeStatus(
      trimmed.truncated
        ? "Analyzed the first " + config.maxChars + " characters of " + file.name + "."
        : "Analysis complete: " + file.name + "."
    );
    renderAnalyzeResults(result.suggestions);
  } catch (err) {
    setAnalyzeProgress(null);
    setAnalyzeStatus(
      "Analysis failed: " + (err && err.message ? err.message : String(err)) +
      " If you opened this page as a file, serve it instead (npm run local).",
      true
    );
  } finally {
    setAnalyzeBusy(false);
  }
}

function setAnalyzeBusy(busy) {
  analyzeState.busy = busy;
  const btn = analyzeEl("analyze-btn");
  const fileInput = analyzeEl("analyze-file");
  if (btn) { btn.disabled = busy; btn.textContent = busy ? "Analyzing…" : "Analyze"; }
  if (fileInput) fileInput.disabled = busy;
}

function renderAnalyzeResults(suggestions) {
  const listEl = analyzeEl("analyze-results");
  const clearBtn = analyzeEl("analyze-clear-btn");
  if (!listEl) return;
  clearChildren(listEl);
  analyzeState.suggestions = suggestions;

  if (!suggestions || suggestions.length === 0) {
    listEl.appendChild(el("p", "hint", "The model could not produce any usable suggestions for this document."));
    if (clearBtn) clearBtn.hidden = true;
    return;
  }

  listEl.appendChild(el("h4", "", "Suggested scores (review before applying)"));

  const byId = {};
  CATEGORIES.forEach((c) => { byId[c.id] = c; });

  suggestions.forEach((s) => {
    const cat = byId[s.id];
    if (!cat) return;
    const row = el("div", "analyze-row");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = s.score != null;
    cb.disabled = s.score == null;
    cb.setAttribute("data-category", s.id);
    cb.setAttribute("aria-label", "Apply suggestion for " + cat.label);
    row.appendChild(cb);

    const main = el("div", "analyze-row-main");
    const head = el("div", "analyze-row-head");
    head.appendChild(document.createTextNode(cat.icon + " " + cat.label));
    const badge = el("span", "analyze-score score-" + scoreLabelFor(s.score), s.score != null ? "suggests " + s.score + "/5" : "not enough info");
    head.appendChild(badge);
    main.appendChild(head);
    main.appendChild(el("p", "analyze-rationale", s.rationale || "(no rationale provided)"));
    row.appendChild(main);
    listEl.appendChild(row);
  });

  const apply = el("div", "analyze-apply");
  const applyBtn = el("button", "", "Apply selected to my answers");
  applyBtn.type = "button";
  applyBtn.addEventListener("click", applyAnalyzeSuggestions);
  apply.appendChild(applyBtn);
  apply.appendChild(el("span", "hint", "Applying sets every question in each selected category to the suggested score."));
  listEl.appendChild(apply);
  if (clearBtn) clearBtn.hidden = false;
}

function applyAnalyzeSuggestions() {
  const listEl = analyzeEl("analyze-results");
  if (!listEl || !analyzeState.suggestions) return;

  const selected = [];
  listEl.querySelectorAll("input[data-category]:checked").forEach((cb) => {
    const s = analyzeState.suggestions.find((x) => x.id === cb.getAttribute("data-category"));
    if (s && s.score != null) selected.push(s);
  });
  if (selected.length === 0) {
    alert("Select at least one category suggestion to apply.");
    return;
  }
  const plural = selected.length === 1 ? "category" : "categories";
  if (!confirm("Apply suggestions to " + selected.length + " " + plural +
    "? This sets every question in each selected category and overwrites those answers.")) return;

  const byId = {};
  CATEGORIES.forEach((c) => { byId[c.id] = c; });
  const answers = loadAnswers();
  selected.forEach((s) => {
    const cat = byId[s.id];
    if (!cat) return;
    cat.questions.forEach((_, i) => { answers[answerKeyRef(cat.id, i)] = s.score; });
  });
  saveAnswers(answers);
  renderAssessment(); // re-render so the screen reflects the applied scores
  setAnalyzeStatus("Applied " + selected.length + " " + plural +
    " to your answers. Review, then finish your assessment.");
}

function clearAnalyzeResults() {
  analyzeState.suggestions = null;
  const listEl = analyzeEl("analyze-results");
  if (listEl) clearChildren(listEl);
  const clearBtn = analyzeEl("analyze-clear-btn");
  if (clearBtn) clearBtn.hidden = true;
  setAnalyzeStatus("");
  setAnalyzeProgress(null);
}

/* ---- globals shared with later phases ----------------------------------- */

const analyzeState = { suggestions: null, analyzer: null, busy: false };

function answerKeyRef(categoryId, qIndex) {
  return categoryId + "__" + qIndex;
}

/* ---- Phase 2: multi-step assessment -------------------------------------- */

const assessState = { active: 0 };

function assessQuestionKey(cat, i) {
  return answerKeyRef(cat.id, i);
}

function answeredCountForCategory(cat) {
  const answers = loadAnswers();
  return cat.questions.filter((_, i) => answers[assessQuestionKey(cat, i)] !== undefined).length;
}

function isCategoryAnswered(cat) {
  return answeredCountForCategory(cat) === cat.questions.length;
}

function assessAnsweredTotal() {
  const answers = loadAnswers();
  return CATEGORIES.reduce((n, cat) => n + cat.questions.filter((_, i) => answers[assessQuestionKey(cat, i)] !== undefined).length, 0);
}

function updateAssessProgress() {
  const text = document.getElementById("assess-progress-text");
  const pct = document.getElementById("assess-progress-pct");
  const track = document.getElementById("assess-progress-bar");
  if (!text || !pct || !track) return;
  const total = CATEGORIES.reduce((n, c) => n + c.questions.length, 0);
  const answered = assessAnsweredTotal();
  const percent = total === 0 ? 0 : Math.round((answered / total) * 100);
  text.textContent = answered + " of " + total + " questions answered";
  pct.textContent = percent + "%";
  track.style.width = percent + "%";
  track.setAttribute("aria-valuenow", String(percent));
}

function setAssessContext(cat) {
  const ctx = document.getElementById("assess-context");
  if (ctx) {
    ctx.textContent = cat.label + " — " + (cat.help || "") + " Answer as it is today; there is no right answer.";
  }
}

function setAssessGreeting() {
  const g = document.getElementById("assess-greeting");
  if (!g) return;
  const name = profileName();
  g.textContent = name ? "Welcome, " + name : "Welcome";
}

function renderCategoryChips() {
  const listEl = document.getElementById("assess-category-list");
  if (!listEl) return;
  clearChildren(listEl);
  CATEGORIES.forEach((cat, i) => {
    const chip = el("button", "cat-chip", cat.icon + " " + cat.label);
    chip.type = "button";
    chip.setAttribute("data-cat-index", String(i));
    chip.setAttribute("role", "tab");
    if (isCategoryAnswered(cat)) chip.setAttribute("data-done", "true");
    chip.addEventListener("click", () => openCategory(i));
    listEl.appendChild(chip);
  });
  refreshChipSelection();
}

function refreshChipSelection() {
  const listEl = document.getElementById("assess-category-list");
  if (!listEl) return;
  listEl.querySelectorAll(".cat-chip").forEach((chip) => {
    const i = Number(chip.getAttribute("data-cat-index"));
    const selected = i === assessState.active;
    if (selected) chip.setAttribute("aria-current", "true");
    else chip.removeAttribute("aria-current");
    if (isCategoryAnswered(CATEGORIES[i])) chip.setAttribute("data-done", "true");
  });
}

function buildScaleOption(name, value, checked, isNa) {
  const label = el("label", "scale-option" + (isNa ? " na" : ""));
  const input = document.createElement("input");
  input.type = "radio";
  input.name = name;
  input.value = isNa ? "" : String(value);
  input.checked = checked;
  if (isNa) input.dataset.na = "true";
  label.appendChild(input);
  label.appendChild(el("span", "", isNa ? "N/A" : String(value)));
  return label;
}

function renderQuestionPanel(cat) {
  const panel = document.getElementById("assess-question-panel");
  if (!panel) return;
  clearChildren(panel);
  const answers = loadAnswers();

  cat.questions.forEach((q, qi) => {
    const qWrap = el("div", "question");
    qWrap.id = "question-" + qi;

    const head = el("div", "question-head");
    head.appendChild(el("p", "", q.text));
    const infoBtn = createInfoButton(cat.label + " question " + (qi + 1), q.simple);
    if (infoBtn) head.appendChild(infoBtn);
    qWrap.appendChild(head);

    const scale = el("div", "scale");
    const radioName = "assess_" + cat.id + "__" + qi;
    [1, 2, 3, 4, 5].forEach((value) => {
      scale.appendChild(buildScaleOption(radioName, value, answers[assessQuestionKey(cat, qi)] === value, false));
    });
    scale.appendChild(buildScaleOption(radioName, null, answers[assessQuestionKey(cat, qi)] === null, true));
    qWrap.appendChild(scale);

    const hint = el("div", "scale-hint");
    hint.appendChild(el("span", "", "1 — far from in place"));
    hint.appendChild(el("span", "", "5 — fully in place"));
    qWrap.appendChild(hint);

    panel.appendChild(qWrap);
  });
}

function collectPanelAnswers(cat) {
  const panel = document.getElementById("assess-question-panel");
  const answers = loadAnswers();
  cat.questions.forEach((_, qi) => {
    const block = panel.querySelector("#question-" + qi);
    const checked = block ? block.querySelector("input[type=radio]:checked") : null;
    if (checked) answers[assessQuestionKey(cat, qi)] = checked.dataset.na ? null : Number(checked.value);
    else if (!(assessQuestionKey(cat, qi) in answers)) answers[assessQuestionKey(cat, qi)] = undefined;
  });
  return answers;
}

function saveCollectedAnswers(cat) {
  saveAnswers(collectPanelAnswers(cat));
  updateAssessProgress();
  refreshChipSelection();
  updateAssessNav();
}

function assessValidationMessage(cat) {
  const answers = collectPanelAnswers(cat);
  const missing = cat.questions.filter((_, i) => !(assessQuestionKey(cat, i) in answers) || answers[assessQuestionKey(cat, i)] === undefined);
  if (missing.length) {
    return "A few questions in " + cat.label + " are still unanswered — choose a score or select Not applicable (N/A) for any that do not apply. Share what you can; there is no wrong answer.";
  }
  return "";
}

function updateAssessNav() {
  const prev = document.getElementById("assess-prev-btn");
  const next = document.getElementById("assess-next-btn");
  const last = assessState.active >= CATEGORIES.length - 1;
  if (prev) prev.disabled = assessState.active === 0;
  if (next) { next.disabled = last; next.textContent = "Next →"; }
}

function setAssessValidation(message) {
  const box = document.getElementById("assess-validation-message");
  if (!box) return;
  if (message) { box.textContent = message; box.hidden = false; }
  else { box.textContent = ""; box.hidden = true; }
}

function openCategory(i) {
  if (i < 0) i = 0;
  if (i > CATEGORIES.length - 1) i = CATEGORIES.length - 1;
  assessState.active = i;
  const cat = CATEGORIES[i];
  setAssessContext(cat);
  renderQuestionPanel(cat);
  renderCategoryChips();
  updateAssessNav();
  setAssessValidation("");
  const panel = document.getElementById("assess-question-panel");
  if (panel) panel.scrollIntoView({ block: "start", behavior: "auto" });
}

function finishAssessment() {
  saveCollectedAnswers(CATEGORIES[assessState.active]);
  setAssessValidation("");
  pushAssessmentSnapshot();
  const summary = document.getElementById("assessment-summary");
  if (summary) {
    clearChildren(summary);
    summary.appendChild(el("p", "positive", "You answered every question — nicely done. Your readiness dashboard is ready."));
  }
}

function initAssessment() {
  const prevBtn = document.getElementById("assess-prev-btn");
  const nextBtn = document.getElementById("assess-next-btn");
  const saveBtn = document.getElementById("assess-save-btn");

  if (prevBtn) prevBtn.addEventListener("click", () => {
    saveCollectedAnswers(CATEGORIES[assessState.active]);
    if (assessState.active > 0) openCategory(assessState.active - 1);
  });
  if (nextBtn) nextBtn.addEventListener("click", () => {
    const cat = CATEGORIES[assessState.active];
    const msg = assessValidationMessage(cat);
    setAssessValidation(msg);
    if (msg) return;
    saveCollectedAnswers(cat); // persist before advancing
    if (assessState.active < CATEGORIES.length - 1) openCategory(assessState.active + 1);
    else finishAssessment();
  });
  if (saveBtn) saveBtn.addEventListener("click", () => {
    const cat = CATEGORIES[assessState.active];
    saveCollectedAnswers(cat); // always save partial progress
    const msg = assessValidationMessage(cat);
    if (!msg) {
      if (assessState.active < CATEGORIES.length - 1) openCategory(assessState.active + 1);
      else finishAssessment();
    } else {
      setAssessValidation(msg);
    }
  });
}

function renderAssessment() {
  setAssessGreeting();
  updateAssessProgress();
  const progress = document.getElementById("assess-progress-wrap");
  const wraps = document.getElementById("assess-scrollers");
  const nav = document.getElementById("assess-nav");
  if (progress) progress.hidden = false;
  if (wraps) wraps.hidden = false;
  if (nav) nav.hidden = false;
  openCategory(assessState.active);
}

/* ---- Phase 3: readiness dashboard ---------------------------------------- */

function dashBlock(title, items) {
  const block = el("div", "dash-block");
  block.appendChild(el("h3", "", title));
  const list = el("div", "block-list");
  items.forEach((item) => {
    const card = el("div", "block-item");
    card.appendChild(el("strong", "", item.heading));
    if (item.chip) {
      const chip = el("span", "scorechip", item.chip);
      card.appendChild(chip);
    }
    card.appendChild(el("p", "", item.body));
    list.appendChild(card);
  });
  block.appendChild(list);
  return block;
}

function recommendationFor(cat, band) {
  const rec = cat.recommendations && cat.recommendations[band];
  return rec ? rec.text : "";
}

function emptyDashboard() {
  const body = document.getElementById("dashboard-body");
  if (!body) return;
  clearChildren(body);
  const block = el("div", "dash-block");
  block.appendChild(el("h3", "", "Start with a few answers"));
  block.appendChild(el("p", "level-note", "Answer at least one category in the assessment to see a readying snapshot here. Even two or three answered categories give a useful starting point."));
  const link = el("button", "", "Take the assessment");
  link.type = "button";
  link.addEventListener("click", () => showPanel("assessment"));
  block.appendChild(link);
  body.appendChild(block);
}

function renderDashboard() {
  const body = document.getElementById("dashboard-body");
  if (!body) return;
  clearChildren(body);

  const answers = loadAnswers();
  const result = finalizeAssessment(CATEGORIES, answers);
  const answeredCats = result.categories.filter((c) => c.score100 != null);
  if (answeredCats.length === 0) { emptyDashboard(); return; }

  const overview = el("div", "dash-overview");

  const hero = el("div", "readiness-hero");
  hero.appendChild(el("div", "score", String(result.overall)));
  hero.appendChild(el("div", "level", result.level || "In progress"));
  hero.appendChild(el("div", "hint", result.levelHint || ""));
  overview.appendChild(hero);

  const bars = el("div", "category-bars");
  result.categories.forEach((c) => {
    const row = el("div", "bar-row");
    row.appendChild(el("div", "bar-label", c.icon + " " + c.label));
    const track = el("div", "bar-track");
    const fill = el("div", "bar-fill" + (c.score100 == null ? " none" : " bar-" + c.band));
    if (c.score100 != null) fill.style.width = c.score100 + "%";
    track.appendChild(fill);
    row.appendChild(track);
    row.appendChild(el("div", "bar-score", c.score100 == null ? "—" : String(c.score100)));
    bars.appendChild(row);
  });
  overview.appendChild(bars);
  body.appendChild(overview);

  const strengths = topStrengths(result.categories, 3);
  if (strengths.length) {
    body.appendChild(dashBlock("What is working well", strengths.map((c) => ({
      heading: c.icon + " " + c.label + " · " + c.score100,
      body: recommendationFor(c, "strength") || "This area is a solid foundation — keep the habits going."
    }))));
  }

  const opportunities = topOpportunities(result.categories, 3);
  if (opportunities.length) {
    body.appendChild(dashBlock("Your strongest improvement opportunities", opportunities.map((c) => ({
      heading: c.icon + " " + c.label + " · " + c.score100,
      body: recommendationFor(c, "opportunity") || "A focused improvement here could make a real difference."
    }))));
  }

  const wins = quickWins(result.categories);
  if (wins.length) {
    body.appendChild(dashBlock("Quick wins to build momentum", wins.map((c) => ({
      heading: c.icon + " " + c.label + " · " + c.score100,
      body: recommendationFor(c, "opportunity") || "A small step here can add up quickly."
    }))));
  }

  const risks = immediateRisks(result.categories);
  if (risks.length) {
    body.appendChild(dashBlock("Gentle heads-up (worth keeping an eye on)", risks.map((c) => ({
      heading: c.icon + " " + c.label + " · " + c.score100,
      body: recommendationFor(c, "weakness") || "Start with the smallest manageable step in this area."
    }))));
  }

  if (body.querySelectorAll(".dash-block").length <= 1) {
    body.appendChild(dashBlock("Every journey starts with one step", [
      { heading: "Your foundation", body: "You have answered " + answeredCats.length + " of 8 areas so far. Filling in the rest gives a complete picture to build from." }
    ]));
  }
}

/* ---- Phase 4: action plan ----------------------------------------------- */

const ACTION_PRIORITY_LABELS = { high: "High", medium: "Medium", low: "Low" };
const ACTION_HORIZON_LABELS = { short: "Short term", long: "Long term" };
const ACTION_STATUS_LABELS = { open: "Open", "in-progress": "In progress", done: "Done" };

let editingAction = null;

function actionRow(action) {
  const row = el("div", "action-row" + (action.status === "done" ? " done" : ""));
  row.appendChild(el("h3", "", action.title));

  const meta = el("div", "meta");
  meta.appendChild(el("span", "pill priority-" + action.priority, ACTION_PRIORITY_LABELS[action.priority] || action.priority));
  meta.appendChild(el("span", "pill horizon-" + action.horizon, ACTION_HORIZON_LABELS[action.horizon] || action.horizon));
  meta.appendChild(el("span", "pill status-" + action.status, ACTION_STATUS_LABELS[action.status] || action.status));
  if (action.targetDate) meta.appendChild(el("span", "", "by " + action.targetDate));
  if (action.responsible) meta.appendChild(el("span", "", "· " + action.responsible));
  row.appendChild(meta);

  if (action.description || action.benefit) row.appendChild(el("p", "desc", action.description || action.benefit));

  const host = el("div", "row-actions");
  const toggleBtn = el("button", "icon-btn", action.status === "done" ? "Reopen" : "Mark done");
  toggleBtn.type = "button";
  toggleBtn.addEventListener("click", () => {
    upsertAction(Object.assign({}, action, { status: action.status === "done" ? "open" : "done", updatedAt: Date.now() }));
    renderActions();
    renderRoadmap();
  });
  host.appendChild(toggleBtn);

  const editBtn = el("button", "icon-btn secondary", "Edit");
  editBtn.type = "button";
  editBtn.addEventListener("click", () => openActionEditor(action));
  host.appendChild(editBtn);

  const delBtn = el("button", "icon-btn danger", "Delete");
  delBtn.type = "button";
  delBtn.addEventListener("click", () => {
    if (confirm('Delete "' + action.title + '"?')) {
      deleteAction(action.id);
      renderActions();
      renderRoadmap();
      renderProgress();
    }
  });
  host.appendChild(delBtn);

  row.appendChild(host);
  return row;
}

function renderActions() {
  const listEl = document.getElementById("actions-list");
  if (!listEl) return;
  clearChildren(listEl);
  const actions = loadActions();
  if (actions.length === 0) {
    listEl.appendChild(el("p", "muted", "No actions yet. Add one to turn insight into momentum."));
    return;
  }
  const weight = { high: 0, medium: 1, low: 2 };
  actions.slice()
    .sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0) ||
      (weight[a.priority] != null ? weight[a.priority] : 1) - (weight[b.priority] != null ? weight[b.priority] : 1))
    .forEach((a) => listEl.appendChild(actionRow(a)));
}

function fieldWrap(labelText, control) {
  const field = el("div", "field");
  const label = el("label", "", labelText);
  label.htmlFor = control.id;
  field.appendChild(label);
  field.appendChild(control);
  return field;
}

function closeActionEditor() {
  const host = document.getElementById("action-editor-host");
  if (host) { host.hidden = true; clearChildren(host); }
  editingAction = null;
}

function initActionEditor(action) {
  const host = document.getElementById("action-editor-host");
  if (!host) return;
  clearChildren(host);
  host.hidden = false;

  const form = el("form", "edit-form");

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.id = "action-title";
  titleInput.placeholder = "e.g. Set up a weekly cash-flow review";
  form.appendChild(fieldWrap("Action title *", titleInput));

  const descInput = document.createElement("textarea");
  descInput.id = "action-desc";
  descInput.placeholder = "Describe the action.";
  form.appendChild(fieldWrap("What you will do", descInput));

  const benefitInput = document.createElement("input");
  benefitInput.type = "text";
  benefitInput.id = "action-benefit";
  benefitInput.placeholder = "e.g. Clearer spending picture";
  form.appendChild(fieldWrap("Expected benefit", benefitInput));

  const priority = document.createElement("select");
  priority.id = "action-priority";
  ["high", "medium", "low"].forEach((v) => {
    const o = document.createElement("option");
    o.value = v; o.textContent = ACTION_PRIORITY_LABELS[v];
    priority.appendChild(o);
  });
  form.appendChild(fieldWrap("Priority", priority));

  const horizon = document.createElement("select");
  horizon.id = "action-horizon";
  ["short", "long"].forEach((v) => {
    const o = document.createElement("option");
    o.value = v; o.textContent = ACTION_HORIZON_LABELS[v];
    horizon.appendChild(o);
  });
  form.appendChild(fieldWrap("Horizon", horizon));

  const responsibleInput = document.createElement("input");
  responsibleInput.type = "text";
  responsibleInput.id = "action-responsible";
  responsibleInput.placeholder = "e.g. Me, or a team member";
  form.appendChild(fieldWrap("Who is responsible", responsibleInput));

  const targetDate = document.createElement("input");
  targetDate.type = "date";
  targetDate.id = "action-date";
  form.appendChild(fieldWrap("Target date (optional)", targetDate));

  const measureInput = document.createElement("input");
  measureInput.type = "text";
  measureInput.id = "action-measure";
  measureInput.placeholder = "e.g. One review completed each week for six weeks";
  form.appendChild(fieldWrap("How you will know it worked", measureInput));

  const status = document.createElement("select");
  status.id = "action-status";
  ["open", "in-progress", "done"].forEach((v) => {
    const o = document.createElement("option");
    o.value = v; o.textContent = ACTION_STATUS_LABELS[v];
    status.appendChild(o);
  });
  form.appendChild(fieldWrap("Status", status));

  const buttons = el("div", "form-actions");
  const saveBtn = el("button", "", "Save action");
  saveBtn.type = "submit";
  const cancelBtn = el("button", "secondary", "Cancel");
  cancelBtn.type = "button";
  cancelBtn.addEventListener("click", closeActionEditor);
  buttons.appendChild(saveBtn);
  buttons.appendChild(cancelBtn);
  form.appendChild(buttons);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return; }
    const base = editingAction || {};
    upsertAction({
      id: base.id,
      title: title,
      description: descInput.value.trim(),
      benefit: benefitInput.value.trim(),
      priority: priority.value,
      horizon: horizon.value,
      responsible: responsibleInput.value.trim(),
      targetDate: targetDate.value,
      successMeasure: measureInput.value.trim(),
      status: status.value,
      createdAt: base.createdAt,
      updatedAt: Date.now()
    });
    editingAction = null;
    closeActionEditor();
    renderActions();
    renderRoadmap();
    renderProgress();
  });

  host.appendChild(form);

  if (action) {
    titleInput.value = action.title || "";
    descInput.value = action.description || "";
    benefitInput.value = action.benefit || "";
    priority.value = action.priority || "medium";
    horizon.value = action.horizon || "short";
    responsibleInput.value = action.responsible || "";
    targetDate.value = action.targetDate || "";
    measureInput.value = action.successMeasure || "";
    status.value = action.status || "open";
    saveBtn.textContent = "Save changes";
    host.scrollIntoView({ block: "start", behavior: "auto" });
  }
}

function openActionEditor(action) {
  editingAction = action || null;
  initActionEditor(action);
}

function initActions() {
  const addBtn = document.getElementById("action-add-btn");
  if (addBtn) addBtn.addEventListener("click", () => openActionEditor(null));
}

/* ---- Phase 4: roadmap ---------------------------------------------------- */

function mkRoadmapCol(title, items) {
  const col = el("div", "roadmap-col");
  col.appendChild(el("h3", "", title));
  if (!items.length) col.appendChild(el("p", "muted", "Nothing here yet."));
  items.forEach((it) => {
    col.appendChild(el("div", "roadmap-item", ""));
    const card = col.lastChild;
    card.appendChild(el("h4", "", it.heading));
    card.appendChild(el("p", "", it.body));
    if (it.related) card.appendChild(el("span", "link-hint", "Supports: " + it.related));
  });
  return col;
}

function toRoadmapItems(tips) {
  return tips.map((t) => ({ heading: (t.icon || "") + " " + t.label, body: t.text || t.benefit || "" }));
}

function renderRoadmap() {
  const body = document.getElementById("roadmap-body");
  if (!body) return;
  clearChildren(body);

  const result = finalizeAssessment(CATEGORIES, loadAnswers());
  const scored = result.categories;

  const tips30 = toRoadmapItems(roadmap30(scored));
  const tips90 = toRoadmapItems(roadmap90(scored));
  const tips12 = toRoadmapItems(roadmap12(scored));

  const actions = loadActions();
  const shorts = actions.filter((a) => a.horizon === "short" && a.status !== "done");
  const longs = actions.filter((a) => a.horizon === "long" && a.status !== "done");

  const note = el("p", "muted", "A suggested path based on your answers. Short-term priorities move you toward longer-term objectives.");
  body.appendChild(note);

  const cols = el("div", "roadmap-columns");

  if (scored.every((c) => c.score100 == null)) {
    cols.appendChild(mkRoadmapCol("Next 30 days", [{
      heading: "Begin your assessment",
      body: "Answer the questions in the Assessment tab and this roadmap will fill with a personalised 30 / 90 / 12-month path."
    }]));
    cols.appendChild(mkRoadmapCol("Next 90 days", [{
      heading: "Pick one improvement",
      body: "Choose the area that most needs attention and add a first action in the Action plan tab."
    }]));
    cols.appendChild(mkRoadmapCol("6-12 months", [{
      heading: "Build resilience",
      body: "Fill in the Scenarios tab to make your business more robust for whatever comes next."
    }]));
    body.appendChild(cols);
    body.appendChild(el("p", "link-hint", "Short-term priorities connect toward longer-term goals."));
    return;
  }

  cols.appendChild(mkRoadmapCol("Next 30 days", tips30));
  cols.appendChild(mkRoadmapCol("Next 90 days", tips90));
  cols.appendChild(mkRoadmapCol("6-12 months", tips12));
  body.appendChild(cols);

  const yours = el("div", "roadmap-columns");
  yours.appendChild(mkRoadmapCol("Short-term priorities", shorts.map((a) => ({
    heading: a.title,
    body: [a.description, a.benefit, a.targetDate ? "By " + a.targetDate : ""].filter(Boolean).join(" ") || ""
  }))));
  yours.appendChild(mkRoadmapCol("Longer-term goals", longs.map((a) => ({
    heading: a.title,
    body: [a.description, a.benefit, a.targetDate ? "By " + a.targetDate : ""].filter(Boolean).join(" ") || ""
  }))));
  body.appendChild(yours);

  body.appendChild(el("p", "link-hint", "Every short-term priority links to at least one longer-term objective."));
}

/* ---- Phase 5: scenarios -------------------------------------------------- */

function renderScenarios() {
  const listEl = document.getElementById("scenarios-list");
  if (!listEl) return;
  clearChildren(listEl);
  const saved = loadScenarios();

  SCENARIOS.forEach((sc) => {
    const card = el("section", "scenario-card");
    card.appendChild(el("h3", "", sc.icon + " " + sc.label));
    card.appendChild(el("p", "desc", sc.description));

    const fields = saved[sc.id] || {};
    const filled = SCENARIO_FIELDS.filter((f) => fields[f.key]).length;

    const status = el("p", "scenario-status", filled
      ? "Prepared " + filled + " of " + SCENARIO_FIELDS.length + "."
      : "Not prepared yet — that's the whole point of this exercise.");
    card.appendChild(status);

    const form = el("form", "scenario-form");
    form.setAttribute("data-scenario", sc.id);

    SCENARIO_FIELDS.forEach((f) => {
      const field = el("div", "field");
      const label = el("label", "", f.label);
      label.htmlFor = "scenario_" + sc.id + "_" + f.key;
      const input = document.createElement("textarea");
      input.id = "scenario_" + sc.id + "_" + f.key;
      input.name = f.key;
      input.value = fields[f.key] || "";
      input.rows = 2;
      field.appendChild(label);
      field.appendChild(input);
      form.appendChild(field);
    });

    const actions = el("div", "form-actions");
    const saveBtn = el("button", "", filled ? "Update plan" : "Save plan");
    saveBtn.type = "submit";
    actions.appendChild(saveBtn);
    form.appendChild(actions);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = {};
      SCENARIO_FIELDS.forEach((f) => {
        const input = form.querySelector('[name="' + f.key + '"]');
        data[f.key] = input ? input.value.trim() : "";
      });
      saveScenario(sc.id, data);
      renderScenarios();
      setDataStatus("Saved your " + sc.label + " scenario.", false);
    });

    card.appendChild(form);
    listEl.appendChild(card);
  });
}

/* ---- assessment snapshots (progress) ------------------------------------- */

function createSnapshot() {
  const result = finalizeAssessment(CATEGORIES, loadAnswers());
  if (result.overall == null) return null;
  const profile = loadProfile();
  return {
    id: newId("snap"),
    label: profile.businessName ? profile.businessName + " snapshot" : "Snapshot",
    createdAt: Date.now(),
    overall: result.overall,
    level: result.level,
    categories: result.categories.map((c) => ({
      id: c.id,
      label: c.label,
      icon: c.icon,
      score100: c.score100,
      avg: c.avg
    })),
    profile: profile
  };
}

function pushAssessmentSnapshot() {
  const snap = createSnapshot();
  if (!snap) return null;
  return pushSnapshot(snap);
}

function renderProgress() {
  const body = document.getElementById("progress-body");
  if (!body) return;
  clearChildren(body);

  const result = finalizeAssessment(CATEGORIES, loadAnswers());
  const history = loadHistory();
  const historyLen = history.length;

  const summary = el("div", "progress-metrics");
  const answeredToday = assessAnsweredTotal();
  const total = CATEGORIES.reduce((n, c) => n + c.questions.length, 0);

  const metric = (label, value) => {
    const card = el("div", "metric-card");
    card.appendChild(el("div", "value", value));
    card.appendChild(el("div", "label", label));
    return card;
  };

  summary.appendChild(metric("Current readiness", result.overall == null ? "—" : result.overall));
  summary.appendChild(metric("Questions answered", answeredToday + " / " + total));
  summary.appendChild(metric("Saved snapshots", String(historyLen)));

  const currentLevel = levelFor(result.overall);
  if (currentLevel) {
    summary.appendChild(metric("Level", currentLevel.label));
  }
  body.appendChild(summary);

  if (result.overall == null) {
    const block = el("div", "dash-block");
    block.appendChild(el("h3", "", "Progress starts with an assessment"));
    block.appendChild(el("p", "level-note", "Answer the questions, then keep a snapshot here. Re-taking the assessment later shows your trend."));
    const link = el("button", "", "Take the assessment");
    link.type = "button";
    link.addEventListener("click", () => showPanel("assessment"));
    block.appendChild(link);
    body.appendChild(block);
    return;
  }

  if (historyLen < 2) {
    const block = el("div", "dash-block");
    block.appendChild(el("h3", "", "A little progress history"));
    block.appendChild(el("p", "level-note",
      historyLen === 0
        ? "Save your first snapshot to start a progress record."
        : "Comparison views appear once two snapshots are saved. Reassess in 30-90 days and compare."));
    const btn = el("button", "", historyLen === 0 ? "Save my first snapshot" : "Save another snapshot");
    btn.type = "button";
    btn.addEventListener("click", () => {
      pushAssessmentSnapshot();
      renderProgress();
      setDataStatus("Snapshot saved. Reassess later to see your progress.", false);
    });
    block.appendChild(btn);
    body.appendChild(block);
  } else {
    const block = el("div", "dash-block");
    block.appendChild(el("h3", "", "Your progress between assessments"));
    const cmp = compareSnapshots(history[historyLen - 2], history[historyLen - 1]);
    const delta = cmp.overallDelta;
    if (delta == null) {
      block.appendChild(el("p", "level-note", "Both snapshots need a score to compare. Re-save when your assessment is complete."));
    } else {
      const deltaEl = el("div", delta > 0 ? "delta-up" : delta < 0 ? "delta-down" : "delta-flat",
        delta === 0 ? "No change since your last snapshot." : (delta > 0 ? "+" + delta : delta) + " points since your last snapshot.");
      block.appendChild(deltaEl);
    }
    body.appendChild(block);

    const table = el("table", "compare-table");
    table.appendChild(el("caption", "muted", "Area by area: before and now."));
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    ["Area", "Before", "Now", "Change"].forEach((t) => {
      const th = document.createElement("th");
      th.textContent = t;
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    cmp.categories.forEach((c) => {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = (c.icon || "") + " " + c.label;
      tr.appendChild(name);
      [c.previous, c.score100].forEach((val) => {
        const td = document.createElement("td");
        td.textContent = val == null ? "—" : val;
        tr.appendChild(td);
      });
      const td = document.createElement("td");
      if (c.previous != null && c.score100 != null) {
        const diff = c.score100 - c.previous;
        td.textContent = diff === 0 ? "—" : (diff > 0 ? "+" + diff : diff);
        td.className = diff === 0 ? "delta-flat" : diff > 0 ? "delta-up" : "delta-down";
      } else td.textContent = "—";
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    body.appendChild(table);

    const btn = el("button", "", "Save a new snapshot");
    btn.type = "button";
    btn.addEventListener("click", () => {
      pushAssessmentSnapshot();
      renderProgress();
      setDataStatus("Snapshot saved.", false);
    });
    body.appendChild(btn);
  }
}

/* ---- data / export / print ---------------------------------------------- */

function setDataStatus(message, isError) {
  const status = document.getElementById("data-status");
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? "var(--weakness)" : "var(--muted)";
}

function downloadFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 50);
}

function exportReportText() {
  const p = loadProfile();
  const result = finalizeAssessment(CATEGORIES, loadAnswers());
  const lines = [];
  lines.push("BUSINESS GROWTH & RESILIENCE REPORT");
  lines.push("Generated: " + new Date().toLocaleDateString());
  lines.push("");
  if (p.businessName) lines.push("Business: " + p.businessName);
  if (p.industry) lines.push("Industry: " + p.industry);
  lines.push("");
  if (result.overall == null) {
    lines.push("Assessment in progress — complete the questions to see a full report.");
  } else {
    lines.push("Overall readiness: " + result.overall + " / 100 (" + (result.level || "") + ")");
    lines.push("");
    lines.push("By area:");
    result.categories.forEach((c) => {
      lines.push("  " + (c.score100 == null ? c.label + ": not answered" : c.label + ": " + c.score100 + "/100 (" + (c.band || "") + ")"));
    });
    lines.push("");
    const top = topStrengths(result.categories, 3);
    if (top.length) {
      lines.push("Working well:");
      top.forEach((c) => lines.push("  - " + c.label + ": " + recommendationFor(c, "strength")));
    }
    const opps = topOpportunities(result.categories, 3);
    if (opps.length) {
      lines.push("Improvement opportunities:");
      opps.forEach((c) => lines.push("  - " + c.label + ": " + recommendationFor(c, "opportunity")));
    }
    lines.push("");
    lines.push("Actions in your plan:");
    const actions = loadActions();
    if (actions.length) actions.forEach((a) => lines.push("  - " + a.title + " [" + ACTION_PRIORITY_LABELS[a.priority] + "]"));
    else lines.push("  (none yet)");
    lines.push("");
    lines.push("Scenario preparation:");
    const scenarios = loadScenarios();
    if (Object.keys(scenarios).length) {
      SCENARIOS.forEach((sc) => {
        const fields = scenarios[sc.id] || {};
        const filled = SCENARIO_FIELDS.filter((f) => fields[f.key]).length;
        lines.push("  - " + sc.label + ": " + filled + "/" + SCENARIO_FIELDS.length + " prepared");
      });
    } else {
      lines.push("  (no scenarios prepared yet)");
    }
  }
  lines.push("");
  lines.push("Everything above stays on your device.");
  downloadFile("business-growth-coach-report.txt", lines.join("\n"));
  setDataStatus("Report exported as .txt.", false);
}

function exportBackup() {
  downloadFile("business-growth-coach-backup.json", exportAll(), "application/json");
  setDataStatus("Backup exported.", false);
}

function importBackupFile(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    setDataStatus("Backup too large (5 MB max).", true);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || "");
      importAll(text);
      renderAll();
      setDataStatus("Backup restored.", false);
    } catch (err) {
      setDataStatus("Backup failed: " + (err && err.message ? err.message : String(err)), true);
    }
  };
  reader.onerror = () => setDataStatus("Could not read that file.", true);
  reader.readAsText(file);
}

function renderAll() {
  renderGreeting();
  renderAssessment();
  renderDashboard();
  renderActions();
  renderRoadmap();
  renderScenarios();
  renderProgress();
  updateAssessProgress();
}

function resetAllDataUI() {
  if (!confirm("Start over? This removes your profile, answers, actions, scenarios, and saved history on this device. Export a backup first to keep a copy.")) return;
  resetAllData();
  editingAction = null;
  assessState.active = 0;
  renderAll();
  showPanel("profile");
  setDataStatus("All Coach data cleared on this device.", false);
}

function initDataTools() {
  const exportAllBtn = document.getElementById("export-all-btn");
  const importBtn = document.getElementById("import-all-btn");
  const importFile = document.getElementById("import-all-file");
  const printBtn = document.getElementById("print-report-btn");
  const exportTextBtn = document.getElementById("export-text-btn");
  const resetBtn = document.getElementById("reset-all-btn");

  if (exportAllBtn) exportAllBtn.addEventListener("click", exportBackup);
  if (importBtn) importBtn.addEventListener("click", () => { if (importFile) importFile.click(); });
  if (importFile) importFile.addEventListener("change", () => {
    importBackupFile(importFile.files && importFile.files[0]);
    importFile.value = "";
  });
  if (printBtn) printBtn.addEventListener("click", () => {
    const generated = document.getElementById("print-generated");
    if (generated) generated.textContent = "Generated " + new Date().toLocaleDateString() + " by Business Growth & Resilience Coach";
    document.body.classList.add("printing");
    window.print();
    setTimeout(() => document.body.classList.remove("printing"), 100);
  });
  if (exportTextBtn) exportTextBtn.addEventListener("click", exportReportText);
  if (resetBtn) resetBtn.addEventListener("click", resetAllDataUI);
}

/* ---- boot -------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initProfile();
  renderGreeting();
  initAssessment();
  initActions();
  initDataTools();
  initAnalyze();
  initOverlayGlobals();
  showPanel("profile");
});