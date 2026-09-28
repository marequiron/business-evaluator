/**
 * scoring.js
 * Pure, DOM-free scoring + planning logic for the Business Growth &
 * Resilience Coach. Nothing here touches the document, so it is fully
 * testable in Node (test/scoring.test.js).
 *
 * Contract:
 *  - Answers are keyed "<categoryId>__<qIndex>" with values 1-5 or null (N/A).
 *  - A category's score is the mean of its answered questions, mapped to the
 *    0-100 scale as round((avg - 1) / 4 * 100).
 *  - Readiness is the mean of answered categories' 100-scores.
 */

/* ---- raw helpers -------------------------------------------------------- */

function answerKey(categoryId, qIndex) {
  return categoryId + "__" + qIndex;
}

function numericAnswersFor(category, answers) {
  return category.questions
    .map((_, i) => answers[answerKey(category.id, i)])
    .filter((v) => typeof v === "number" && v >= 1 && v <= 5);
}

function categoryScore(category, answers) {
  const values = numericAnswersFor(category, answers);
  if (values.length === 0) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    avg: round1(avg),
    score100: Math.round(((avg - 1) / 4) * 100),
    answered: values.length,
    total: category.questions.length
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/* ---- category band (for backward-compatible labels) --------------------- */

function bandForAvg(avg) {
  if (avg == null) return "unanswered";
  if (avg <= SCORE_BANDS.WEAKNESS_MAX) return "weakness";
  if (avg <= SCORE_BANDS.OPPORTUNITY_MAX) return "opportunity";
  return "strength";
}

/* Middle-band labels for individual 1-5 answers (score-assist badges). */
function scoreLabelFor(value) {
  if (value == null || value < 1 || value > 5) return "";
  if (value <= SCORE_BANDS.WEAKNESS_MAX) return "weakness";
  if (value <= SCORE_BANDS.OPPORTUNITY_MAX) return "opportunity";
  return "strength";
}

/* ---- assessment --------------------------------------------------------- */

function computeCategoryScores(categories, answers) {
  return categories.map((cat) => {
    const sc = categoryScore(cat, answers);
    return {
      id: cat.id,
      label: cat.label,
      icon: cat.icon,
      help: cat.help || "",
      avg: sc ? sc.avg : null,
      score100: sc ? sc.score100 : null,
      answered: sc ? sc.answered : 0,
      total: sc ? sc.total : cat.questions.length,
      band: sc ? bandForAvg(sc.avg) : "unanswered",
      recommendations: cat.recommendations
    };
  });
}

function overallReadiness(categoryScores) {
  const scored = categoryScores.filter((c) => c.score100 != null);
  if (scored.length === 0) return null;
  const total = scored.reduce((sum, c) => sum + c.score100, 0);
  return Math.round(total / scored.length);
}

function levelFor(score100) {
  if (score100 == null) return null;
  const band = READINESS_LEVELS.find((l) => score100 >= l.min) || READINESS_LEVELS[READINESS_LEVELS.length - 1];
  return band;
}

function finalizeAssessment(categories, answers) {
  const categoriesOut = computeCategoryScores(categories, answers);
  const overall = overallReadiness(categoriesOut);
  const level = levelFor(overall);
  return {
    categories: categoriesOut,
    overall: overall,
    level: level ? level.label : "",
    levelHint: level ? level.hint : ""
  };
}

/* ---- dashboard blocks --------------------------------------------------- */

const STRENGTH_MIN = 68;
const RISK_MAX = 40;

function rankScores(categoryScores) {
  return categoryScores.filter((c) => c.score100 != null);
}

function topStrengths(categoryScores, limit) {
  const n = limit || 3;
  return rankScores(categoryScores)
    .filter((c) => c.score100 >= STRENGTH_MIN)
    .sort((a, b) => b.score100 - a.score100)
    .slice(0, n);
}

function topOpportunities(categoryScores, limit) {
  const n = limit || 3;
  return rankScores(categoryScores)
    .filter((c) => c.score100 < STRENGTH_MIN)
    .sort((a, b) => a.score100 - b.score100)
    .slice(0, n);
}

function immediateRisks(categoryScores) {
  return rankScores(categoryScores)
    .filter((c) => c.score100 < RISK_MAX)
    .sort((a, b) => a.score100 - b.score100);
}

function quickWins(categoryScores) {
  return rankScores(categoryScores)
    .filter((c) => c.score100 >= RISK_MAX && c.score100 < STRENGTH_MIN)
    .sort((a, b) => b.score100 - a.score100);
}

/* ---- roadmap (30/90/12-month guidance) ---------------------------------- */

const HORIZON_BANDS = {
  short: "opportunity",
  long: "weakness"
};

function pickRec(category, band) {
  if (!category || !category.recommendations) return "";
  const rec = category.recommendations[band];
  return rec && rec.text ? rec.text : "";
}

function roadmap30(categoryScores) {
  return topOpportunities(categoryScores, 3).map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    text: pickRec(c, "opportunity")
  }));
}

function roadmap90(categoryScores) {
  const scored = rankScores(categoryScores).sort((a, b) => b.score100 - a.score100);
  const gaps = scored.filter((c) => c.score100 < STRENGTH_MIN);
  return gaps.slice(0, 3).map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    text: pickRec(c, "weakness")
  }));
}

function roadmap12(categoryScores) {
  return rankScores(categoryScores)
    .sort((a, b) => a.score100 - b.score100)
    .slice(0, 3)
    .filter((c) => c.score100 < 60)
    .map((c) => ({
      id: c.id,
      label: c.label,
      icon: c.icon,
      text: pickRec(c, "weakness")
    }));
}

/* ---- comparison --------------------------------------------------------- */

function compareSnapshots(previous, current) {
  const prevBy = {};
  (previous.categories || []).forEach((c) => { prevBy[c.id] = c; });
  const categories = (current.categories || []).map((c) => {
    const prev = prevBy[c.id];
    let delta = null;
    if (prev && prev.score100 != null && c.score100 != null) {
      delta = c.score100 - prev.score100;
    }
    return { id: c.id, label: c.label, icon: c.icon, score100: c.score100, previous: prev ? prev.score100 : null, delta: delta };
  });
  let overallDelta = null;
  if (previous.overall != null && current.overall != null) {
    overallDelta = current.overall - previous.overall;
  }
  return { categories: categories, overallDelta: overallDelta };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    answerKey: answerKey,
    numericAnswersFor: numericAnswersFor,
    categoryScore: categoryScore,
    bandForAvg: bandForAvg,
    scoreLabelFor: scoreLabelFor,
    computeCategoryScores: computeCategoryScores,
    overallReadiness: overallReadiness,
    levelFor: levelFor,
    finalizeAssessment: finalizeAssessment,
    topStrengths: topStrengths,
    topOpportunities: topOpportunities,
    immediateRisks: immediateRisks,
    quickWins: quickWins,
    roadmap30: roadmap30,
    roadmap90: roadmap90,
    roadmap12: roadmap12,
    compareSnapshots: compareSnapshots,
    STRENGTH_MIN: STRENGTH_MIN,
    RISK_MAX: RISK_MAX
  };
}