/**
 * Writes google-client-id.json from GOOGLE_CLIENT_ID so packaged builds
 * can ship the OAuth client ID without .env (run before electron-builder).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(root, ".env") });

const outFile = path.join(root, "google-client-id.json");
const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();

fs.writeFileSync(outFile, JSON.stringify({ clientId }, null, 2) + "\n", "utf8");
console.log(
  clientId
    ? "Wrote google-client-id.json (client id present)."
    : "Wrote google-client-id.json with empty clientId — set GOOGLE_CLIENT_ID for production builds.",
);
