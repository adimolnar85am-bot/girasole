const fs = require("fs");
const path = require("path");
const {
  readAdminConfig,
  getGitHubConfig,
  githubHeaders,
  isAdminConfigReady,
  verifyPassword,
  getSigningSecret,
  signToken,
  verifyToken,
  parseBody,
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginAttempts,
} = require("../lib/admin-auth");

const CONTENT_PATH = "data/site-content.json";

function readLocalJson(relativePath) {
  const filePath = path.join(process.cwd(), relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readLocalDefault() {
  return readLocalJson(CONTENT_PATH);
}

async function fetchGitHubFile(relativePath) {
  const { owner, repoName, branch, token } = getGitHubConfig();
  const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${relativePath}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: githubHeaders(token), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, message: res.statusText || "GitHub read failed" };
  const file = await res.json();
  if (!file.content) return { ok: false, status: 204, message: "GitHub returned no file content" };
  const content = Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
  return { ok: true, status: res.status, sha: file.sha, data: JSON.parse(content) };
}

async function readJsonFromGitHub(relativePath) {
  const result = await fetchGitHubFile(relativePath);
  return result.ok ? result.data : null;
}

function summarizeMenu(menu) {
  if (Array.isArray(menu?.sections)) {
    return {
      categoryCount: menu.sections.length,
      categories: menu.sections.map((section) => ({
        title: String(section.title || ""),
        productCount: Array.isArray(section.items) ? section.items.length : 0,
      })),
      productCount: menu.sections.reduce((count, section) => count + (Array.isArray(section.items) ? section.items.length : 0), 0),
    };
  }
  return {
    categoryCount: ["panini", "caffe"].filter((key) => Array.isArray(menu?.[key])).length,
    categories: [
      { title: "Panini", productCount: menu?.panini?.length || 0 },
      { title: "Caffè", productCount: menu?.caffe?.length || 0 },
    ].filter((category) => category.productCount > 0),
    productCount: (menu?.panini?.length || 0) + (menu?.caffe?.length || 0),
  };
}

async function getSaveDiagnostics() {
  const config = getGitHubConfig();
  const snapshot = await fetchGitHubFile(CONTENT_PATH);
  return {
    environment: process.env.VERCEL_ENV || process.env.CONTEXT || "unknown",
    deploymentBranch: process.env.VERCEL_GIT_COMMIT_REF || null,
    branch: config.branch,
    branchSource: config.branchSource,
    branchLooksLikePreviewFallback: (process.env.VERCEL_ENV === "preview" || ["deploy-preview", "branch-deploy"].includes(process.env.CONTEXT)) && config.branchSource === "fallback",
    githubTokenConfigured: Boolean(config.token),
    repository: `${config.owner}/${config.repoName}`,
    contentFile: snapshot.ok ? {
      status: snapshot.status,
      sha: snapshot.sha,
      menu: summarizeMenu(snapshot.data?.menu),
    } : {
      status: snapshot.status,
      message: snapshot.message,
    },
  };
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

  const result = await res.json().catch(() => ({}));
  if (res.status === 409) throw new Error("CONFLICT");
  if (!res.ok) {
    throw new Error(`GitHub HTTP ${res.status}: ${result.message || "GITHUB_WRITE_FAILED"}`);
  }
  return { branch, commitSha: result.commit?.sha || null, contentSha: result.content?.sha || null };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") return res.status(204).end();

  const body = parseBody(req);

  if (req.method === "POST" && body?.action === "login") {
    const limit = checkLoginRateLimit(req);
    if (!limit.allowed) {
      res.setHeader("Retry-After", String(limit.retryAfter || 900));
      return res.status(429).json({ error: "Prea multe încercări. Încearcă din nou mai târziu." });
    }
    const config = await readAdminConfig();
    if (!isAdminConfigReady(config)) {
      return res.status(503).json({
        error: "Admin neconfigurat. Setează ADMIN_PASSWORD (minimum 16 caractere) și ADMIN_SECRET (minimum 64 caractere hex) în Netlify.",
      });
    }
    if (!verifyPassword(body.password, config)) {
      const failure = recordLoginFailure(req);
      if (failure.locked) {
        res.setHeader("Retry-After", String(failure.retryAfter));
        return res.status(429).json({ error: "Prea multe încercări. Accesul este temporar blocat." });
      }
      return res.status(401).json({ error: "Parolă incorectă." });
    }
    clearLoginAttempts(req);
    return res.status(200).json({ token: signToken(getSigningSecret(config)) });
  }

  if (req.method === "POST" && body?.action === "diagnostics") {
    const config = await readAdminConfig();
    const secret = getSigningSecret(config);
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!verifyToken(token, secret)) {
      return res.status(401).json({ error: "Neautorizat. Autentifică-te din nou." });
    }
    try {
      return res.status(200).json(await getSaveDiagnostics());
    } catch (err) {
      return res.status(500).json({ error: err.message || "Diagnostic indisponibil." });
    }
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
      if (Buffer.byteLength(JSON.stringify(payload), "utf8") > 1_500_000) {
        return res.status(413).json({ error: "Conținutul este prea mare pentru salvare." });
      }
      const gitConfig = getGitHubConfig();
      if ((process.env.NETLIFY || process.env.CONTEXT) && gitConfig.branchSource === "fallback") {
        throw new Error("Netlify deployment branch unresolved. Set GITHUB_BRANCH or ensure the BRANCH environment variable is available. Write blocked to protect master.");
      }
      if (process.env.VERCEL_ENV === "preview" && gitConfig.branchSource === "fallback") {
        throw new Error("Preview branch unresolved. Set VERCEL_GIT_COMMIT_REF or GITHUB_BRANCH; write blocked to protect master.");
      }
      const saved = await writeToGitHub(CONTENT_PATH, payload, "Actualizare conținut site (admin Girasole)");
      const verification = await fetchGitHubFile(CONTENT_PATH);
      if (!verification.ok || verification.data?.menu?.sections?.length !== payload.menu?.sections?.length) {
        throw new Error("GitHub write returned success, but the saved content could not be verified on the selected branch.");
      }
      return res.status(200).json({ ok: true, branch: saved.branch, commitSha: saved.commitSha, menu: summarizeMenu(verification.data.menu) });
    } catch (err) {
      if (err.message === "GITHUB_NOT_CONFIGURED") {
        return res.status(503).json({
          error: "Salvarea necesită GITHUB_TOKEN în Netlify (token GitHub cu acces de scriere la repo).",
        });
      }
      if (err.message === "CONFLICT") {
        return res.status(409).json({
          error: "Fișierul a fost modificat între timp. Reîncarcă pagina admin și încearcă din nou.",
        });
      }
      console.error("[girasole-admin-save]", err.message);
      return res.status(500).json({ error: `Salvarea a eșuat: ${String(err.message || "eroare necunoscută").slice(0, 260)}` });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
