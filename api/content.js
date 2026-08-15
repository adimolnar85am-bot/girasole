const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const CONTENT_PATH = "data/site-content.json";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readLocalDefault() {
  const filePath = path.join(process.cwd(), "data", "site-content.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

async function readFromGitHub() {
  const { owner, repoName, branch, token } = getGitHubConfig();
  const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${CONTENT_PATH}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: githubHeaders(token), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const file = await res.json();
  if (!file.content) return null;
  const content = Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
  return { data: JSON.parse(content), sha: file.sha };
}

async function writeToGitHub(data, sha) {
  const { owner, repoName, branch, token } = getGitHubConfig();
  if (!token) throw new Error("GITHUB_NOT_CONFIGURED");

  const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${CONTENT_PATH}`;
  const body = {
    message: "Actualizare conținut site (admin Girasole)",
    content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...githubHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 409) {
    throw new Error("CONFLICT");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "GITHUB_WRITE_FAILED");
  }
}

function signToken() {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  const secret = process.env.ADMIN_SECRET;
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

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "POST" && req.body?.action === "login") {
    const password = process.env.ADMIN_PASSWORD;
    if (!password || !process.env.ADMIN_SECRET) {
      return res.status(503).json({
        error: "Admin nu este configurat. Setează ADMIN_PASSWORD și ADMIN_SECRET în Vercel.",
      });
    }
    if (String(req.body.password || "").trim() !== String(password).trim()) {
      return res.status(401).json({ error: "Parolă incorectă." });
    }
    return res.status(200).json({ token: signToken() });
  }

  if (req.method === "GET") {
    const github = await readFromGitHub();
    const content = github?.data || readLocalDefault();
    return res.status(200).json(content);
  }

  if (req.method === "PUT") {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!verifyToken(token)) {
      return res.status(401).json({ error: "Neautorizat. Autentifică-te din nou." });
    }
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const existing = await readFromGitHub();
      await writeToGitHub(body, existing?.sha);
      return res.status(200).json({ ok: true });
    } catch (err) {
      if (err.message === "GITHUB_NOT_CONFIGURED") {
        return res.status(503).json({
          error: "Salvarea necesită GITHUB_TOKEN în Vercel (token GitHub cu acces de scriere la repo).",
        });
      }
      if (err.message === "CONFLICT") {
        return res.status(409).json({
          error: "Fișierul a fost modificat între timp. Reîncarcă pagina admin și încearcă din nou.",
        });
      }
      return res.status(500).json({ error: "Nu am putut salva conținutul." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
