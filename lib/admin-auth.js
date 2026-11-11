const crypto = require("crypto");

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 16;
const MIN_SECRET_LENGTH = 64;

// Best-effort throttle per warm function instance. Pair with edge/WAF rate limiting
// for globally enforced protection across serverless instances.
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

function readAdminConfig() {
  return { password: process.env.ADMIN_PASSWORD || "", secret: process.env.ADMIN_SECRET || "" };
}
function isAdminConfigReady(config = readAdminConfig()) {
  return typeof config.password === "string" && config.password.length >= MIN_PASSWORD_LENGTH &&
    typeof config.secret === "string" && config.secret.length >= MIN_SECRET_LENGTH &&
    /^[a-f0-9]+$/i.test(config.secret);
}
function getSigningSecret(config = readAdminConfig()) {
  return isAdminConfigReady(config) ? config.secret : null;
}
function verifyPassword(input, config = readAdminConfig()) {
  if (!isAdminConfigReady(config) || typeof input !== "string") return false;
  const actual = Buffer.from(input, "utf8");
  const expected = Buffer.from(config.password, "utf8");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
function signToken(secret) {
  if (typeof secret !== "string" || secret.length < MIN_SECRET_LENGTH) return null;
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + TOKEN_TTL_MS })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function verifyToken(token, secret) {
  if (!secret || typeof token !== "string") return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isFinite(parsed.iat) && Number.isFinite(parsed.exp) &&
      parsed.iat <= Date.now() + 60_000 && Date.now() < parsed.exp;
  } catch { return false; }
}
function clientKey(req) {
  const headers = req?.headers || {};
  return String(headers["x-nf-client-connection-ip"] ||
    headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown").slice(0, 120);
}
function checkLoginRateLimit(req) {
  const key = clientKey(req);
  const entry = loginAttempts.get(key);
  const now = Date.now();
  if (!entry) return { allowed: true, retryAfter: 0 };
  if (entry.lockUntil > now) return { allowed: false, retryAfter: Math.ceil((entry.lockUntil - now) / 1000) };
  if (now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return { allowed: true, retryAfter: 0 };
  }
  return { allowed: entry.count < LOGIN_MAX_ATTEMPTS, retryAfter: 0 };
}
function recordLoginFailure(req) {
  const key = clientKey(req);
  const now = Date.now();
  let entry = loginAttempts.get(key);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) entry = { count: 0, windowStart: now, lockUntil: 0 };
  entry.count += 1;
  if (entry.count >= LOGIN_MAX_ATTEMPTS) entry.lockUntil = now + LOGIN_LOCK_MS;
  loginAttempts.set(key, entry);
  if (loginAttempts.size > 5000) {
    for (const [candidate, value] of loginAttempts) {
      if (value.lockUntil < now && now - value.windowStart > LOGIN_WINDOW_MS) loginAttempts.delete(candidate);
    }
  }
  return { locked: entry.lockUntil > now, retryAfter: entry.lockUntil > now ? Math.ceil((entry.lockUntil - now) / 1000) : 0 };
}
function clearLoginAttempts(req) { loginAttempts.delete(clientKey(req)); }
function parseBody(req) {
  if (!req.body) return null;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return req.body;
}
async function requireAuth(req) {
  const secret = getSigningSecret();
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!verifyToken(token, secret)) return { ok: false, status: 401, error: "Neautorizat. Autentifică-te din nou." };
  return { ok: true };
}
module.exports = {
  readAdminConfig, isAdminConfigReady, getSigningSecret, verifyPassword,
  signToken, verifyToken, parseBody, requireAuth,
  checkLoginRateLimit, recordLoginFailure, clearLoginAttempts,
};
