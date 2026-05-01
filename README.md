# YT Commenting

Desktop app (Electron) to sign in with Google and post comments on YouTube using the **YouTube Data API v3**. Optional **OpenAI**–powered draft comments: users bring their own API key in **Settings** (stored locally with OS encryption).

## Requirements

- **Node.js** 18+
- **Windows** (x64) or **macOS** for building installers
- A **Google Cloud** project with **YouTube Data API v3** enabled and an **OAuth 2.0 Client ID** (see docs below)

## Quick start (development)

```bash
npm install
cp .env.example .env    # Windows: copy .env.example .env
```

Edit `.env` at minimum:

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | OAuth Client ID (Desktop app type in Google Cloud) |
| `OPENAI_API_KEY` | Optional; comment drafts (or set key in the app **Settings**) |

Then:

```bash
npm start
```

## Building installers

Installers are produced under **`dist/`** (NSIS `.exe`, MSI on Windows; DMG/ZIP on macOS).

```bash
npm run dist:win    # Windows
npm run dist:mac    # macOS
```

The **`predist`** step runs first and writes **`google-client-id.json`** (and **`google-client-secret.json`** when needed) from your environment. **Locally**, `predist` loads **`GOOGLE_CLIENT_ID`** from the project **`.env`** file, so a normal `npm run dist:win` after configuring `.env` is enough.

**GitHub Actions / CI:** there is no `.env` in the repo—set repository secret **`GOOGLE_CLIENT_ID`** (and **`GOOGLE_CLIENT_SECRET`** only if you use a **Web application** OAuth client). Ensure your workflow exports them before `predist` / `electron-builder`.

Verify before publishing:

```bash
npm run verify:client-id
npm run verify:packaged     # after a Windows build
```

## Publishing updates

Auto-update is configured for **GitHub Releases** (`electron-updater`). Publish with:

```bash
npm run publish
```

(Tag releases and attach artifacts as needed; keep versions in `package.json` aligned with releases.)

## How users get the app

You do **not** need an app store. Typical flow:

1. Attach **`dist/`** installers to a **[GitHub Release](https://github.com/Atif1299/YT-Automation/releases)** (or host the same files on your website).
2. Share the download link (README, landing page, video description, etc.).
3. Users download the installer, run it, then open **YT Commenting** like any other desktop program.

## Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Run the app in development |
| `npm run predist` | Generate `google-client-id.json` / `google-client-secret.json` from `.env` |
| `npm run dist` | Build for current platform (after predist if you run manually) |
| `npm run dist:win` | Windows installers |
| `npm run dist:mac` | macOS artifacts |
| `npm run publish` | Build and publish to configured provider (GitHub) |
| `npm run verify:client-id` | Check that client id file is non-empty |
| `npm run verify:packaged` | Sanity-check Windows packaged output |

## Documentation

- **[docs/post-ship-setup.md](docs/post-ship-setup.md)** — OAuth Desktop client, redirect URI, baking client ID into builds, signing, smoke testing.
- **[GOOGLE_OAUTH_PRODUCTION.md](GOOGLE_OAUTH_PRODUCTION.md)** — Production consent screen, verification, troubleshooting consent errors.

## Repository

**https://github.com/Atif1299/YT-Automation**
