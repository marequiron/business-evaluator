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
const MODE_KEY = "business-evaluator-mode-v1";
// New users with no saved choice get the plain-language wording.
const DEFAULT_MODE = "simple";

const state = {
  answers: loadAnswers(),
  mode: loadMode(),
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

function loadMode() {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    return raw === "standard" ? "standard" : "simple";
  } catch (e) {
    return DEFAULT_MODE;
  }
}

function saveMode() {
  localStorage.setItem(MODE_KEY, state.mode);
}

function toggleMode() {
  state.mode = state.mode === "simple" ? "standard" : "simple";
  saveMode();
  updateToggleLabel();
  renderForm();
  const resultsEl = document.getElementById("results");
  if (resultsEl.childElementCount > 0) renderResults();
}

function updateToggleLabel() {
  const btn = document.getElementById("toggle-btn");
  if (!btn) return;
  const simple = state.mode === "simple";
  btn.textContent = simple ? "🔤 Use business language" : "🗣️ Use simple language";
  btn.classList.toggle("active", simple);
}

function questionText(q) {
  return state.mode === "simple" ? q.simple : q.text;
}

function recommendationText(rec) {
  return state.mode === "simple" ? rec.simple : rec.text;
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

      const qLabel = document.createElement("p");
      qLabel.textContent = questionText(q);
      qWrap.appendChild(qLabel);

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

function renderChart(results) {
  const wrap = document.createElement("div");
  wrap.className = "chart-wrap";
  const title = document.createElement("h2");
  title.textContent = "Score Overview (1-5 per category)";
  wrap.appendChild(title);

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

      const rec = document.createElement("p");
      rec.textContent = recommendationText(item.recommendations[band]);
      card.appendChild(rec);

      wrap.appendChild(card);
    });

  return wrap;
}

function hasAnyAnswers() {
  return computeScores().some((r) => r.band !== "unanswered");
}

function buildResultsText() {
  const results = computeScores();
  const modeNote = state.mode === "simple"
    ? "Language: simple"
    : "Language: business";
  const lines = [
    "BUSINESS SELF-EVALUATION RESULTS",
    `Generated: ${new Date().toLocaleString()}`,
    modeNote,
    "",
  ];
  results.forEach((r) => {
    lines.push(`${r.label}: ${r.avg ? r.avg.toFixed(1) : "N/A"}/5 (${r.band})`);
    if (r.band !== "unanswered") lines.push(`  -> ${recommendationText(r.recommendations[r.band])}`);
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
    language: state.mode,
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
  updateToggleLabel();
  renderForm();
  document.getElementById("toggle-btn").addEventListener("click", toggleMode);
  document.getElementById("evaluate-btn").addEventListener("click", renderResults);
  const submitBtn = document.getElementById("submit-btn");
  submitBtn.addEventListener("click", submitResults);
  document.getElementById("export-btn").addEventListener("click", exportResults);
  document.getElementById("reset-btn").addEventListener("click", resetAll);
  setupConsentGate(submitBtn);
});

function setupConsentGate(submitBtn) {
  const consentText = (SUBMIT_FORM && SUBMIT_FORM.consentText) || "";
  if (!consentText) return;
  const block = document.getElementById("consent-block");
  document.getElementById("consent-text").textContent = consentText;
  block.hidden = false;
  submitBtn.disabled = true;
  document.getElementById("consent-checkbox").addEventListener("change", (e) => {
    submitBtn.disabled = !e.target.checked;
  });
}