# Post-ship setup checklist

Follow these steps after shipping the Electron app (installers, updates, OAuth, BYOK).

## 1. Google Cloud Platform

### OAuth client (Desktop)

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select (or create) a project.
2. **APIs & Services** → **Library** → enable **YouTube Data API v3**.
3. **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**.
4. Application type: **Desktop app** (required for PKCE without embedding a client secret).
5. Under **Authorized redirect URIs**, add exactly:

   `http://127.0.0.1:53134/oauth2callback`

   If you change port or path via environment variables (`OAUTH_REDIRECT_PORT`, `OAUTH_CALLBACK_PATH`), use the matching URI from [`main.js`](../main.js) (`getConfig()`).

6. Copy the **Client ID** — you will use it as `GOOGLE_CLIENT_ID` at build time (see below).

### Consent screen

- Configure the **OAuth consent screen** (user type, scopes).
- Scope in use: `https://www.googleapis.com/auth/youtube.force-ssl` (`youtube.force-ssl`).
- For users outside test users, Google may require **verification** for sensitive scopes — plan ahead.

## 2. Bake the OAuth client ID into installers

Shipped builds read the client ID from `google-client-id.json` (generated next to the project, copied into `extraResources`).

Before `npm run predist`, `npm run dist`, `npm run dist:win`, or `npm run dist:mac`:

```bash
# Windows PowerShell
$env:GOOGLE_CLIENT_ID="YOUR_CLIENT_ID.apps.googleusercontent.com"
npm run dist:win

# macOS / Linux
export GOOGLE_CLIENT_ID="YOUR_CLIENT_ID.apps.googleusercontent.com"
npm run dist:mac
```

Verify the generated file:

```bash
npm run verify:client-id
```

Use `--strict` to fail if `clientId` is empty (recommended in CI for release builds):

```bash
npm run verify:client-id -- --strict
```

Do **not** ship `GOOGLE_CLIENT_SECRET`; this app uses PKCE with `ClientAuthentication.None`.

## 3. OpenAI (end users)

- Users enter an API key in **Settings** (stored encrypted locally when the OS supports it).
- For **local development only**, you may use `.env` with `OPENAI_API_KEY` (see `.env.example`).

## 4. GitHub releases and auto-updates

- [`package.json`](../package.json) must list the correct `repository` URL and `build.publish` `owner` / `repo` so `electron-updater` resolves GitHub Releases.
- Bump `version` in `package.json`, tag (e.g. `git tag v1.0.1`), push the tag.
- CI (`.github/workflows/release.yml`) builds artifacts on tag `v*`; optional secret **`GOOGLE_CLIENT_ID`** injects OAuth client ID during build.
- Publishing installers to a release typically uses `GH_TOKEN` / `GITHUB_TOKEN` with permission to upload assets.

## 5. Code signing and icons (optional)

- **Windows**: Authenticode certificate — see [electron-builder code signing](https://www.electron.build/code-signing). Common env vars: `CSC_LINK`, `CSC_KEY_PASSWORD`.
- **macOS**: Developer ID + notarization — Apple Developer Program; see same docs and comments in [`.github/workflows/release.yml`](../.github/workflows/release.yml).
- **Icons**: Place `build/icon.png` (512×512 or larger, PNG). Reference it in `package.json` → `build.icon` when ready (see [build/README.txt](../build/README.txt)).

Unsigned builds still run but may show Smart Screen / Gatekeeper warnings.

## 6. Smoke test (after a local build)

1. Run `npm run dist:win` (or use existing `dist\win-unpacked`).
2. Run `npm run verify:packaged` — confirms `dist\win-unpacked\YT Commenting.exe` exists.
3. Launch the exe: **Sign in with Google**, **Settings** → save OpenAI key, run **Generate** and **Post** on a test video within quota/policy limits.

## 7. Distribution and compliance

- Provide a **privacy policy** (tokens and keys stored locally).
- Comply with **YouTube Terms**, **Community Guidelines**, and **API policies** for commenting.
