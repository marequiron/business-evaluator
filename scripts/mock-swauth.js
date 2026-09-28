'use strict';

/**
 * mock-swauth.js — local developer mock for the Phase 1 managed-mode auth
 * stack (Azure Static Web Apps + Entra ID). Lets you walk through the full
 * first-time sign-in flow in a real browser WITHOUT provisioning Azure:
 *
 *   npm run mock:auth
 *   -> open http://127.0.0.1:4174/
 *
 * What it does:
 *   - Serves the real app (via serve.js's static handler) but serves a
 *     RUNTIME-REWRITTEN copy of js/data.js with MANAGED_ACCESS enabled and
 *     a mock tenant. The on-disk js/data.js is never modified.
 *   - Fakes the SWA auth endpoints (/.auth/me, /.auth/login/aad,
 *     /.auth/logout) and the profile API (/api/profile,
 *     /api/profile/import) that js/managed.js talks to.
 *   - Keeps session state in an HttpOnly cookie ("maa_session") whose shape
 *     mirrors what api/src/auth.js parses from SWA's x-ms-client-principal:
 *     userId preferred, userRoles = roles, claims.tid = tenant.
 *
 * First-time walkthrough:
 *   1. Visit http://127.0.0.1:4174/            -> "Sign in to continue".
 *   2. Click "Sign in with your organization account" -> simulated Entra
 *      login lands on the one-time onboarding form.
 *   3. Enter a display name, pick a language, tick BOTH consents, Continue
 *      -> the app opens with the "Signed in as ..." banner + role chip.
 *
 * Other personas (sign out just by clicking "Sign out", or revisit):
 *   /.auth/login/aad?as=ready         already onboarded -> opens directly
 *   /.auth/login/aad?as=reviewer      Evaluator + Reviewer role chips
 *   /.auth/login/aad?as=unassigned    signed in but no role yet
 *   /.auth/login/aad?as=wrong-tenant  account from another tenant (tid)
 *   /.auth/login/aad?as=expired       profile endpoint returns 401
 */

const path = require("path");
const fs = require("fs");
const {
  createStaticServer,
  urlPath,
  queryOf,
  parseCookie,
  cookieHeader,
  clearCookieHeader,
  readBody,
  json,
  redirect,
  serveManagedData,
} = require("./localauth-lib.js");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 4174;
const HOST = process.env.HOST || "127.0.0.1";
const COOKIE = "maa_session";
const TENANT = "mock-tenant";

const PERSONAS = {
  "first-login": {
    userId: "mock-a1b2c3d4",
    userDetails: "alice@contoso.com",
    tenantId: TENANT,
    roles: ["Evaluator"],
    onboarded: false
  },
  ready: {
    userId: "mock-a1b2c3d4",
    userDetails: "alice@contoso.com",
    tenantId: TENANT,
    roles: ["Evaluator"],
    onboarded: true
  },
  reviewer: {
    userId: "mock-e5f6g7h8",
    userDetails: "bob@contoso.com",
    tenantId: TENANT,
    roles: ["Evaluator", "Reviewer"],
    onboarded: true
  },
  unassigned: {
    userId: "mock-i9j0k1l2",
    userDetails: "carol@contoso.com",
    tenantId: TENANT,
    roles: [],
    onboarded: true
  },
  "wrong-tenant": {
    userId: "mock-m3n4o5p6",
    userDetails: "mallory@othercorp.com",
    tenantId: "other-tenant",
    roles: ["Evaluator"],
    onboarded: true
  },
  expired: {
    userId: "mock-q7r8s9t0",
    userDetails: "dave@contoso.com",
    tenantId: TENANT,
    roles: ["Evaluator"],
    onboarded: false
  }
};

const DEFAULT_PROFILE = {
  displayName: "Alex Rivera",
  language: "standard",
  consents: { consentData: true, consentShareAloud: true }
};

const profiles = new Map();

function personaOf(request) {
  const cookie = parseCookie(request.headers.cookie || "");
  const name = cookie[COOKIE];
  if (!name) return null;
  const base = PERSONAS[name] || PERSONAS["first-login"];
  return Object.assign({ name: name }, base);
}

function principalJson(persona) {
  if (!persona) return JSON.stringify({ clientPrincipal: null });
  return JSON.stringify({
    clientPrincipal: {
      identityProvider: "aad",
      userId: persona.userId,
      userDetails: persona.userDetails,
      userRoles: persona.roles.slice(),
      claims: [{ typ: "tid", val: persona.tenantId }]
    }
  });
}

function isOnboarded(persona) {
  return !!(persona && (persona.onboarded || profiles.has(persona.userId)));
}

function storeProfile(persona, profile) {
  profiles.set(persona.userId, Object.assign({}, profile, { userId: persona.userId }));
  return profiles.get(persona.userId);
}

function validateProfileBody(body) {
  const b = body && typeof body === "object" ? body : {};
  const displayName = typeof b.displayName === "string" ? b.displayName.trim() : "";
  if (!displayName || displayName.length > 120) return null;
  if (b.language !== "simple" && b.language !== "standard") return null;
  const c = b.consents || {};
  if (c.consentData !== true || c.consentShareAloud !== true) return null;
  return { displayName: displayName, language: b.language, consents: { consentData: true, consentShareAloud: true } };
}

const staticServer = createStaticServer(ROOT);

const server = require("http").createServer((req, res) => {
  const pathname = urlPath(req);
  const method = (req.method || "GET").toUpperCase();
  const persona = personaOf(req);

  if (pathname === "/.auth/me" && method === "GET") {
    json(res, 200, JSON.parse(principalJson(persona)));
    return;
  }

  if (pathname === "/.auth/login/aad" && method === "GET") {
    const as = (queryOf(req).as || "first-login").replace(/[^a-z0-9-]/gi, "");
    redirect(res, "/", { "Set-Cookie": cookieHeader(COOKIE, PERSONAS[as] ? as : "first-login", { maxAge: 3600 }) });
    return;
  }

  if (pathname === "/.auth/logout" && method === "GET") {
    redirect(res, "/", { "Set-Cookie": clearCookieHeader(COOKIE) });
    return;
  }

  if (pathname === "/api/profile") {
    if (!persona || persona.name === "expired") {
      json(res, 401, { error: "session_expired" });
      return;
    }
    if (method === "GET") {
      if (!isOnboarded(persona)) { json(res, 404, { error: "profile_not_found" }); return; }
      const saved = profiles.get(persona.userId);
      const profile = saved || Object.assign({}, DEFAULT_PROFILE, { userId: persona.userId });
      json(res, 200, profile);
      return;
    }
    if (method === "POST") {
      readBody(req).then((raw) => {
        let parsed;
        try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
        const profile = validateProfileBody(parsed);
        if (!profile) {
          json(res, 400, { error: "invalid_profile" });
          return;
        }
        const stored = storeProfile(persona, profile);
        json(res, 200, stored);
      }).catch((err) => json(res, err && err.message === "body_too_large" ? 413 : 400, { error: err && err.message || "bad_request" }));
      return;
    }
  }

  if (pathname === "/api/profile/import" && method === "POST") {
    if (!persona || persona.name === "expired") {
      json(res, 401, { error: "session_expired" });
      return;
    }
    readBody(req).then((raw) => {
      let parsed;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
      const itemCount = parsed && typeof parsed.itemCount === "number" ? parsed.itemCount : NaN;
      const note = parsed && typeof parsed.note === "string" ? parsed.note : "";
      if (!isFinite(itemCount) || itemCount < 1 || itemCount > 100000 || note.length > 200) {
        json(res, 400, { error: "invalid_import" });
        return;
      }
      json(res, 202, { status: "ok", recorded: true });
    }).catch((err) => json(res, 413, { error: "body_too_large" }));
    return;
  }

  if (pathname === "/js/data.js" && method === "GET") {
    serveManagedData(req, res, { tenantId: TENANT, allowGuestImport: true });
    return;
  }

  staticServer.emit("request", req, res);
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("Managed-mode mock auth server");
  console.log("  " + "http://" + HOST + ":" + PORT + "/");
  console.log("");
  console.log("  First-time flow:");
  console.log("    open the URL above  -> \"Sign in to continue\"");
  console.log("    click Sign in       -> onboarding form");
  console.log("    fill name + language + BOTH consents, Continue -> app opens");
  console.log("");
  console.log("  Other personas (after signing out):");
  Object.keys(PERSONAS).forEach((name) => {
    console.log("    http://" + HOST + ":" + PORT + "/.auth/login/aad?as=" + name);
  });
  console.log("");
  console.log("  Sign out: /.auth/logout  |  Persona notes: ready/reviewer/unassigned/");
  console.log("  wrong-tenant/expired");
  console.log("  Tip: to see the one-time \"Link to my account\" offer, answer a few");
  console.log("  questions first, sign out, then sign in again.");
});