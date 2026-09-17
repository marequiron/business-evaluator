/**
 * app.js
 * Renders the assessment form, computes scores, and displays the
 * Strengths / Weaknesses / Opportunities / Recommendations dashboard.
 *
 * This intentionally has NO backend/build step — open index.html directly,
 * or serve it with any static server. State is kept in localStorage so a
 * user's answers (and language choice) persist between visits.
 */

const STORAGE_KEY = "business-evaluator-answers-v1";
// Questions and recommendations always show the business wording; the
// plain-language version is revealed on demand by the ⓘ overlay below.
const LANGUAGE = "standard";

const state = {
  answers: loadAnswers(),
};

function loadAnswers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveAnswers() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.answers));
}

// Plain-language text used by the ⓘ overlay. Returns "" when none is defined
// so the caller can omit the button entirely.
function questionPlainText(q) {
  return q && q.simple ? q.simple : "";
}

function recommendationPlainText(rec) {
  return rec && rec.simple ? rec.simple : "";
}

const INFO_OVERLAY_ID = "info-overlay";
let activeInfoButton = null;

function getInfoOverlay() {
  let el = document.getElementById(INFO_OVERLAY_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = INFO_OVERLAY_ID;
    el.className = "info-overlay";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-hidden", "true");
    el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}

function closeInfoOverlay() {
  const overlay = getInfoOverlay();
  if (overlay.hidden) return;
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  overlay.classList.remove("info-overlay--above");
  if (activeInfoButton) {
    activeInfoButton.setAttribute("aria-expanded", "false");
    activeInfoButton = null;
  }
}

function positionInfoOverlay(button, overlay) {
  const margin = 10;
  const rect = button.getBoundingClientRect();
  overlay.style.visibility = "hidden";
  overlay.hidden = false;
  const oRect = overlay.getBoundingClientRect();

  let top = rect.bottom + margin;
  let above = false;
  if (top + oRect.height > window.innerHeight - margin && rect.top - margin - oRect.height > margin) {
    top = rect.top - margin - oRect.height;
    above = true;
  }

  let left = rect.left;
  if (left + oRect.width > window.innerWidth - margin) left = window.innerWidth - margin - oRect.width;
  if (left < margin) left = margin;

  overlay.classList.toggle("info-overlay--above", above);
  overlay.style.top = Math.round(top) + "px";
  overlay.style.left = Math.round(left) + "px";
  overlay.style.visibility = "visible";
}

function toggleInfoOverlay(button, title, text) {
  const overlay = getInfoOverlay();
  if (activeInfoButton === button && !overlay.hidden) {
    closeInfoOverlay();
    return;
  }
  if (activeInfoButton) activeInfoButton.setAttribute("aria-expanded", "false");
  activeInfoButton = button;
  button.setAttribute("aria-expanded", "true");

  overlay.innerHTML = "";
  const label = document.createElement("span");
  label.className = "info-overlay-title";
  label.textContent = title;
  const body = document.createElement("p");
  body.className = "info-overlay-text";
  body.tabIndex = -1;
  body.textContent = text;
  overlay.appendChild(label);
  overlay.appendChild(body);

  overlay.setAttribute("aria-hidden", "false");
  positionInfoOverlay(button, overlay);
  body.focus({ preventScroll: true });
}

function createInfoButton(title, text) {
  if (!text) return null;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "info-btn";
  btn.textContent = "i";
  btn.setAttribute("aria-label", title);
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("title", title);
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleInfoOverlay(btn, title, text);
  });
  return btn;
}

function answerKey(categoryId, qIndex) {
  return `${categoryId}__${qIndex}`;
}

function renderForm() {
  const form = document.getElementById("assessment-form");
  form.innerHTML = "";

  CATEGORIES.forEach((cat) => {
    const section = document.createElement("section");
    section.className = "category-card";

    const heading = document.createElement("h3");
    heading.textContent = `${cat.icon} ${cat.label}`;
    section.appendChild(heading);

    cat.questions.forEach((q, i) => {
      const key = answerKey(cat.id, i);
      const qWrap = document.createElement("div");
      qWrap.className = "question";

      const qHead = document.createElement("div");
      qHead.className = "question-head";
      const qLabel = document.createElement("p");
      qLabel.textContent = q.text;
      qHead.appendChild(qLabel);
      const qInfo = createInfoButton("Plain-language explanation", questionPlainText(q));
      if (qInfo) qHead.appendChild(qInfo);
      qWrap.appendChild(qHead);

      const scale = document.createElement("div");
      scale.className = "scale";

      for (let val = 1; val <= 5; val++) {
        const id = `${key}_${val}`;
        const input = document.createElement("input");
        input.type = "radio";
        input.name = key;
        input.value = String(val);
        input.id = id;
        if (state.answers[key] === val) input.checked = true;
        input.addEventListener("change", () => {
          state.answers[key] = val;
          saveAnswers();
        });

        const label = document.createElement("label");
        label.htmlFor = id;
        label.textContent = val;

        scale.appendChild(input);
        scale.appendChild(label);
      }

      const scaleHint = document.createElement("div");
      scaleHint.className = "scale-hint";
      scaleHint.innerHTML = "<span>1 = Strongly Disagree</span><span>5 = Strongly Agree</span>";

      qWrap.appendChild(scale);
      qWrap.appendChild(scaleHint);
      section.appendChild(qWrap);
    });

    form.appendChild(section);
  });
}

function computeScores() {
  return CATEGORIES.map((cat) => {
    const values = cat.questions.map((_, i) => state.answers[answerKey(cat.id, i)]).filter((v) => v !== undefined);
    const answered = values.length;
    const total = cat.questions.length;
    const avg = answered > 0 ? values.reduce((a, b) => a + b, 0) / answered : null;
    let band = "unanswered";
    if (avg !== null) {
      if (avg <= SCORE_BANDS.WEAKNESS_MAX) band = "weakness";
      else if (avg <= SCORE_BANDS.OPPORTUNITY_MAX) band = "opportunity";
      else band = "strength";
    }
    return { ...cat, avg, answered, total, band };
  });
}

function renderResults() {
  const results = computeScores();
  const resultsEl = document.getElementById("results");
  resultsEl.innerHTML = "";
  document.getElementById("embed-container").innerHTML = "";

  const unanswered = results.filter((r) => r.band === "unanswered");
  if (unanswered.length === results.length) {
    resultsEl.innerHTML = "<p class='hint'>Answer the questions above, then click \"Evaluate My Business\" to see your results.</p>";
    return;
  }

  const groups = {
    strength: results.filter((r) => r.band === "strength"),
    opportunity: results.filter((r) => r.band === "opportunity"),
    weakness: results.filter((r) => r.band === "weakness"),
  };

  resultsEl.appendChild(renderChart(results));
  resultsEl.appendChild(renderGroup("✅ Strengths", groups.strength, "strength"));
  resultsEl.appendChild(renderGroup("⚠️ Weaknesses", groups.weakness, "weakness"));
  resultsEl.appendChild(renderGroup("🔍 Opportunities to Explore", groups.opportunity, "opportunity"));

  resultsEl.scrollIntoView({ behavior: "smooth" });
}

function evaluate() {
  renderResults();
  const snap = createSnapshot(null);
  if (snap) renderHistory();
}

function renderChart(results) {
  const wrap = document.createElement("div");
  wrap.className = "chart-wrap";
  const title = document.createElement("h2");
  title.textContent = "Score Overview (1-5 per category)";
  wrap.appendChild(title);

  const legend = document.createElement("div");
  legend.className = "chart-legend";
  [["Strength (> 3.8)", "legend-strength"], ["Opportunity (2.5\u20133.8)", "legend-opportunity"], ["Weakness (\u2264 2.5)", "legend-weakness"]].forEach((pair) => {
    const item = document.createElement("span");
    item.className = "legend-item";
    item.innerHTML = "<span class=\"legend-dot " + pair[1] + "\"></span>" + pair[0];
    legend.appendChild(item);
  });
  wrap.appendChild(legend);

  results.forEach((r) => {
    const row = document.createElement("div");
    row.className = "bar-row";

    const label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = `${r.icon} ${r.label}`;

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = `bar-fill bar-${r.band}`;
    const pct = r.avg ? (r.avg / 5) * 100 : 0;
    fill.style.width = `${pct}%`;
    track.appendChild(fill);

    const score = document.createElement("span");
    score.className = "bar-score";
    score.textContent = r.avg ? r.avg.toFixed(1) : "—";

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(score);
    wrap.appendChild(row);
  });

  return wrap;
}

function renderGroup(title, items, band) {
  const wrap = document.createElement("div");
  wrap.className = `group group-${band}`;

  const h2 = document.createElement("h2");
  h2.textContent = `${title} (${items.length})`;
  wrap.appendChild(h2);

  if (items.length === 0) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "None in this category — nice!";
    wrap.appendChild(p);
    return wrap;
  }

  items
    .sort((a, b) => (band === "strength" ? b.avg - a.avg : a.avg - b.avg))
    .forEach((item) => {
      const card = document.createElement("div");
      card.className = "result-card";

      const h3 = document.createElement("h3");
      h3.textContent = `${item.icon} ${item.label} — ${item.avg.toFixed(1)}/5`;
      card.appendChild(h3);

      const reco = item.recommendations[band];
      const recWrap = document.createElement("div");
      recWrap.className = "result-rec";
      const rec = document.createElement("p");
      rec.textContent = reco.text;
      recWrap.appendChild(rec);
      const recInfo = createInfoButton("Plain-language explanation", recommendationPlainText(reco));
      if (recInfo) recWrap.appendChild(recInfo);
      card.appendChild(recWrap);

      wrap.appendChild(card);
    });

  return wrap;
}

function hasAnyAnswers() {
  return computeScores().some((r) => r.band !== "unanswered");
}

function buildResultsText() {
  const results = computeScores();
  const lines = [
    "BUSINESS SELF-EVALUATION RESULTS",
    `Generated: ${new Date().toLocaleString()}`,
    "Language: business",
    "",
  ];
  results.forEach((r) => {
    lines.push(`${r.label}: ${r.avg ? r.avg.toFixed(1) : "N/A"}/5 (${r.band})`);
    if (r.band !== "unanswered") lines.push(`  -> ${r.recommendations[r.band].text}`);
  });
  return lines.join("\n");
}

function exportResults() {
  const blob = new Blob([buildResultsText()], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "business-evaluation-results.txt";
  a.click();
  URL.revokeObjectURL(url);
}

function printResults() {
  if (!hasAnyAnswers()) {
    alert("Answer at least one question, then evaluate, before printing.");
    return;
  }
  if (!document.getElementById("results").childElementCount) {
    renderResults();
  } else {
    renderHistory();
  }
  const gen = document.getElementById("print-generated");
  if (gen) gen.textContent = "Generated: " + new Date().toLocaleString();
  document.body.classList.add("printing");
  try {
    window.print();
  } finally {
    document.body.classList.remove("printing");
  }
}

const HISTORY_KEY = "business-evaluator-history-v1";
const HISTORY_MAX = 100;

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function snapshotPayload() {
  return computeScores().map((r) => ({
    id: r.id,
    label: r.label,
    icon: r.icon,
    avg: r.avg,
    band: r.band,
  }));
}

function createSnapshot(label) {
  if (!hasAnyAnswers()) return null;
  const history = loadHistory();
  const snap = {
    id: "snap_" + Date.now(),
    label: label || "Assessment - " + new Date().toLocaleString(),
    createdAt: Date.now(),
    scores: snapshotPayload(),
  };
  history.push(snap);
  saveHistory(history.slice(-HISTORY_MAX));
  return snap;
}

function saveSnapshotClick() {
  const label = prompt("Give this snapshot a label (optional):");
  if (label === null) return;
  const snap = createSnapshot(label || undefined);
  if (snap) {
    renderHistory();
    alert("Snapshot saved.");
  } else {
    alert("Answer at least one question before saving a snapshot.");
  }
}

function renderHistory() {
  const listEl = document.getElementById("history-list");
  const compareEl = document.getElementById("compare-view");
  if (!listEl) return;

  listEl.innerHTML = "";
  const history = loadHistory();

  if (history.length === 0) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "No saved snapshots yet. Click \"Evaluate My Business\" to auto-save, or \"Save snapshot\" to record one manually.";
    listEl.appendChild(p);
    compareEl.hidden = true;
    return;
  }

  const h2 = document.createElement("h2");
  h2.textContent = "Past snapshots (" + history.length + ")";
  listEl.appendChild(h2);

  [...history].reverse().forEach((s) => {
    const row = document.createElement("div");
    row.className = "history-row";

    const info = document.createElement("div");
    info.className = "history-info";
    const lbl = document.createElement("span");
    lbl.className = "history-label";
    lbl.textContent = s.label;
    const date = document.createElement("span");
    date.className = "history-date";
    date.textContent = new Date(s.createdAt).toLocaleString();
    info.appendChild(lbl);
    info.appendChild(date);

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const cmpBtn = document.createElement("button");
    cmpBtn.type = "button";
    cmpBtn.className = "secondary";
    cmpBtn.textContent = "Compare";
    cmpBtn.addEventListener("click", () => showCompare(s));
    actions.appendChild(cmpBtn);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      if (!confirm("Delete this snapshot?")) return;
      saveHistory(loadHistory().filter((x) => x.id !== s.id));
      renderHistory();
    });
    actions.appendChild(delBtn);

    row.appendChild(info);
    row.appendChild(actions);
    listEl.appendChild(row);
  });

  compareEl.hidden = true;
}

function showCompare(snap) {
  const listEl = document.getElementById("history-list");
  const compareEl = document.getElementById("compare-view");
  if (!listEl || !compareEl) return;

  listEl.hidden = true;
  compareEl.hidden = false;
  compareEl.innerHTML = "";

  const back = document.createElement("button");
  back.type = "button";
  back.className = "secondary";
  back.textContent = "\u2190 Back to history";
  back.addEventListener("click", () => {
    listEl.hidden = false;
    compareEl.hidden = true;
    renderHistory();
  });

  const h2 = document.createElement("h2");
  h2.textContent = "Compare current vs \"" + snap.label + "\"";

  const current = computeScores();
  const table = document.createElement("table");
  table.className = "compare-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Category", "Current", "", "Snapshot", "Change"].forEach((t) => {
    const th = document.createElement("th");
    th.textContent = t;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const pastScores = Array.isArray(snap.scores) ? snap.scores : [];

  current.forEach((c) => {
    const past = pastScores.find((s) => s.id === c.id);
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.textContent = c.icon + " " + c.label;

    const curTd = document.createElement("td");
    curTd.textContent = c.avg ? c.avg.toFixed(1) : "\u2014";

    const arrowTd = document.createElement("td");
    arrowTd.textContent = "\u2192";

    const pastTd = document.createElement("td");
    pastTd.textContent = (past && past.avg != null) ? past.avg.toFixed(1) : "\u2014";

    const deltaTd = document.createElement("td");
    if (past && c.avg != null && past.avg != null) {
      const delta = c.avg - past.avg;
      deltaTd.textContent = (delta > 0 ? "+" : "") + delta.toFixed(1);
      deltaTd.className = delta > 0 ? "delta-up" : (delta < 0 ? "delta-down" : "delta-flat");
    } else {
      deltaTd.textContent = "\u2014";
    }

    tr.appendChild(nameTd);
    tr.appendChild(curTd);
    tr.appendChild(arrowTd);
    tr.appendChild(pastTd);
    tr.appendChild(deltaTd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  compareEl.appendChild(back);
  compareEl.appendChild(h2);
  compareEl.appendChild(table);
}

function exportHistoryJson() {
  const history = loadHistory();
  if (history.length === 0) {
    alert("No snapshots to export yet.");
    return;
  }
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "business-evaluator-history.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importHistoryJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      const valid = parsed.filter((s) => s && typeof s.id === "string" && Array.isArray(s.scores));
      if (valid.length === 0) throw new Error("no valid snapshots found");
      const merged = loadHistory();
      const known = new Set(merged.map((s) => s.id));
      valid.forEach((s) => { if (!known.has(s.id)) merged.push(s); });
      saveHistory(merged.slice(-HISTORY_MAX));
      renderHistory();
      alert("Imported " + valid.length + " snapshot(s).");
    } catch (e) {
      alert("Could not import that file: " + e.message);
    }
  };
  reader.readAsText(file);
}

function buildPrefilledUrl(text) {
  const template = (SUBMIT_FORM && SUBMIT_FORM.prefillTemplate) || "";
  const qIndex = template.indexOf("?");
  if (!template || qIndex === -1) return "";
  const base = template.slice(0, qIndex + 1);
  const params = template
    .slice(qIndex + 1)
    .split("&")
    .map((pair) => {
      const eq = pair.indexOf("=");
      const name = eq === -1 ? pair : pair.slice(0, eq);
      if (name.startsWith("r")) return `${name}=${encodeURIComponent(text)}`;
      return pair;
    });
  return base + params.join("&");
}

function legacyCopy(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch (e) {
    return false;
  }
}

function writeToClipboard(text, done) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => done(true),
      () => done(legacyCopy(text))
    );
  } else {
    done(legacyCopy(text));
  }
}

function buildSubmissionPayload() {
  return {
    language: LANGUAGE,
    categories: computeScores().map((r) => ({
      id: r.id,
      label: r.label,
      score: r.avg,
      band: r.band,
    })),
  };
}

function renderEmbeddedForm(resultsText) {
  const container = document.getElementById("embed-container");
  container.innerHTML = "";

  const embedUrl = (SUBMIT_FORM && SUBMIT_FORM.embedUrl) || "";
  if (!embedUrl) return;

  const prefillUrl = buildPrefilledUrl(resultsText);
  const formUrl = (SUBMIT_FORM && SUBMIT_FORM.formUrl) || "";
  const openUrl = prefillUrl || formUrl || "";

  const section = document.createElement("div");
  section.className = "embed-section";

  const heading = document.createElement("h2");
  heading.textContent = "Submit your results";
  section.appendChild(heading);

  const instr = document.createElement("p");
  instr.textContent =
    'Copy your results below, then paste them into the "Your evaluation results" field in the form.';
  section.appendChild(instr);

  const actions = document.createElement("div");
  actions.className = "embed-actions";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "secondary";
  copyBtn.textContent = "Copy results";
  copyBtn.addEventListener("click", () => {
    writeToClipboard(resultsText, (ok) => {
      if (ok) {
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy results"; }, 2000);
      } else {
        alert(
          "Could not copy automatically. Export your results (.txt) and paste them into the form manually."
        );
      }
    });
  });
  actions.appendChild(copyBtn);

  if (openUrl) {
    const link = document.createElement("a");
    link.className = "prefill-link";
    link.href = openUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Open form in new tab";
    actions.appendChild(link);
  }

  section.appendChild(actions);

  const preview = document.createElement("div");
  preview.className = "embed-results-preview";
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "View your results text";
  details.appendChild(summary);
  const pre = document.createElement("pre");
  pre.textContent = resultsText;
  details.appendChild(pre);
  preview.appendChild(details);
  section.appendChild(preview);

  const iframeWrap = document.createElement("div");
  iframeWrap.className = "embed-iframe-wrap";
  const iframe = document.createElement("iframe");
  iframe.className = "embed-iframe";
  iframe.src = embedUrl;
  iframe.title = "Microsoft Form";
  iframe.allow = "fullscreen";
  iframeWrap.appendChild(iframe);
  section.appendChild(iframeWrap);

  container.appendChild(section);
  section.scrollIntoView({ behavior: "smooth" });
}

async function submitResults() {
  if (!hasAnyAnswers()) {
    alert("Answer the questions above first, then submit your results.");
    return;
  }
  const apiUrl = (SUBMIT_FORM && SUBMIT_FORM.apiUrl) || "";
  if (apiUrl) {
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSubmissionPayload()),
      });
      if (res.ok) {
        alert("Your results were submitted.");
        return;
      }
      alert(`Submission failed (${res.status}). Falling back to the form.`);
    } catch (e) {
      alert("Could not reach the submission service — falling back to the form.");
    }
  }
  const text = buildResultsText();
  const embedUrl = (SUBMIT_FORM && SUBMIT_FORM.embedUrl) || "";
  if (embedUrl) {
    renderEmbeddedForm(text);
    return;
  }

  const prefill = buildPrefilledUrl(text);
  if (prefill) {
    window.open(prefill, "_blank", "noopener");
    return;
  }
  writeToClipboard(text, (ok) => {
    const formUrl = (SUBMIT_FORM && SUBMIT_FORM.formUrl) || "";
    if (formUrl) {
      window.open(formUrl, "_blank", "noopener");
      if (ok) {
        alert("Your results were copied to the clipboard — open the form and paste them into the \"Your evaluation results\" field.");
      } else {
        alert("Could not copy automatically. Export your results (.txt) and paste them into the form instead.");
      }
    } else {
      if (ok) {
        alert("Your results were copied to the clipboard. To enable one-click submission, set SUBMIT_FORM.formUrl in js/data.js to your Microsoft Form link.");
      } else {
        alert("Submission is not configured yet. Set SUBMIT_FORM.embedUrl (or apiUrl/formUrl) in js/data.js.");
      }
    }
  });
}

function resetAll() {
  if (!confirm("Clear all answers and start over?")) return;
  state.answers = {};
  saveAnswers();
  renderForm();
  document.getElementById("results").innerHTML = "";
  document.getElementById("embed-container").innerHTML = "";
}

document.addEventListener("DOMContentLoaded", () => {
  renderForm();
  document.getElementById("evaluate-btn").addEventListener("click", evaluate);
  document.getElementById("submit-btn").addEventListener("click", submitResults);
  document.getElementById("export-btn").addEventListener("click", exportResults);
  document.getElementById("print-btn").addEventListener("click", printResults);
  document.getElementById("reset-btn").addEventListener("click", resetAll);

  const saveSnapBtn = document.getElementById("save-snapshot-btn");
  if (saveSnapBtn) saveSnapBtn.addEventListener("click", saveSnapshotClick);
  const exportHistBtn = document.getElementById("export-history-btn");
  if (exportHistBtn) exportHistBtn.addEventListener("click", exportHistoryJson);
  const importHistBtn = document.getElementById("import-history-btn");
  const importFile = document.getElementById("import-history-file");
  if (importHistBtn && importFile) {
    importHistBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", (e) => {
      importHistoryJson(e.target.files[0]);
      e.target.value = "";
    });
  }
  renderHistory();

  document.addEventListener("click", (event) => {
    const overlay = getInfoOverlay();
    if (overlay.hidden) return;
    if (overlay.contains(event.target)) return;
    if (activeInfoButton && activeInfoButton.contains(event.target)) return;
    closeInfoOverlay();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeInfoOverlay();
  });
  window.addEventListener("resize", closeInfoOverlay);
  window.addEventListener("scroll", closeInfoOverlay, true);
});