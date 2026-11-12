import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const manifest = JSON.parse(read("manifest.json"));
const expectedMatches = [
  "https://chatgpt.com/*",
  "https://gemini.google.com/*"
];

assert(manifest.manifest_version === 3, "manifest_version must be 3");
assert(/^\d+\.\d+\.\d+$/.test(manifest.version), "version must use x.y.z format");
assert(
  JSON.stringify(manifest.permissions) === JSON.stringify(["storage"]),
  "storage must be the only extension permission"
);
assert(manifest.content_scripts?.length === 1, "expected one content script definition");
assert(
  JSON.stringify(manifest.content_scripts[0].matches) === JSON.stringify(expectedMatches),
  "content-script origins differ from the approved allowlist"
);

const referencedFiles = [
  manifest.action.default_popup,
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon),
  ...manifest.content_scripts.flatMap((entry) => [...entry.js, ...entry.css])
];
for (const file of new Set(referencedFiles)) {
  assert(fs.existsSync(path.join(root, file)), `missing manifest file: ${file}`);
}

for (const [size, file] of Object.entries(manifest.icons)) {
  const png = fs.readFileSync(path.join(root, file));
  assert(png.subarray(1, 4).toString() === "PNG", `${file} is not a PNG`);
  assert(png.readUInt32BE(16) === Number(size), `${file} has the wrong width`);
  assert(png.readUInt32BE(20) === Number(size), `${file} has the wrong height`);
}

const executableSources = [
  ...manifest.content_scripts.flatMap(entry => entry.js),
  "popup/popup.js",
  "popup/popup.html"
].map(read).join("\n");
const prohibitedPatterns = [
  [/\bfetch\s*\(/, "fetch"],
  [/\bXMLHttpRequest\b/, "XMLHttpRequest"],
  [/\bWebSocket\b/, "WebSocket"],
  [/\beval\s*\(/, "eval"],
  [/\bnew\s+Function\b/, "new Function"],
  [/<script[^>]+src=["']https?:/i, "remote script"]
];
for (const [pattern, label] of prohibitedPatterns) {
  assert(!pattern.test(executableSources), `${label} is not allowed in extension code`);
}

const privacy = read("PRIVACY.md");
for (const origin of expectedMatches) {
  assert(privacy.includes(origin), `privacy policy is missing ${origin}`);
}

console.log(`Chat Canvas v${manifest.version} validation passed.`);
