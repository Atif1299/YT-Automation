const { app, BrowserWindow, shell, safeStorage, ipcMain, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const { parse: parseUrl } = require("url");

require("dotenv").config();

function loadEnvFromUserData() {
  try {
    const envPath = path.join(app.getPath("userData"), ".env");
    if (fs.existsSync(envPath)) {
      require("dotenv").config({ path: envPath });
    }
  } catch {
    // ignore
  }
}

function getGoogleClientSecret() {
  return String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
}

/**
 * Token exchange for Desktop OAuth + PKCE.
 * IMPORTANT: Only include client_secret if non-empty. Sending client_secret= (empty)
 * causes Google to reject with "client_secret is missing". Omitting it entirely
 * is correct for public Desktop clients using PKCE.
 */
async function exchangeAuthorizationCodeForTokens(code, codeVerifier) {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const { redirectUri } = getConfig();
  const body = new URLSearchParams();
  body.append("client_id", clientId);
  if (clientSecret) {
    body.append("client_secret", clientSecret);
  }
  body.append("code", code);
  body.append("code_verifier", codeVerifier);
  body.append("grant_type", "authorization_code");
  body.append("redirect_uri", redirectUri);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Token exchange failed (non-JSON): ${text.slice(0, 400)}`);
  }
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || text.slice(0, 300));
    err.response = { data };
    throw err;
  }
  const tokens = { ...data };
  if (typeof data.expires_in === "number") {
    tokens.expiry_date = Date.now() + data.expires_in * 1000;
    delete tokens.expires_in;
  }
  return tokens;
}

loadEnvFromUserData();

const { autoUpdater } = require("electron-updater");
const { OAuth2Client, ClientAuthentication } = require("google-auth-library");
const { google } = require("googleapis");
function needsRefresh(c) {
  if (!c.credentials?.refresh_token) return false;
  if (typeof c.isTokenExpiring === "function") {
    return c.isTokenExpiring(60);
  }
  const d = c.credentials.expiry_date;
  if (!d) return true;
  return d <= Date.now() + 60_000;
}

const SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"];
const USER_DATA = () => app.getPath("userData");
const TOKEN_FILE = () => path.join(USER_DATA(), "yt-tokens.enc");
const COMMENTED_FILE = () => path.join(USER_DATA(), "commented-videos.json");
const PROMPT_FILE = () => path.join(USER_DATA(), "prompt-settings.json");
const OPENAI_KEY_FILE = () => path.join(USER_DATA(), "openai-key.enc");
const channelCache = { id: null };
let commentedVideoIds = null;
let promptSettings = null;

let mainWindow;
let httpServer;
let pendingOAuth = null;

function ensureUserDataDir() {
  const dir = USER_DATA();
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
}

function getGoogleClientId() {
  const env = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  if (env) return env;
  const candidates = [];
  if (app.isPackaged && process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, "google-client-id.json"));
  }
  candidates.push(path.join(__dirname, "google-client-id.json"));
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      const id = String(j.clientId || "").trim();
      if (id) return id;
    } catch {
      // ignore
    }
  }
  return "";
}

function getConfig() {
  const port = Number.parseInt(String(process.env.OAUTH_REDIRECT_PORT || "53134"), 10);
  const raw = String(process.env.OAUTH_CALLBACK_PATH || "/oauth2callback").trim() || "/oauth2callback";
  const pathSuffix = raw.startsWith("/") ? raw : `/${raw}`;
  const redirectUri = `http://127.0.0.1:${port}${pathSuffix}`;
  return { port, pathSuffix, redirectUri };
}

/**
 * OAuth2 + PKCE. Uses ClientSecretPost so client_secret appears in the token POST body.
 * Desktop clients: empty secret is OK. Web clients: Google requires the real secret — set
 * GOOGLE_CLIENT_SECRET (dev .env or packaged: %APPDATA%\\yt-commenting\\.env).
 */
function getOAuth2Client() {
  const clientId = getGoogleClientId();
  const { redirectUri } = getConfig();
  if (!clientId) {
    throw new Error(
      "Missing Google OAuth client ID. For development set GOOGLE_CLIENT_ID in .env; for builds set GOOGLE_CLIENT_ID when running the predist script.",
    );
  }
  return new OAuth2Client({
    clientId,
    clientSecret: getGoogleClientSecret(),
    redirectUri,
    clientAuthentication: ClientAuthentication.ClientSecretPost,
  });
}

function generatePkcePair() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** Prefer Google's error_description from token/API failures (renderer only showed generic invalid_request before). */
function formatOAuthError(e) {
  const d = e?.response?.data;
  if (d && typeof d === "object") {
    const err = d.error != null ? String(d.error) : "";
    const desc = d.error_description != null ? String(d.error_description) : "";
    if (desc) return err ? `${err}: ${desc}` : desc;
    if (err) return err;
    try {
      return JSON.stringify(d);
    } catch {
      // ignore
    }
  }
  return e?.message || String(e);
}

function readTokens() {
  const f = TOKEN_FILE();
  if (!fs.existsSync(f)) return null;
  const buf = fs.readFileSync(f);
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return JSON.parse(safeStorage.decryptString(buf));
    } catch {
      return null;
    }
  }
  return JSON.parse(buf.toString("utf8"));
}

function writeTokens(t) {
  ensureUserDataDir();
  const f = TOKEN_FILE();
  const s = JSON.stringify(t);
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(f, safeStorage.encryptString(s));
  } else {
    fs.writeFileSync(f, s, "utf8");
  }
}

function readStoredOpenAIKey() {
  const f = OPENAI_KEY_FILE();
  if (!fs.existsSync(f)) return "";
  const buf = fs.readFileSync(f);
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(buf);
    } catch {
      return "";
    }
  }
  return buf.toString("utf8");
}

function getOpenAIApiKey() {
  const stored = readStoredOpenAIKey().trim();
  if (stored) return stored;
  return String(process.env.OPENAI_API_KEY || "").trim();
}

function writeStoredOpenAIKey(key) {
  ensureUserDataDir();
  const f = OPENAI_KEY_FILE();
  const s = String(key || "");
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(f, safeStorage.encryptString(s));
  } else {
    fs.writeFileSync(f, s, "utf8");
  }
}

function clearStoredOpenAIKey() {
  const f = OPENAI_KEY_FILE();
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

/** Merged credentials from refresh; keep prior refresh_token when the response omits it. */
function mergeRefreshed(prev, credentials) {
  if (!prev) return credentials;
  return { ...prev, ...credentials, refresh_token: credentials.refresh_token || prev.refresh_token };
}

function clearTokens() {
  const f = TOKEN_FILE();
  if (fs.existsSync(f)) fs.unlinkSync(f);
  channelCache.id = null;
}

function loadCommentedVideoIds() {
  if (commentedVideoIds) return commentedVideoIds;
  commentedVideoIds = new Set();
  const f = COMMENTED_FILE();
  if (!fs.existsSync(f)) return commentedVideoIds;
  try {
    const raw = fs.readFileSync(f, "utf8");
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed?.videoIds) ? parsed.videoIds : [];
    for (const id of arr) {
      if (typeof id === "string" && id.trim()) commentedVideoIds.add(id.trim());
    }
  } catch {
    // treat as empty
  }
  return commentedVideoIds;
}

function persistCommentedVideoIds() {
  ensureUserDataDir();
  const set = loadCommentedVideoIds();
  const f = COMMENTED_FILE();
  try {
    fs.writeFileSync(
      f,
      JSON.stringify({ version: 1, videoIds: Array.from(set.values()) }, null, 2),
      "utf8",
    );
  } catch {
    // ignore persistence errors
  }
}

function defaultSystemPrompt() {
  return [
    "You write YouTube comments for one specific recipient at a time. They may have been reached through prior research (e.g. founder/social context); your job is a single, authentic comment that matches THIS video, not a mass template.",
    "Product you represent: Schmoozzer. Positioning: it is a \"Supercharger Plugin\" for ActiveCampaign (AC). You never say Schmoozzer replaces AC; you only convey that it makes AC much more powerful and can reduce cost. Schmoozzer is a SaaS Product Act as a Marketing Hub for businesses that handle four channels automations like email, SMS, whatsapp, linkedin or instagram.",
    "Marketing sense (light touch): the goal is genuine engagement so the right person may search \"Schmoozzer\" or use a link in a bio—not a hard pitch in the comment. Sound like a peer (marketing/ops/CRM angle), not a sales blast.",
    "Style: 1–2 short sentences, conversational, specific to the video’s topic. Optional soft curiosity about scaling AC, automations, or email ops ONLY if it fits the video. No hashtag spam, no emojis unless natural, no \"as an AI\", no false claims, no \"guaranteed\" results.",
    "If the video is not about Marketing/CRM/Schmoozzer, stay topical first; you may add one light, relevant nod to better tooling or email stack efficiency only if it does not feel forced. Match the video language if the title/description is not English. Also make sure that you don't have to represent ActiveCompaign Plateform, you have to represent Schmoozzer Plateform that is built on top of ActiveCompaign.",
  ].join(" ");
}

function loadPromptSettings() {
  if (promptSettings) return promptSettings;
  promptSettings = { version: 1, systemPrompt: "" };
  const f = PROMPT_FILE();
  if (fs.existsSync(f)) {
    try {
      const raw = fs.readFileSync(f, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        promptSettings.systemPrompt =
          typeof parsed.systemPrompt === "string" ? parsed.systemPrompt : "";
      }
    } catch {
      // ignore
    }
  }
  // Ensure there is always a visible default stored on disk.
  if (!String(promptSettings.systemPrompt || "").trim()) {
    promptSettings.systemPrompt = defaultSystemPrompt();
    persistPromptSettings();
  }
  return promptSettings;
}

function persistPromptSettings() {
  ensureUserDataDir();
  const s = loadPromptSettings();
  const f = PROMPT_FILE();
  try {
    fs.writeFileSync(
      f,
      JSON.stringify({ version: 1, systemPrompt: s.systemPrompt || "" }, null, 2),
      "utf8",
    );
  } catch {
    // ignore
  }
}

function getEffectiveSystemPrompt() {
  const s = loadPromptSettings();
  // Settings always stores an explicit prompt (default or custom).
  return String(s.systemPrompt || "").trim() || defaultSystemPrompt();
}

async function fetchChannelIdForUser(oauth2) {
  if (channelCache.id) return channelCache.id;
  const youtube = google.youtube({ version: "v3", auth: oauth2 });
  const res = await youtube.channels.list({ part: ["id"], mine: true });
  const id = res.data?.items?.[0]?.id;
  if (!id) throw new Error("No YouTube channel for this account. Use a Google account with a YouTube channel.");
  channelCache.id = id;
  return id;
}

function stopLocalServer() {
  if (httpServer) {
    try {
      httpServer.close();
    } catch {
      // ignore
    }
    httpServer = null;
  }
}

/**
 * @returns {Promise<{ code: string, codeVerifier: string }>}
 */
function startOAuthCodeFlow() {
  const { port, pathSuffix } = getConfig();
  const oauth2 = getOAuth2Client();
  const { verifier: codeVerifier, challenge: codeChallenge } = generatePkcePair();
  if (httpServer) stopLocalServer();

  return new Promise((resolve, reject) => {
    const authUrl = oauth2.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    httpServer = http
      .createServer((req, res) => {
        const p = parseUrl(req.url || "", true);
        if (!p.pathname || p.pathname !== pathSuffix) {
          res.writeHead(404);
          res.end();
          return;
        }
        const code = p.query && p.query.code;
        const err = p.query && p.query.error;
        if (err) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(
            "<p>Authentication failed. You can close this tab and return to the app.</p>"
          );
          stopLocalServer();
          if (pendingOAuth) {
            const r = pendingOAuth;
            pendingOAuth = null;
            r.reject(new Error(String(err)));
          }
          return;
        }
        if (!code || typeof code !== "string") {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<p>Missing code. Close this tab and try again from the app.</p>");
          stopLocalServer();
          if (pendingOAuth) {
            const r = pendingOAuth;
            pendingOAuth = null;
            r.reject(new Error("Missing authorization code"));
          }
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<p>Google returned an authorization code. Close this tab — sign-in completes in the desktop app.</p>" +
            "<p>If the app shows an error, the browser step still succeeded; try again or check the message in the app.</p>"
        );
        stopLocalServer();

        if (pendingOAuth) {
          const r = pendingOAuth;
          pendingOAuth = null;
          r.resolve({ code, codeVerifier });
        }
      })
      .listen(port, "127.0.0.1", () => {
        pendingOAuth = { resolve, reject };
        shell
          .openExternal(authUrl)
          .catch((e) => {
            stopLocalServer();
            if (pendingOAuth) {
              const r = pendingOAuth;
              pendingOAuth = null;
              r.reject(e);
            }
          });
      });

    httpServer.on("error", (e) => {
      stopLocalServer();
      reject(e);
    });

    const timeoutMs = 5 * 60 * 1000;
    setTimeout(() => {
      if (httpServer) {
        stopLocalServer();
        if (pendingOAuth) {
          const r = pendingOAuth;
          pendingOAuth = null;
          r.reject(new Error("OAuth timeout (5 minutes)"));
        }
      }
    }, timeoutMs);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 620,
    minWidth: 640,
    minHeight: 480,
    backgroundColor: "#0e0e12",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWindow.loadFile("index.html");
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;
  autoUpdater.checkForUpdatesAndNotify().catch(() => {
    // offline or unpublished feed
  });
}

app.whenReady().then(() => {
  loadEnvFromUserData();
  if (process.platform !== "darwin") {
    Menu.setApplicationMenu(null);
  }
  createWindow();
  setupAutoUpdater();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
  stopLocalServer();
});

ipcMain.handle("auth:status", async () => {
  const tokens = readTokens();
  return { signedIn: !!(tokens && tokens.access_token) };
});

ipcMain.handle("channel:get", async () => {
  try {
    if (channelCache.id) return { ok: true, channelId: channelCache.id };
    const t = readTokens();
    if (!t?.access_token) return { ok: false, error: "Not signed in" };
    const oauth2 = getOAuth2Client();
    oauth2.setCredentials(t);
    if (needsRefresh(oauth2) && t.refresh_token) {
      const { credentials } = await oauth2.refreshAccessToken();
      const merged = mergeRefreshed(t, credentials);
      oauth2.setCredentials(merged);
      writeTokens(merged);
    }
    const channelId = await fetchChannelIdForUser(oauth2);
    return { ok: true, channelId };
  } catch (e) {
    return { ok: false, error: formatOAuthError(e) };
  }
});

ipcMain.handle("oauth:start", async () => {
  try {
    const { code, codeVerifier } = await startOAuthCodeFlow();
    const oauth2 = getOAuth2Client();
    const tokens = await exchangeAuthorizationCodeForTokens(code, codeVerifier);
    oauth2.setCredentials(tokens);
    writeTokens(tokens);
    channelCache.id = null;
    const channelId = await fetchChannelIdForUser(oauth2);
    return { ok: true, channelId };
  } catch (e) {
    return { ok: false, error: formatOAuthError(e) };
  }
});

ipcMain.handle("auth:logout", () => {
  clearTokens();
  return { ok: true };
});

ipcMain.handle("openai:keyStatus", async () => {
  const hasKey = !!getOpenAIApiKey();
  return { ok: true, hasKey };
});

ipcMain.handle("openai:setKey", async (_e, rawKey) => {
  const key = typeof rawKey === "string" ? rawKey.trim() : "";
  if (!key) {
    clearStoredOpenAIKey();
    return { ok: true };
  }
  writeStoredOpenAIKey(key);
  return { ok: true };
});

ipcMain.handle("openai:clearKey", async () => {
  clearStoredOpenAIKey();
  return { ok: true };
});

ipcMain.handle("comment:post", async (_e, payload) => {
  const { videoId, text } = payload || {};
  if (!videoId || !String(text || "").trim()) {
    return { ok: false, error: "videoId and text are required" };
  }
  const t = readTokens();
  if (!t?.access_token) {
    return { ok: false, error: "Not signed in" };
  }
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials(t);
  if (needsRefresh(oauth2) && t.refresh_token) {
    const { credentials } = await oauth2.refreshAccessToken();
    const merged = mergeRefreshed(t, credentials);
    oauth2.setCredentials(merged);
    writeTokens(merged);
  }
  try {
    const channelId = await fetchChannelIdForUser(oauth2);
    const youtube = google.youtube({ version: "v3", auth: oauth2 });
    const res = await youtube.commentThreads.insert({
      part: ["snippet"],
      requestBody: {
        snippet: {
          videoId: String(videoId).trim(),
          channelId,
          topLevelComment: {
            snippet: {
              textOriginal: String(text),
            },
          },
        },
      },
    });
    const idTrimmed = String(videoId).trim();
    loadCommentedVideoIds().add(idTrimmed);
    persistCommentedVideoIds();
    return { ok: true, id: res.data.id };
  } catch (e) {
    const err = e?.response?.data || e;
    return {
      ok: false,
      error: e?.message || (typeof err === "object" ? JSON.stringify(err) : String(e)),
    };
  }
});

async function callOpenAIChat(system, user) {
  const key = getOpenAIApiKey();
  if (!key) {
    throw new Error('Add your OpenAI API key in Settings (or set OPENAI_API_KEY in .env for development).');
  }
  const model = (process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + key,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 500,
      temperature: 0.65,
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error("OpenAI: " + res.status + " " + raw.slice(0, 400));
  }
  const data = JSON.parse(raw);
  const out = data?.choices?.[0]?.message?.content;
  if (!String(out || "").trim()) {
    throw new Error("OpenAI returned empty text");
  }
  return String(out).trim();
}

ipcMain.handle("comment:generate", async (_e, payload) => {
  const id = (payload && payload.videoId) ? String(payload.videoId).trim() : "";
  if (!id) {
    return { ok: false, error: "Video ID is required" };
  }
  const t = readTokens();
  if (!t?.access_token) {
    return { ok: false, error: "Not signed in" };
  }
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials(t);
  if (needsRefresh(oauth2) && t.refresh_token) {
    const { credentials } = await oauth2.refreshAccessToken();
    const merged = mergeRefreshed(t, credentials);
    oauth2.setCredentials(merged);
    writeTokens(merged);
  }
  try {
    const youtube = google.youtube({ version: "v3", auth: oauth2 });
    const list = await youtube.videos.list({ part: ["snippet"], id: [id] });
    const item = list.data?.items?.[0];
    if (!item) {
      return { ok: false, error: "Video not found or not accessible" };
    }
    const sn = item.snippet || {};
    const title = sn.title || "";
    const description = (sn.description || "").slice(0, 12000);
    const system = getEffectiveSystemPrompt();
    const userMsg =
      "Video title:\n" +
      title +
      "\n\nVideo description:\n" +
      (description || "(no description)");
    const text = await callOpenAIChat(system, userMsg);
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
});

ipcMain.handle("prompt:get", () => {
  const current = loadPromptSettings();
  return { ok: true, systemPrompt: current.systemPrompt || "", defaultPrompt: defaultSystemPrompt() };
});

ipcMain.handle("prompt:set", (_e, payload) => {
  const next = payload?.systemPrompt;
  if (typeof next !== "string") return { ok: false, error: "systemPrompt must be a string" };
  const s = loadPromptSettings();
  s.systemPrompt = next.trim() ? next : defaultSystemPrompt();
  persistPromptSettings();
  return { ok: true };
});

ipcMain.handle("videos:search", async (_e, payload) => {
  const query = payload?.query ? String(payload.query).trim() : "";
  const maxResultsRaw = payload?.maxResults;
  const regionCodeRaw = payload?.regionCode;
  const yearRaw = payload?.year;
  const monthRaw = payload?.month;

  if (!query) return { ok: false, error: "Query is required" };

  const maxResults = Math.max(
    1,
    Math.min(50, Number.isFinite(Number(maxResultsRaw)) ? Number(maxResultsRaw) : 10),
  );
  const regionCode = regionCodeRaw ? String(regionCodeRaw).trim().toUpperCase() : "";

  const now = new Date();
  const year = Number.isFinite(Number(yearRaw)) ? Number(yearRaw) : NaN;
  const month = Number.isFinite(Number(monthRaw)) ? Number(monthRaw) : NaN;

  let publishedAfter;
  let publishedBefore;
  if (Number.isFinite(year)) {
    if (Number.isFinite(month) && month >= 1 && month <= 12) {
      const after = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const before = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1, 0, 0, 0));
      publishedAfter = after.toISOString();
      publishedBefore = before.toISOString();
    } else {
      const after = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
      const before = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
      publishedAfter = after.toISOString();
      publishedBefore = before.toISOString();
    }
  } else {
    const before = now;
    const after = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    publishedAfter = after.toISOString();
    publishedBefore = before.toISOString();
  }

  const t = readTokens();
  if (!t?.access_token) return { ok: false, error: "Not signed in" };

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials(t);
  if (needsRefresh(oauth2) && t.refresh_token) {
    const { credentials } = await oauth2.refreshAccessToken();
    const merged = mergeRefreshed(t, credentials);
    oauth2.setCredentials(merged);
    writeTokens(merged);
  }

  try {
    const youtube = google.youtube({ version: "v3", auth: oauth2 });
    const res = await youtube.search.list({
      part: ["snippet"],
      type: ["video"],
      q: query,
      maxResults,
      ...(regionCode ? { regionCode } : {}),
      ...(publishedAfter ? { publishedAfter } : {}),
      ...(publishedBefore ? { publishedBefore } : {}),
    });
    const items = Array.isArray(res.data?.items) ? res.data.items : [];
    const already = loadCommentedVideoIds();
    const base = items
      .map((it) => ({
        videoId: it?.id?.videoId || "",
        title: it?.snippet?.title || "",
        channelId: it?.snippet?.channelId || "",
        channelTitle: it?.snippet?.channelTitle || "",
        publishedAt: it?.snippet?.publishedAt || "",
      }))
      .filter((v) => v.videoId && !already.has(v.videoId));

    // Fetch channel countries (if set by channel owner)
    const channelIds = Array.from(
      new Set(base.map((v) => v.channelId).filter((id) => typeof id === "string" && id.trim())),
    );
    const channelCountry = new Map();
    for (let i = 0; i < channelIds.length; i += 50) {
      const chunk = channelIds.slice(i, i + 50);
      const chRes = await youtube.channels.list({ part: ["snippet"], id: chunk });
      const chItems = Array.isArray(chRes.data?.items) ? chRes.data.items : [];
      for (const ch of chItems) {
        const id = ch?.id;
        const country = ch?.snippet?.country;
        if (id && typeof country === "string" && country.trim()) {
          channelCountry.set(id, country.trim().toUpperCase());
        }
      }
    }

    const videos = base.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      channelTitle: v.channelTitle,
      publishedAt: v.publishedAt,
      channelCountry: channelCountry.get(v.channelId) || "",
    }));

    return { ok: true, videos };
  } catch (e) {
    const err = e?.response?.data || e;
    return {
      ok: false,
      error: e?.message || (typeof err === "object" ? JSON.stringify(err) : String(e)),
    };
  }
});

ipcMain.handle("videos:trending", async (_e, payload) => {
  const maxResultsRaw = payload?.maxResults;
  const regionCodeRaw = payload?.regionCode;
  const categoryIdRaw = payload?.videoCategoryId;

  const maxResults = Math.max(
    1,
    Math.min(50, Number.isFinite(Number(maxResultsRaw)) ? Number(maxResultsRaw) : 10),
  );
  const regionCode = regionCodeRaw ? String(regionCodeRaw).trim().toUpperCase() : "";
  const videoCategoryId =
    typeof categoryIdRaw === "string" && categoryIdRaw.trim() ? categoryIdRaw.trim() : "";

  const t = readTokens();
  if (!t?.access_token) return { ok: false, error: "Not signed in" };

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials(t);
  if (needsRefresh(oauth2) && t.refresh_token) {
    const { credentials } = await oauth2.refreshAccessToken();
    const merged = mergeRefreshed(t, credentials);
    oauth2.setCredentials(merged);
    writeTokens(merged);
  }

  try {
    const youtube = google.youtube({ version: "v3", auth: oauth2 });
    const res = await youtube.videos.list({
      part: ["snippet"],
      chart: "mostPopular",
      maxResults,
      ...(regionCode ? { regionCode } : {}),
      ...(videoCategoryId ? { videoCategoryId } : {}),
    });
    const items = Array.isArray(res.data?.items) ? res.data.items : [];
    const already = loadCommentedVideoIds();
    const base = items
      .map((it) => ({
        videoId: it?.id || "",
        title: it?.snippet?.title || "",
        channelId: it?.snippet?.channelId || "",
        channelTitle: it?.snippet?.channelTitle || "",
        publishedAt: it?.snippet?.publishedAt || "",
      }))
      .filter((v) => v.videoId && !already.has(v.videoId));

    const channelIds = Array.from(
      new Set(base.map((v) => v.channelId).filter((id) => typeof id === "string" && id.trim())),
    );
    const channelCountry = new Map();
    for (let i = 0; i < channelIds.length; i += 50) {
      const chunk = channelIds.slice(i, i + 50);
      const chRes = await youtube.channels.list({ part: ["snippet"], id: chunk });
      const chItems = Array.isArray(chRes.data?.items) ? chRes.data.items : [];
      for (const ch of chItems) {
        const id = ch?.id;
        const country = ch?.snippet?.country;
        if (id && typeof country === "string" && country.trim()) {
          channelCountry.set(id, country.trim().toUpperCase());
        }
      }
    }

    const videos = base.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      channelTitle: v.channelTitle,
      publishedAt: v.publishedAt,
      channelCountry: channelCountry.get(v.channelId) || "",
    }));

    return { ok: true, videos };
  } catch (e) {
    const err = e?.response?.data || e;
    return {
      ok: false,
      error: e?.message || (typeof err === "object" ? JSON.stringify(err) : String(e)),
    };
  }
});

ipcMain.handle("categories:list", async (_e, payload) => {
  const regionCodeRaw = payload?.regionCode;
  const regionCode = regionCodeRaw ? String(regionCodeRaw).trim().toUpperCase() : "";

  const t = readTokens();
  if (!t?.access_token) return { ok: false, error: "Not signed in" };

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials(t);
  if (needsRefresh(oauth2) && t.refresh_token) {
    const { credentials } = await oauth2.refreshAccessToken();
    const merged = mergeRefreshed(t, credentials);
    oauth2.setCredentials(merged);
    writeTokens(merged);
  }

  try {
    const youtube = google.youtube({ version: "v3", auth: oauth2 });
    const res = await youtube.videoCategories.list({
      part: ["snippet"],
      ...(regionCode ? { regionCode } : {}),
    });
    const items = Array.isArray(res.data?.items) ? res.data.items : [];
    const categories = items
      .map((it) => ({
        id: String(it?.id || ""),
        title: String(it?.snippet?.title || ""),
      }))
      .filter((c) => c.id && c.title);
    return { ok: true, categories };
  } catch (e) {
    const err = e?.response?.data || e;
    return {
      ok: false,
      error: e?.message || (typeof err === "object" ? JSON.stringify(err) : String(e)),
    };
  }
});
