const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ADMIN_CONFIG_PATH = "data/admin-config.json";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readLocalAdminConfig() {
  try {
    const filePath = path.join(process.cwd(), ADMIN_CONFIG_PATH);
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function getGitHubConfig() {
  const repo = process.env.GITHUB_REPO || "adimolnar85am-bot/girasole";
  const branch = process.env.GITHUB_BRANCH || "master";
  const token = process.env.GITHUB_TOKEN;
  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) throw new Error("GITHUB_REPO_INVALID");
  return { owner, repoName, branch, token };
}

function githubHeaders(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "girasole-admin",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function readJsonFromGitHub(relativePath) {
  const { owner, repoName, branch, token } = getGitHubConfig();
  const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${relativePath}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: githubHeaders(token), cache: "no-store" });
  if (!res.ok) return null;
  const file = await res.json();
  if (!file.content) return null;
  const content = Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
  return JSON.parse(content);
}

async function readAdminConfig() {
  const fromGitHub = await readJsonFromGitHub(ADMIN_CONFIG_PATH);
  if (fromGitHub) return fromGitHub;
  return readLocalAdminConfig();
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(input, config) {
  const password = String(input || "").trim();
  if (!password) return false;

  const envPassword = process.env.ADMIN_PASSWORD;
  if (envPassword && password === String(envPassword).trim()) return true;

  if (!config?.passwordHash || !config?.salt) return false;
  const hash = hashPassword(password, config.salt);
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(config.passwordHash, "hex"));
  } catch {
    return false;
  }
}

function getSigningSecret(config) {
  return process.env.ADMIN_SECRET || config?.secret || null;
}

function signToken(secret) {
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token, secret) {
  if (!secret || !token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (sig !== expected) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Date.now() < exp;
  } catch {
    return false;
  }
}

function parseBody(req) {
  if (!req.body) return null;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body;
}

async function requireAuth(req) {
  const config = await readAdminConfig();
  const secret = getSigningSecret(config);
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!verifyToken(token, secret)) {
    return { ok: false, status: 401, error: "Neautorizat. Autentifică-te din nou." };
  }
  return { ok: true, secret, config };
}

module.exports = {
  readAdminConfig,
  getGitHubConfig,
  githubHeaders,
  verifyPassword,
  getSigningSecret,
  signToken,
  verifyToken,
  parseBody,
  requireAuth,
};
