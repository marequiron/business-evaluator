'use strict';

/**
 * managed.js — opt-in sign-in gateway for managed (Azure Static Web Apps)
 * deployments.
 *
 * When `MANAGED_ACCESS.enabled` is false (the default), this file does
 * absolutely nothing: the app stays the original privacy-first, offline,
 * no-account tool.
 *
 * When enabled, the app runs behind SWA's Entra ID sign-in. This module:
 *   - probes the SWA auth state (`/.auth/me`, never stores tokens or
 *     identities in localStorage),
 *   - gates the shell until the signed-in user completes one-time onboarding
 *     (display name, language, consents),
 *   - shows friendly states: signed-out / wrong-tenant / expired / first-
 *     login / unassigned / profile-failure / unavailable / ready,
 *   - after onboarding offers an explicit, one-time choice to link this
 *     device's guest data to the account (a summary record only — never the
 *     data content, no automatic import),
 *   - renders a sign-out control.
 *
 * The app (js/app.js) renders as usual — this module simply covers it with a
 * full-screen gate until it is safe to reveal. No identity or token data is
 * ever persisted.
 */

const ManagedAccess = (function () {
  const STATE = {
    IDLE: "idle",
    LOADING: "loading",
    SIGNED_OUT: "signed-out",
    WRONG_TENANT: "wrong-tenant",
    EXPIRED: "expired",
    FIRST_LOGIN: "first-login",
    UNASSIGNED: "unassigned",
    PROFILE_FAILURE: "profile-failure",
    UNAVAILABLE: "unavailable",
    READY: "ready"
  };

  const IMPORT_OFFER_KEY = "coach-managed-import-offered-v1";
  const SWA_ME_SIGNED_OUT_STATUS = 401;

  let state = STATE.IDLE;
  let principal = null;
  let profile = null;
  let config = null;
  let gateEl = null;
  let bannerEl = null;
  let fetchImpl = null;

  /* ---- helpers ---------------------------------------------------------- */

  function enabledConfig() {
    const c = (typeof MANAGED_ACCESS !== "undefined" && MANAGED_ACCESS) || {};
    return c.enabled === true ? c : null;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function visible(node, on) {
    if (node) node.hidden = !on;
  }

  function navigate(path) {
    if (window.location && window.location.assign) window.location.assign(path);
  }

  async function jsonFetch(url, opts) {
    const f = fetchImpl || window.fetch.bind(window);
    const request = Object.assign({ credentials: "same-origin" }, opts);
    const res = await f(url, request);
    const status = res && typeof res.status === "number" ? res.status : 0;
    let body = null;
    try { body = await res.json(); } catch (e) { /* non-JSON response */ }
    return { ok: res ? res.ok : false, status: status, body: body };
  }

  function roleNames(cp) {
    return cp && Array.isArray(cp.userRoles) ? cp.userRoles : [];
  }

  function recognizedRoles() {
    return Array.isArray(config.recognizedRoles) ? config.recognizedRoles : [];
  }

  function hasRecognizedRole(cp) {
    const roles = roleNames(cp);
    return recognizedRoles().some((r) => roles.indexOf(r) !== -1);
  }

  function claimValue(cp, expectedNames) {
    if (!cp || !Array.isArray(cp.claims)) return null;
    const names = expectedNames.map((n) => String(n).toLowerCase());
    for (const claim of cp.claims) {
      const name = String((claim && (claim.name || claim.typ)) || "").toLowerCase();
      if (names.indexOf(name) !== -1) {
        const v = claim && (claim.value !== undefined ? claim.value : claim.val);
        if (v !== undefined && v !== null) return String(v);
      }
    }
    return null;
  }

  function tenantAllowed(cp) {
    if (!config.allowedTenantId) return true;
    const tid = claimValue(cp, ["tid", "tenant_id", "tenant-id"]);
    if (!tid) return false;
    return tid.toLowerCase() === String(config.allowedTenantId).toLowerCase();
  }

  function guestDataSummary() {
    let answers = 0;
    let snapshots = 0;
    try {
      const a = (typeof loadAnswers === "function") ? loadAnswers() : {};
      answers = Object.keys(a || {}).filter((k) => a[k] !== null && a[k] !== undefined).length;
      const h = (typeof loadHistory === "function") ? loadHistory() : [];
      snapshots = Array.isArray(h) ? h.length : 0;
    } catch (e) { /* storage may not be ready in tests */ }
    return { answers: answers, snapshots: snapshots, total: answers + snapshots };
  }

  function guestDataExists() {
    const s = guestDataSummary();
    return s.total > 0;
  }

  function importOffered() {
    try { return localStorage.getItem(IMPORT_OFFER_KEY) === "1"; }
    catch (e) { return false; }
  }

  function markImportOffered() {
    try { localStorage.setItem(IMPORT_OFFER_KEY, "1"); } catch (e) { /* ignore */ }
  }

  /* ---- SWA / API calls -------------------------------------------------- */

  async function checkAuth() {
    const r = await jsonFetch(config.authEndpoint, { method: "GET" });
    if (!r.ok) {
      if (r.status === SWA_ME_SIGNED_OUT_STATUS || r.status === 0) return null;
      throw new Error("auth_endpoint_failed_" + r.status);
    }
    return (r.body && r.body.clientPrincipal) || null;
  }

  async function loadProfile() {
    const r = await jsonFetch(config.apiBase + "/profile", { method: "GET" });
    if (!r.ok) {
      if (r.status === 404) return { status: 404, profile: null };
      if (r.status === 401) return { status: 401, profile: null };
      return { status: r.status, profile: null };
    }
    return { status: 200, profile: r.body || null };
  }

  async function saveProfile(payload) {
    const r = await jsonFetch(config.apiBase + "/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const err = (r.body && r.body.error) || "profile_failure";
      return { ok: false, status: r.status, error: err };
    }
    return { ok: true, profile: r.body };
  }

  async function recordImport(payload) {
    const r = await jsonFetch(config.apiBase + "/profile/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, data: r.body };
  }

  /* ---- transitions ------------------------------------------------------ */

  function setState(next, nextPrincipal, nextProfile) {
    if (nextPrincipal) principal = nextPrincipal;
    if (nextProfile !== undefined) profile = nextProfile;
    state = next;
    render();
  }

  function run() {
    setState(STATE.LOADING);
    return checkAuth()
      .then((cp) => {
        if (!cp || !cp.userId) {
          setState(STATE.SIGNED_OUT);
          return;
        }
        const p = {
          identityProvider: cp.identityProvider || null,
          userId: cp.userId,
          userDetails: cp.userDetails || "",
          userRoles: roleNames(cp)
        };
        if (!tenantAllowed(cp)) {
          setState(STATE.WRONG_TENANT, p);
          return;
        }
        return loadProfile().then((res) => {
          if (res.status === 401) {
            setState(STATE.EXPIRED, p);
            return;
          }
          if (res.status === 500 || res.status === 0) {
            setState(STATE.PROFILE_FAILURE, p);
            return;
          }
          if (res.profile) {
            setState(hasRecognizedRole(cp) ? STATE.READY : STATE.UNASSIGNED, p, res.profile);
            return;
          }
          setState(STATE.FIRST_LOGIN, p);
        });
      })
      .catch((err) => {
        setState(STATE.UNAVAILABLE, null, (err && err.message) ? { _note: err.message } : undefined);
      });
  }

  /* ---- rendering -------------------------------------------------------- */

  function ensureContainers() {
    if (gateEl) return;
    gateEl = document.createElement("section");
    gateEl.id = "managed-gate";
    gateEl.className = "managed-gate";
    gateEl.setAttribute("aria-live", "polite");
    document.body.appendChild(gateEl);

    bannerEl = document.createElement("div");
    bannerEl.id = "managed-banner";
    bannerEl.className = "managed-banner";
    bannerEl.hidden = true;
    document.body.appendChild(bannerEl);
  }

  function render() {
    ensureContainers();
    const gated = state === STATE.LOADING || state === STATE.SIGNED_OUT ||
      state === STATE.WRONG_TENANT || state === STATE.EXPIRED ||
      state === STATE.FIRST_LOGIN || state === STATE.PROFILE_FAILURE ||
      state === STATE.UNAVAILABLE;

    visible(gateEl, gated);
    if (gated) renderGate();
    renderBanner();
  }

  function renderGate() {
    clearChildren(gateEl);
    const card = el("div", "managed-gate-card");
    const title = el("h2", "managed-gate-title");
    const body = el("div", "managed-gate-body");
    card.appendChild(title);
    card.appendChild(body);
    gateEl.appendChild(card);

    switch (state) {
      case STATE.LOADING:
        title.textContent = "Checking your sign-in\u2026";
        body.appendChild(el("p", null, "A moment while we verify your organization account."));
        break;

      case STATE.SIGNED_OUT:
        title.textContent = "Sign in to continue";
        body.appendChild(el("p", null,
          "This deployment of the Coach is managed by your organization. Use your work or school account."));
        body.appendChild(button("Sign in with your organization account", "primary", () => {
          navigate(config.signInPath);
        }));
        break;

      case STATE.WRONG_TENANT:
        title.textContent = "That account isn't from this organization";
        body.appendChild(el("p", null,
          "You signed in with an account outside the organization that manages this Coach. " +
          "Switch to your organization account or ask an administrator for help."));
        body.appendChild(button("Sign out and try another account", "secondary", () => {
          navigate(config.signOutPath);
        }));
        break;

      case STATE.EXPIRED:
        title.textContent = "Your sign-in has expired";
        body.appendChild(el("p", null, "Please sign in again to continue."));
        body.appendChild(button("Sign in again", "primary", () => {
          navigate(config.signInPath);
        }));
        break;

      case STATE.FIRST_LOGIN:
        title.textContent = "Let's set up your space";
        body.appendChild(el("p", null,
          "Welcome! Tell us a little about your language preference and confirm your consent to use this managed Coach."));
        body.appendChild(onboardingForm());
        break;

      case STATE.PROFILE_FAILURE:
        title.textContent = "Something went wrong";
        body.appendChild(el("p", null, "We couldn't load your profile settings. Please try again in a moment."));
        body.appendChild(button("Try again", "primary", () => run()));
        body.appendChild(button("Sign out", "secondary", () => navigate(config.signOutPath)));
        break;

      case STATE.UNAVAILABLE:
        title.textContent = "Sign-in isn't available right now";
        body.appendChild(el("p", null,
          "The managed sign-in service didn't respond. If this keeps happening, contact the person who set up this Coach."));
        body.appendChild(button("Try again", "primary", () => run()));
        body.appendChild(button("Sign out", "secondary", () => navigate(config.signOutPath)));
        break;
    }
  }

  function button(label, kind, onClick) {
    const b = el("button", ("managed-btn " + (kind || "")), label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  function onboardingForm() {
    const form = el("form", "managed-onboard");
    form.noValidate = true;

    const nameLabel = el("label", "managed-field");
    nameLabel.appendChild(el("span", null, "What should we call you?"));
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.name = "displayName";
    nameInput.maxLength = config.displayNameMax || 120;
    nameInput.placeholder = "e.g. Alex Rivera";
    nameInput.value = (profile && profile.displayName) || "";
    nameLabel.appendChild(nameInput);

    const langLabel = el("label", "managed-field");
    langLabel.appendChild(el("span", null, "Language"));
    const langSelect = document.createElement("select");
    langSelect.name = "language";
    const langs = Array.isArray(config.languages) && config.languages.length ? config.languages : [];
    (langs.length ? langs : [{ value: "simple", label: "Plain language" }]).forEach((l) => {
      const opt = document.createElement("option");
      opt.value = l.value;
      opt.textContent = l.label;
      if (profile && profile.language === l.value) opt.selected = true;
      langSelect.appendChild(opt);
    });
    langLabel.appendChild(langSelect);

    const consent1 = checkbox("consentData",
      "I understand my assessment data is stored by my organization and I consent to it being processed." +
        " This tool stores no passwords and holds no account tokens in my browser.");
    const consent2 = checkbox("consentShareAloud",
      "I consent to my anonymized results being shared with my organization's advisors to guide my business plan.");

    const error = el("p", "managed-error", "");
    error.hidden = true;
    error.setAttribute("role", "alert");

    const submit = el("button", "managed-btn primary", "Continue");
    submit.type = "submit";

    form.appendChild(nameLabel);
    form.appendChild(langLabel);
    form.appendChild(consent1.node);
    form.appendChild(consent2.node);
    form.appendChild(error);
    form.appendChild(submit);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const displayName = nameInput.value.trim();
      if (!displayName) { showFormError(error, "Please tell us what to call you."); return; }
      if (displayName.length > (config.displayNameMax || 120)) {
        showFormError(error, "That name is too long. Use " + (config.displayNameMax || 120) + " characters or fewer.");
        return;
      }
      if (!consent1.input.checked || !consent2.input.checked) {
        showFormError(error, "Please select both consent options to continue.");
        return;
      }
      error.hidden = true;
      submit.disabled = true;
      submit.textContent = "Saving\u2026";
      saveProfile({
        displayName: displayName,
        language: langSelect.value,
        consents: { consentData: true, consentShareAloud: true }
      }).then((res) => {
        if (!res.ok) {
          submit.disabled = false;
          submit.textContent = "Continue";
          if (res.status === 401) { setState(STATE.EXPIRED, principal); return; }
          showFormError(error, "We couldn't save your settings (status " + res.status + "). Please try again.");
          return;
        }
        setState(hasRecognizedRole(principal) ? STATE.READY : STATE.UNASSIGNED, principal, res.profile);
      }).catch(() => {
        submit.disabled = false;
        submit.textContent = "Continue";
        showFormError(error, "We couldn't reach the service. Check your connection and try again.");
      });
    });

    return form;
  }

  function checkbox(name, labelText) {
    const wrap = el("label", "managed-check");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    wrap.appendChild(input);
    wrap.appendChild(el("span", null, labelText));
    return { node: wrap, input: input };
  }

  function showFormError(node, message) {
    node.textContent = message;
    node.hidden = false;
  }

  function renderBanner() {
    visible(bannerEl, (state === STATE.READY || state === STATE.UNASSIGNED) && principal !== null);
    if (bannerEl.hidden) return;
    clearChildren(bannerEl);

    const who = el("span", "managed-banner-who");
    const label = profile && profile.displayName ? profile.displayName : principal.userDetails || principal.userId;
    who.textContent = "Signed in as " + label;

    const roleChip = el("span", "managed-banner-role");
    const roles = recognizedRoles().filter((r) => principal.userRoles.indexOf(r) !== -1);
    roleChip.textContent = roles.length ? roles.join(" \u00b7 ") : "No review role yet";

    bannerEl.appendChild(who);
    bannerEl.appendChild(roleChip);

    if (state === STATE.UNASSIGNED) {
      const note = el("span", "managed-banner-note",
        "Your administrator hasn't assigned you a review role yet \u2014 your assessment still works on this device.");
      bannerEl.appendChild(note);
    }

    if (state === STATE.READY) {
      const signOut = button("Sign out", "managed-banner-link", () => navigate(config.signOutPath));
      bannerEl.appendChild(signOut);
      maybeOfferImport();
    }
  }

  function maybeOfferImport() {
    if (config.allowGuestImport !== true) return;
    if (importOffered()) return;
    if (!guestDataExists()) { markImportOffered(); return; }

    const box = el("div", "managed-import");
    const s = guestDataSummary();
    box.appendChild(el("p", null,
      "This device has " + s.total + " saved response" + (s.total === 1 ? "" : "s") +
      " from before you signed in. Link them to your account? This sends only a summary record — " +
      "the content itself never leaves this device."));
    const link = button("Link to my account", "managed-btn primary", () => {
      recordImport({ itemCount: s.total, note: "Explicit device-data link on first managed sign-in" })
        .then((res) => {
          markImportOffered();
          clearChildren(box);
          if (res.ok) {
            box.appendChild(el("p", null, "Linked \u2014 this device's data is now associated with your account."));
          } else if (res.status === 409) {
            box.appendChild(el("p", null, "This deployment doesn't support linking right now. Your data is still safe on this device."));
          } else {
            box.appendChild(el("p", null, "Linking didn't go through. Your data is still safe on this device."));
          }
        })
        .catch(() => {
          clearChildren(box);
          box.appendChild(el("p", null, "Linking didn't go through. Your data is still safe on this device."));
        });
    });
    const keep = button("Keep it on this device", "managed-btn secondary", () => {
      markImportOffered();
      box.parentNode && box.parentNode.removeChild(box);
    });

    const actions = el("div", "managed-import-actions");
    actions.appendChild(link);
    actions.appendChild(keep);
    box.appendChild(actions);
    bannerEl.appendChild(box);
  }

  /* ---- public API ------------------------------------------------------- */

  function init(opts) {
    const o = opts || {};
    const base = enabledConfig();
    config = Object.assign({
      enabled: false,
      apiBase: "/api",
      authEndpoint: "/.auth/me",
      signInPath: "/.auth/login/aad",
      signOutPath: "/.auth/logout",
      allowedTenantId: "",
      displayNameMax: 120,
      importMaxBytes: 524288,
      languages: [],
      recognizedRoles: ["Evaluator", "Reviewer", "Administrator"],
      allowGuestImport: false
    }, base, o.config || {});
    if (!config.enabled) return Promise.resolve({ started: false, reason: "managed_disabled" });
    if (typeof o.fetch === "function") fetchImpl = o.fetch;
    if (typeof o.navigate === "function") navigate = o.navigate;
    return run().then(() => ({ started: true }));
  }

  function getState() { return state; }
  function getPrincipal() { return principal; }
  function getProfile() { return profile; }

  document.addEventListener("DOMContentLoaded", () => {
    if (enabledConfig()) init();
  });

  return {
    STATE: STATE,
    init: init,
    getState: getState,
    getPrincipal: getPrincipal,
    getProfile: getProfile
  };
})();