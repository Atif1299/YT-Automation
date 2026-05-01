# YT Commenting

Electron app to post YouTube comments via the YouTube Data API v3 (Google OAuth + optional OpenAI drafts).

## Quick start (development)

```bash
npm install
cp .env.example .env   # Windows: copy .env.example .env
# Edit .env: GOOGLE_CLIENT_ID, OPENAI_API_KEY (optional if using Settings in UI)
npm start
```

## Ship-ready builds and distribution

See **[docs/post-ship-setup.md](docs/post-ship-setup.md)** for Google Cloud OAuth (Desktop client + redirect URI), baking `GOOGLE_CLIENT_ID` into installers, GitHub Releases / auto-update, optional signing and icons, and smoke testing.

Repository for releases: `https://github.com/Atif1299/YT-Automation`
