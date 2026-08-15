const fs = require("fs");
const path = require("path");
const {
  readAdminConfig,
  getGitHubConfig,
  githubHeaders,
  verifyPassword,
  getSigningSecret,
  signToken,
  verifyToken,
  parseBody,
} = require("../lib/admin-auth");

const CONTENT_PATH = "data/site-content.json";

function readLocalJson(relativePath) {
  const filePath = path.join(process.cwd(), relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readLocalDefault() {
  return readLocalJson(CONTENT_PATH);
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

async function readFromGitHub() {
  const data = await readJsonFromGitHub(CONTENT_PATH);
  if (!data) return null;
  return { data };
}

async function writeToGitHub(relativePath, data, message) {
  const { owner, repoName, branch, token } = getGitHubConfig();
  if (!token) throw new Error("GITHUB_NOT_CONFIGURED");

  const getUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${relativePath}?ref=${encodeURIComponent(branch)}`;
  const existingRes = await fetch(getUrl, { headers: githubHeaders(token), cache: "no-store" });
  let sha;
  if (existingRes.ok) {
    const existing = await existingRes.json();
    sha = existing.sha;
  }

  const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${relativePath}`;
  const body = {
    message,
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

  if (res.status === 409) throw new Error("CONFLICT");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "GITHUB_WRITE_FAILED");
  }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();

  const body = parseBody(req);

  if (req.method === "POST" && body?.action === "login") {
    const config = await readAdminConfig();
    const secret = getSigningSecret(config);

    if (!secret) {
      return res.status(503).json({
        error: "Admin nu este configurat. Lipsește fișierul data/admin-config.json sau ADMIN_SECRET.",
      });
    }

    if (!verifyPassword(body.password, config)) {
      return res.status(401).json({ error: "Parolă incorectă." });
    }

    return res.status(200).json({ token: signToken(secret) });
  }

  if (req.method === "GET") {
    const github = await readFromGitHub();
    const content = github?.data || readLocalDefault();
    return res.status(200).json(content);
  }

  if (req.method === "PUT") {
    const config = await readAdminConfig();
    const secret = getSigningSecret(config);
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!verifyToken(token, secret)) {
      return res.status(401).json({ error: "Neautorizat. Autentifică-te din nou." });
    }

    try {
      const payload = body;
      if (!payload?.meta || !payload?.hero || !payload?.menu) {
        return res.status(400).json({ error: "Conținut invalid. Reîncarcă pagina admin." });
      }
      await writeToGitHub(CONTENT_PATH, payload, "Actualizare conținut site (admin Girasole)");
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
