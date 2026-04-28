const lineStatus = document.getElementById("line-status");
const tbIn = document.getElementById("tb-in");
const tbOut = document.getElementById("tb-out");
const channelEl = document.getElementById("channel");
const viewForm = document.getElementById("view-form");
const viewEmpty = document.getElementById("view-empty");
const signinBtn = document.getElementById("signin");
const signoutBtn = document.getElementById("signout");
const videoIdInput = document.getElementById("videoId");
const text = document.getElementById("text");
const generateBtn = document.getElementById("generate");
const postBtn = document.getElementById("post");
const result = document.getElementById("result");

function setResult(msg, kind) {
  result.textContent = msg;
  result.classList.remove("result--ok", "result--err", "result--work");
  if (kind === "ok") result.classList.add("result--ok");
  if (kind === "err") result.classList.add("result--err");
  if (kind === "work") result.classList.add("result--work");
  if (!msg) result.classList.remove("result--ok", "result--err", "result--work");
}

function extractVideoId(raw) {
  const t = raw.trim();
  if (!t) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(t)) return t;
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m) return m[1];
  }
  return null;
}

async function refresh() {
  lineStatus.hidden = true;
  const s = await window.api.getAuthStatus();
  if (s.signedIn) {
    tbIn.hidden = false;
    tbOut.hidden = true;
    viewForm.hidden = false;
    viewEmpty.hidden = true;
    const ch = await window.api.getChannel();
    if (ch.ok) {
      channelEl.textContent = ch.channelId;
      channelEl.title = "Channel " + ch.channelId;
    } else {
      channelEl.textContent = ch.error || "—";
      channelEl.removeAttribute("title");
    }
  } else {
    tbIn.hidden = true;
    tbOut.hidden = false;
    viewForm.hidden = true;
    viewEmpty.hidden = false;
    channelEl.textContent = "";
  }
}

signinBtn.addEventListener("click", async () => {
  lineStatus.hidden = false;
  lineStatus.textContent = "Sign-in window opened in your browser. Complete the steps there, then return here.";
  const r = await window.api.startAuth();
  if (!r.ok) {
    lineStatus.textContent = "Sign-in error: " + (r.error || "unknown");
    return;
  }
  lineStatus.hidden = true;
  if (r.channelId) {
    channelEl.textContent = r.channelId;
    channelEl.title = "Channel " + r.channelId;
  }
  await refresh();
});

signoutBtn.addEventListener("click", async () => {
  await window.api.logout();
  setResult("", null);
  await refresh();
});

generateBtn.addEventListener("click", async () => {
  const id = extractVideoId(videoIdInput.value);
  if (!id) {
    setResult("Set the video (URL or ID) first, then generate.", "err");
    return;
  }
  generateBtn.disabled = true;
  setResult("Loading video + calling OpenAI…", "work");
  const r = await window.api.generateComment(id);
  generateBtn.disabled = false;
  if (r.ok) {
    text.value = r.text;
    setResult("Draft placed in the comment box. Review before posting.", "ok");
  } else {
    setResult("Could not generate: " + (r.error || "unknown"), "err");
  }
});

postBtn.addEventListener("click", async () => {
  const id = extractVideoId(videoIdInput.value);
  if (!id) {
    setResult("Add a full YouTube link or an 11-character video ID.", "err");
    return;
  }
  if (!String(text.value || "").trim()) {
    setResult("Enter your comment text.", "err");
    return;
  }
  setResult("Sending…", "work");
  const r = await window.api.postComment({ videoId: id, text: text.value });
  if (r.ok) {
    setResult("Comment posted. Thread: " + (r.id || "ok") + ".", "ok");
  } else {
    setResult("Could not post: " + (r.error || "unknown"), "err");
  }
});

refresh();
