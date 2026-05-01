/**
 * Writes google-client-id.json and google-client-secret.json from .env so packaged builds
 * can ship OAuth credentials without bundling .env (run before electron-builder).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(root, ".env") });

const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();

const idFile = path.join(root, "google-client-id.json");
fs.writeFileSync(idFile, JSON.stringify({ clientId }, null, 2) + "\n", "utf8");
console.log(
  clientId
    ? "Wrote google-client-id.json (client id present)."
    : "Wrote google-client-id.json with empty clientId — set GOOGLE_CLIENT_ID for production builds.",
);

const secretFile = path.join(root, "google-client-secret.json");
fs.writeFileSync(secretFile, JSON.stringify({ clientSecret }, null, 2) + "\n", "utf8");
console.log(
  clientSecret
    ? "Wrote google-client-secret.json (secret present)."
    : "Wrote google-client-secret.json with empty clientSecret — Web OAuth clients need GOOGLE_CLIENT_SECRET before dist.",
);
