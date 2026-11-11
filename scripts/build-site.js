const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

function copyDirectory(name) {
  const source = path.join(root, name);
  const destination = path.join(output, name);
  if (!fs.existsSync(source)) throw new Error(`Missing required directory: ${name}`);
  fs.cpSync(source, destination, { recursive: true });
}

for (const directory of ["admin", "assets", "css", "js"]) {
  copyDirectory(directory);
}

fs.copyFileSync(path.join(root, "index.html"), path.join(output, "index.html"));

const dataDirectory = path.join(output, "data");
fs.mkdirSync(dataDirectory, { recursive: true });
fs.copyFileSync(
  path.join(root, "data", "site-content.json"),
  path.join(dataDirectory, "site-content.json")
);

console.log("Girasole static site built in dist/. Private admin config and server source are excluded.");
