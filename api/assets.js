const fs = require("fs");
const path = require("path");
const { getGitHubConfig, githubHeaders, parseBody, requireAuth } = require("../lib/admin-auth");

const ASSETS_DIR = "assets";
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);
const UPLOAD_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

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

function hasValidImageSignature(buffer, extension) {
  if ([".jpg", ".jpeg"].includes(extension)) return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (extension === ".png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (extension === ".gif") {
    const signature = buffer.subarray(0, 6).toString("ascii");
    return signature === "GIF87a" || signature === "GIF89a";
  }
  if (extension === ".webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
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
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

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
    if (!base64 || !/^[A-Za-z0-9+/=\\s]+$/.test(base64) || base64.length % 4 !== 0) {
      return res.status(400).json({ error: "Fișierul nu este codificat corect." });
    }
    const imageBuffer = Buffer.from(base64, "base64");
    if (!imageBuffer.length) return res.status(400).json({ error: "Imagine invalidă." });
    if (imageBuffer.length > 4 * 1024 * 1024) {
      return res.status(413).json({ error: "Imaginea e prea mare (max. 4 MB)." });
    }

    const filename = sanitizeFilename(body.filename);
    const extension = path.extname(filename).toLowerCase();
    if (!UPLOAD_EXT.has(extension) || !hasValidImageSignature(imageBuffer, extension)) {
      return res.status(415).json({ error: "Format invalid. Sunt acceptate doar JPEG, PNG, GIF și WEBP valide. SVG nu este permis la upload." });
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
          error: "Upload necesită GITHUB_TOKEN în Netlify.",
        });
      }
      return res.status(500).json({ error: "Nu am putut încărca imaginea." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
