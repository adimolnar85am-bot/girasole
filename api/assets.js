const fs = require("fs");
const path = require("path");
const { getGitHubConfig, githubHeaders, parseBody, requireAuth } = require("../lib/admin-auth");

const ASSETS_DIR = "assets";
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);

function isImageFile(name) {
  return IMAGE_EXT.has(path.extname(name).toLowerCase());
}

function toPublicPath(name) {
  return `${ASSETS_DIR}/${name}`;
}

function listLocalAssets() {
  const dir = path.join(process.cwd(), ASSETS_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(isImageFile)
    .map((name) => ({ name, path: toPublicPath(name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function listGitHubAssets() {
  const { owner, repoName, branch, token } = getGitHubConfig();
  const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${ASSETS_DIR}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: githubHeaders(token), cache: "no-store" });
  if (!res.ok) return null;
  const items = await res.json();
  if (!Array.isArray(items)) return null;
  return items
    .filter((item) => item.type === "file" && isImageFile(item.name))
    .map((item) => ({ name: item.name, path: item.path.replace(/\\/g, "/") }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function sanitizeFilename(name) {
  const base = path.basename(name).toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/-+/g, "-");
  return base.replace(/^-+|-+$/g, "") || `imagine-${Date.now()}.jpg`;
}

async function uploadToGitHub(relativePath, base64Content, message) {
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
  const body = { message, content: base64Content, branch };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...githubHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "GITHUB_WRITE_FAILED");
  }

  return relativePath.replace(/\\/g, "/");
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    const githubAssets = await listGitHubAssets();
    const files = githubAssets || listLocalAssets();
    return res.status(200).json({ files });
  }

  if (req.method === "POST") {
    const auth = await requireAuth(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const body = parseBody(req);
    if (!body?.filename || !body?.data) {
      return res.status(400).json({ error: "Lipsește fișierul sau numele." });
    }

    const raw = String(body.data);
    const base64 = raw.includes(",") ? raw.split(",").pop() : raw;
    const sizeBytes = Buffer.from(base64, "base64").length;
    if (sizeBytes > 4 * 1024 * 1024) {
      return res.status(413).json({ error: "Imaginea e prea mare (max. 4 MB)." });
    }

    let filename = sanitizeFilename(body.filename);
    if (!isImageFile(filename)) {
      filename = `${filename.replace(/\.[^.]+$/, "") || "imagine"}.jpg`;
    }

    try {
      const relativePath = await uploadToGitHub(
        toPublicPath(filename),
        base64,
        `Upload imagine admin: ${filename}`
      );
      return res.status(200).json({ path: relativePath, name: filename });
    } catch (err) {
      if (err.message === "GITHUB_NOT_CONFIGURED") {
        return res.status(503).json({
          error: "Upload necesită GITHUB_TOKEN în Vercel.",
        });
      }
      return res.status(500).json({ error: "Nu am putut încărca imaginea." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
