const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const BLOB_PATH = "girasole/site-content.json";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readLocalDefault() {
  const filePath = path.join(process.cwd(), "data", "site-content.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

async function readFromBlob() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: BLOB_PATH, token });
    const match = blobs.find((b) => b.pathname === BLOB_PATH);
    if (!match) return null;
    const res = await fetch(match.url, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function writeToBlob(data) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_NOT_CONFIGURED");
  const { put } = await import("@vercel/blob");
  await put(BLOB_PATH, JSON.stringify(data, null, 2), {
    access: "public",
    addRandomSuffix: false,
    token,
    contentType: "application/json",
  });
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
    if (req.body.password !== password) {
      return res.status(401).json({ error: "Parolă incorectă." });
    }
    return res.status(200).json({ token: signToken() });
  }

  if (req.method === "GET") {
    const blobData = await readFromBlob();
    const content = blobData || readLocalDefault();
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
      await writeToBlob(body);
      return res.status(200).json({ ok: true });
    } catch (err) {
      if (err.message === "BLOB_NOT_CONFIGURED") {
        return res.status(503).json({
          error: "Salvarea necesită BLOB_READ_WRITE_TOKEN în Vercel (Settings → Storage → Blob).",
        });
      }
      return res.status(500).json({ error: "Nu am putut salva conținutul." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
