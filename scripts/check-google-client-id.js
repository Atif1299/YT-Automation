/**
 * Verifies google-client-id.json exists and optionally has a non-empty clientId.
 * Usage: node scripts/check-google-client-id.js [--strict]
 * Strict: exit 1 if missing or empty (use for release/CI).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const file = path.join(root, "google-client-id.json");
const strict = process.argv.includes("--strict");

if (!fs.existsSync(file)) {
  const msg = "Missing google-client-id.json — run: npm run predist (with GOOGLE_CLIENT_ID set for releases).";
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
  process.exit(0);
}

let clientId = "";
try {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  clientId = String(j.clientId || "").trim();
} catch (e) {
  console.error("Invalid google-client-id.json:", e.message);
  process.exit(1);
}

if (!clientId) {
  const msg =
    "google-client-id.json has an empty clientId — set GOOGLE_CLIENT_ID before npm run predist for release builds.";
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
  process.exit(0);
}

console.log("google-client-id.json OK (client id present).");
process.exit(0);
