/**
 * After `npm run dist:win` or `electron-builder --dir --win`, confirms the unpacked exe exists.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const exe = path.join(root, "dist", "win-unpacked", "YT Commenting.exe");

if (!fs.existsSync(exe)) {
  console.error("Packaged app not found:", exe);
  console.error("Run: npm run dist:win");
  process.exit(1);
}

console.log("OK:", exe);
process.exit(0);
