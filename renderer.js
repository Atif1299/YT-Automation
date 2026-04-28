const lineStatus = document.getElementById("line-status");
const tbIn = document.getElementById("tb-in");
const tbOut = document.getElementById("tb-out");
const channelEl = document.getElementById("channel");
const viewForm = document.getElementById("view-form");
const viewEmpty = document.getElementById("view-empty");
const signinBtn = document.getElementById("signin");
const signoutBtn = document.getElementById("signout");
const openSettingsBtn = document.getElementById("openSettings");
const settingsModal = document.getElementById("settingsModal");
const closeSettingsBtn = document.getElementById("closeSettings");
const systemPromptEl = document.getElementById("systemPrompt");
const savePromptBtn = document.getElementById("savePrompt");
const resetPromptBtn = document.getElementById("resetPrompt");

// Stepper
const stepBtn1 = document.getElementById("stepBtn1");
const stepBtn2 = document.getElementById("stepBtn2");
const stepBtn3 = document.getElementById("stepBtn3");
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");

// Step 1 controls
const discoveryModeSelect = document.getElementById("discoveryMode");
const qInput = document.getElementById("q");
const regionInput = document.getElementById("region");
const maxResultsInput = document.getElementById("maxResults");
const yearSelect = document.getElementById("year");
const monthSelect = document.getElementById("month");
const searchBtn = document.getElementById("search");
const resultsEmpty = document.getElementById("results-empty");
const resultsList = document.getElementById("results");
const selectAllBtn = document.getElementById("selectAll");
const clearSelectionBtn = document.getElementById("clearSelection");
const toDraftsBtn = document.getElementById("toDrafts");

// Step 2 controls
const queueCount = document.getElementById("queueCount");
const queueList = document.getElementById("queue");
const editorTitle = document.getElementById("editorTitle");
const editorMeta = document.getElementById("editorMeta");
const text = document.getElementById("text");
const prevDraftBtn = document.getElementById("prevDraft");
const nextDraftBtn = document.getElementById("nextDraft");
const generateBtn = document.getElementById("generate");
const generateAllBtn = document.getElementById("generateAll");
const clearDraftsAllBtn = document.getElementById("clearDraftsAll");
const toPostingBtn = document.getElementById("toPosting");
const backToSearchBtn = document.getElementById("backToSearch");
const progress = document.getElementById("progress");
const progressLabel = document.getElementById("progressLabel");
const progressCount = document.getElementById("progressCount");
const progressFill = document.getElementById("progressFill");

// Step 3 controls
const delaySecondsInput = document.getElementById("delaySeconds");
const postAllBtn = document.getElementById("postAll");
const backToDraftsBtn = document.getElementById("backToDrafts");
const postCount = document.getElementById("postCount");
const postList = document.getElementById("postList");
const progressPostingCount = document.getElementById("progressPostingCount");
const progressPostingFill = document.getElementById("progressPostingFill");
const result = document.getElementById("result");

let currentStep = 1;
let selectedVideoId = null;
/** @type {Array<{videoId:string,title:string,channelTitle:string,publishedAt:string,channelCountry:string,selected:boolean,draftText:string,draftStatus:'idle'|'generating'|'ready'|'error',postStatus:'idle'|'posting'|'posted'|'error',error:string}>} */
let searchVideos = [];
let isBatchGenerating = false;
let isBatchPosting = false;

let defaultPromptCache = "";

function getDiscoveryMode() {
  const v = discoveryModeSelect ? String(discoveryModeSelect.value || "").trim() : "search";
  return v === "trending" ? "trending" : "search";
}

function applyDiscoveryModeUi() {
  const mode = getDiscoveryMode();
  const isTrending = mode === "trending";
  qInput.disabled = isTrending;
  yearSelect.disabled = isTrending;
  monthSelect.disabled = isTrending || !yearSelect.value;
  if (isTrending) {
    qInput.value = "";
  }
}

function initYearMonth() {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  for (let y = currentYear; y >= currentYear - 10; y--) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    yearSelect.appendChild(opt);
  }
  monthSelect.disabled = true;
}

async function openSettings() {
  const r = await window.api.getPrompt();
  if (r?.ok) {
    defaultPromptCache = r.defaultPrompt || "";
    systemPromptEl.value = r.systemPrompt || "";
  }
  settingsModal.hidden = false;
}

function closeSettings() {
  settingsModal.hidden = true;
}

openSettingsBtn.addEventListener("click", () => {
  openSettings().catch(() => {
    settingsModal.hidden = false;
  });
});

closeSettingsBtn.addEventListener("click", closeSettings);
settingsModal.addEventListener("click", (e) => {
  if (e.target && e.target.classList && e.target.classList.contains("modal-backdrop")) {
    closeSettings();
  }
});

resetPromptBtn.addEventListener("click", () => {
  systemPromptEl.value = defaultPromptCache || "";
});

savePromptBtn.addEventListener("click", async () => {
  const val = String(systemPromptEl.value || "");
  const r = await window.api.setPrompt(val);
  if (r?.ok) {
    setResult("Saved system prompt.", "ok");
    closeSettings();
  } else {
    setResult("Could not save prompt: " + (r?.error || "unknown"), "err");
  }
});
function getYearMonth() {
  const year = Number.parseInt(String(yearSelect.value || ""), 10);
  const month = Number.parseInt(String(monthSelect.value || ""), 10);
  return {
    year: Number.isFinite(year) ? year : null,
    month: Number.isFinite(month) ? month : null,
  };
}

yearSelect.addEventListener("change", () => {
  if (!yearSelect.value) {
    monthSelect.value = "";
    monthSelect.disabled = true;
    return;
  }
  monthSelect.disabled = false;
});

if (discoveryModeSelect) {
  discoveryModeSelect.addEventListener("change", () => {
    applyDiscoveryModeUi();
  });
}

function setResult(msg, kind) {
  result.textContent = msg;
  result.classList.remove("result--ok", "result--err", "result--work");
  if (kind === "ok") result.classList.add("result--ok");
  if (kind === "err") result.classList.add("result--err");
  if (kind === "work") result.classList.add("result--work");
  if (!msg) result.classList.remove("result--ok", "result--err", "result--work");
}

function setProgress(label, done, total) {
  if (!total) {
    progress.hidden = true;
    return;
  }
  progress.hidden = false;
  progressLabel.textContent = label;
  progressCount.textContent = `${done}/${total}`;
  const pct = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  progressFill.style.width = `${pct}%`;
}

function clearProgress() {
  progress.hidden = true;
  progressLabel.textContent = "Progress";
  progressCount.textContent = "0/0";
  progressFill.style.width = "0%";
}

function setSelected(videoId) {
  selectedVideoId = videoId || null;
  const v = searchVideos.find((x) => x.videoId === selectedVideoId);
  if (v) {
    text.value = v.draftText || "";
    editorTitle.textContent = v.title || v.videoId;
    editorMeta.textContent = [v.channelTitle, v.channelCountry ? `(${v.channelCountry})` : "", v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : ""]
      .filter(Boolean)
      .join(" · ");
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function statusText(v) {
  const d =
    v.draftStatus === "ready"
      ? "Draft: ready"
      : v.draftStatus === "generating"
        ? "Draft: generating…"
        : v.draftStatus === "error"
          ? "Draft: error"
          : "Draft: —";
  const p =
    v.postStatus === "posted"
      ? "Posted: yes"
      : v.postStatus === "posting"
        ? "Posted: posting…"
        : v.postStatus === "error"
          ? "Posted: error"
          : "Posted: —";
  return `${d} · ${p}`;
}

function renderResults(videos) {
  resultsList.innerHTML = "";
  if (!videos.length) {
    resultsEmpty.hidden = false;
    return;
  }
  resultsEmpty.hidden = true;
  for (const v of videos) {
    const title = escapeHtml(v.title || "");
    const meta = escapeHtml(
      [
        v.channelTitle,
        v.channelCountry ? `(${v.channelCountry})` : "",
        v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : "",
      ]
        .filter(Boolean)
        .join(" · "),
    );
    const st = escapeHtml(statusText(v));
    const item = document.createElement("div");
    item.className = "result-item";
    item.dataset.videoId = v.videoId;
    item.setAttribute("role", "listitem");
    const checked = v.selected ? "checked" : "";
    item.innerHTML = `
      <div class="result-title">
        <label style="display:flex; gap:0.5rem; align-items:flex-start; cursor:pointer;">
          <input class="pick" type="checkbox" ${checked} />
          <span>${title}</span>
        </label>
      </div>
      <div class="result-meta">${meta}</div>
      <div class="result-meta">${st}</div>
    `;
    const cb = item.querySelector("input.pick");
    cb.addEventListener("click", (e) => {
      e.stopPropagation();
      v.selected = cb.checked;
      updateStepEnablement();
      renderResults(searchVideos);
    });
    item.addEventListener("click", () => {
      v.selected = true;
      setSelected(v.videoId);
      updateStepEnablement();
      renderResults(searchVideos);
      setResult("Selected: " + v.videoId, "ok");
    });
    resultsList.appendChild(item);
  }
}

function setButtonsEnabled() {
  const busy = isBatchGenerating || isBatchPosting;
  searchBtn.disabled = busy;
  selectAllBtn.disabled = busy;
  clearSelectionBtn.disabled = busy;
  toDraftsBtn.disabled = busy;
  generateBtn.disabled = busy;
  generateAllBtn.disabled = busy;
  toPostingBtn.disabled = busy;
  prevDraftBtn.disabled = busy;
  nextDraftBtn.disabled = busy;
  postAllBtn.disabled = busy;
}

function setStep(step) {
  currentStep = step;
  step1.hidden = step !== 1;
  step2.hidden = step !== 2;
  step3.hidden = step !== 3;

  stepBtn1.classList.toggle("is-active", step === 1);
  stepBtn2.classList.toggle("is-active", step === 2);
  stepBtn3.classList.toggle("is-active", step === 3);
}

function updateStepEnablement() {
  const selectedCount = searchVideos.filter((v) => v.selected).length;
  stepBtn2.disabled = selectedCount === 0;
  toDraftsBtn.disabled = selectedCount === 0 || isBatchGenerating || isBatchPosting;

  const postingReadyCount = searchVideos.filter((v) => v.selected && v.draftText).length;
  stepBtn3.disabled = postingReadyCount === 0;
  toPostingBtn.disabled = postingReadyCount === 0;

  if (!selectedVideoId) {
    const first = searchVideos.find((v) => v.selected);
    if (first) setSelected(first.videoId);
  }
  queueCount.textContent = `${selectedCount} selected`;
  postCount.textContent = `${postingReadyCount} items`;
}

function renderQueue() {
  const selected = searchVideos.filter((v) => v.selected);
  queueList.innerHTML = "";
  for (const v of selected) {
    const el = document.createElement("div");
    el.className = "result-item" + (v.videoId === selectedVideoId ? " is-selected" : "");
    el.dataset.videoId = v.videoId;
    const title = escapeHtml(v.title || "");
    const meta = escapeHtml(
      [v.channelTitle, v.channelCountry ? `(${v.channelCountry})` : "", v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : ""]
        .filter(Boolean)
        .join(" · "),
    );
    const st = escapeHtml(statusText(v));
    el.innerHTML = `<div class="result-title">${title}</div><div class="result-meta">${meta}</div><div class="result-meta">${st}</div>`;
    el.addEventListener("click", () => {
      setSelected(v.videoId);
      renderQueue();
    });
    queueList.appendChild(el);
  }
}

function renderPostList() {
  const selected = searchVideos.filter((v) => v.selected && v.draftText);
  postList.innerHTML = "";
  for (const v of selected) {
    const el = document.createElement("div");
    el.className = "result-item";
    const title = escapeHtml(v.title || "");
    const meta = escapeHtml(statusText(v));
    el.innerHTML = `<div class="result-title">${title}</div><div class="result-meta">${meta}</div>`;
    postList.appendChild(el);
  }
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

searchBtn.addEventListener("click", async () => {
  const mode = getDiscoveryMode();
  const query = (qInput.value || "").trim();
  if (mode === "search" && !query) {
    setResult("Enter a keyword to search.", "err");
    return;
  }
  const { year, month } = getYearMonth();
  searchBtn.disabled = true;
  setResult(mode === "trending" ? "Loading trending videos…" : "Searching…", "work");
  const regionCode = (regionInput.value || "").trim();
  const maxResults = Number(maxResultsInput.value || 10);
  const r =
    mode === "trending"
      ? await window.api.trendingVideos({
          regionCode,
          maxResults,
        })
      : await window.api.searchVideos(query, {
          regionCode,
          maxResults,
          year: yearSelect.value ? year : undefined,
          month: yearSelect.value && monthSelect.value ? month : undefined,
        });
  searchBtn.disabled = false;
  if (r.ok) {
    const incoming = Array.isArray(r.videos) ? r.videos : [];
    // Preserve drafts/status for overlapping videos between searches
    const byId = new Map(searchVideos.map((v) => [v.videoId, v]));
    searchVideos = incoming.map((v) => {
      const prev = byId.get(v.videoId);
      return {
        videoId: v.videoId,
        title: v.title || "",
        channelTitle: v.channelTitle || "",
        publishedAt: v.publishedAt || "",
        channelCountry: v.channelCountry || "",
        selected: prev?.selected || false,
        draftText: prev?.draftText || "",
        draftStatus: prev?.draftStatus || "idle",
        postStatus: prev?.postStatus || "idle",
        error: prev?.error || "",
      };
    });
    renderResults(searchVideos);
    setResult(mode === "trending" ? "Trending loaded. Pick a video from the list." : "Search complete. Pick a video from the list.", "ok");
    updateStepEnablement();
  } else {
    setResult((mode === "trending" ? "Trending failed: " : "Search failed: ") + (r.error || "unknown"), "err");
  }
});

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

text.addEventListener("input", () => {
  if (!selectedVideoId) return;
  const v = searchVideos.find((x) => x.videoId === selectedVideoId);
  if (!v) return;
  v.draftText = text.value;
  if (v.draftText && v.draftStatus === "idle") {
    v.draftStatus = "ready";
  }
  if (currentStep === 2) renderQueue();
});

selectAllBtn.addEventListener("click", () => {
  for (const v of searchVideos) v.selected = true;
  updateStepEnablement();
  renderResults(searchVideos);
});

clearSelectionBtn.addEventListener("click", () => {
  for (const v of searchVideos) v.selected = false;
  selectedVideoId = null;
  text.value = "";
  editorTitle.textContent = "Select a video";
  editorMeta.textContent = "";
  updateStepEnablement();
  renderResults(searchVideos);
});

toDraftsBtn.addEventListener("click", () => {
  setStep(2);
  renderQueue();
  updateStepEnablement();
});

toPostingBtn.addEventListener("click", () => {
  setStep(3);
  renderPostList();
  updateStepEnablement();
});

backToSearchBtn.addEventListener("click", () => {
  setStep(1);
});

backToDraftsBtn.addEventListener("click", () => {
  setStep(2);
  renderQueue();
});

stepBtn1.addEventListener("click", () => setStep(1));
stepBtn2.addEventListener("click", () => setStep(2));
stepBtn3.addEventListener("click", () => setStep(3));

function selectedList() {
  return searchVideos.filter((v) => v.selected);
}

function indexInSelected(videoId) {
  const sel = selectedList();
  return sel.findIndex((v) => v.videoId === videoId);
}

prevDraftBtn.addEventListener("click", () => {
  const sel = selectedList();
  if (!sel.length) return;
  const idx = Math.max(0, indexInSelected(selectedVideoId));
  const nextIdx = Math.max(0, idx - 1);
  setSelected(sel[nextIdx].videoId);
  renderQueue();
});

nextDraftBtn.addEventListener("click", () => {
  const sel = selectedList();
  if (!sel.length) return;
  const idx = Math.max(0, indexInSelected(selectedVideoId));
  const nextIdx = Math.min(sel.length - 1, idx + 1);
  setSelected(sel[nextIdx].videoId);
  renderQueue();
});

generateBtn.addEventListener("click", async () => {
  const id = selectedVideoId;
  if (!id) {
    setResult("Select a video first.", "err");
    return;
  }
  setSelected(id);
  const v = searchVideos.find((x) => x.videoId === id);
  if (v) {
    v.draftStatus = "generating";
    v.error = "";
    renderResults(searchVideos);
  }
  generateBtn.disabled = true;
  setResult("Loading video + calling OpenAI…", "work");
  const r = await window.api.generateComment(id);
  generateBtn.disabled = false;
  if (r.ok) {
    text.value = r.text;
    if (v) {
      v.draftText = r.text;
      v.draftStatus = "ready";
      renderQueue();
    }
    updateStepEnablement();
    setResult("Draft placed in the comment box. Review before posting.", "ok");
  } else {
    if (v) {
      v.draftStatus = "error";
      v.error = r.error || "unknown";
      renderQueue();
    }
    updateStepEnablement();
    setResult("Could not generate: " + (r.error || "unknown"), "err");
  }
});

generateAllBtn.addEventListener("click", async () => {
  const selected = selectedList();
  if (!selected.length) {
    setResult("Select at least 1 video first.", "err");
    return;
  }
  isBatchGenerating = true;
  setButtonsEnabled();
  setResult("Generating drafts in batches of 5…", "work");

  const targets = selected.filter((v) => !v.draftText);
  const total = targets.length;
  let done = 0;
  setProgress("Generating drafts", done, total);
  for (let i = 0; i < targets.length; i += 5) {
    const chunk = targets.slice(i, i + 5);
    for (const v of chunk) {
      v.draftStatus = "generating";
      v.error = "";
    }
    renderQueue();

    const results = await Promise.all(
      chunk.map(async (v) => ({ videoId: v.videoId, res: await window.api.generateComment(v.videoId) })),
    );
    for (const { videoId, res } of results) {
      const v = searchVideos.find((x) => x.videoId === videoId);
      if (!v) continue;
      if (res.ok) {
        v.draftText = res.text;
        v.draftStatus = "ready";
      } else {
        v.draftStatus = "error";
        v.error = res.error || "unknown";
      }
      done += 1;
      setProgress("Generating drafts", done, total);
    }
    renderQueue();
  }

  isBatchGenerating = false;
  setButtonsEnabled();
  clearProgress();
  setResult("Generate all complete. Review/edit drafts by selecting videos.", "ok");
  updateStepEnablement();
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clearDraftForVideo(videoId) {
  const v = searchVideos.find((x) => x.videoId === videoId);
  if (!v) return;
  v.draftText = "";
  v.draftStatus = "idle";
  v.error = "";
}

if (clearDraftsAllBtn) {
  clearDraftsAllBtn.addEventListener("click", () => {
    const selected = selectedList();
    if (!selected.length) {
      setResult("Select at least 1 video first.", "err");
      return;
    }
    for (const v of selected) {
      clearDraftForVideo(v.videoId);
    }
    text.value = "";
    renderQueue();
    renderResults(searchVideos);
    updateStepEnablement();
    setResult("Cleared drafts for selected videos.", "ok");
  });
}

postAllBtn.addEventListener("click", async () => {
  const delaySeconds = Math.max(0, Number(delaySecondsInput.value || 0));
  const delayMs = Math.round(delaySeconds * 1000);

  const targets = selectedList().filter((v) => v.draftText && v.postStatus !== "posted" && v.postStatus !== "error");
  if (!targets.length) {
    setResult("No drafts to post. Generate drafts first.", "err");
    return;
  }

  isBatchPosting = true;
  setButtonsEnabled();
  setResult("Posting drafts one by one…", "work");

  const total = targets.length;
  let done = 0;
  setProgress("Posting comments", done, total);
  for (let i = 0; i < targets.length; i++) {
    const v = targets[i];
    v.postStatus = "posting";
    v.error = "";
    renderPostList();

    const res = await window.api.postComment({ videoId: v.videoId, text: v.draftText });
    if (res.ok) {
      v.postStatus = "posted";
    } else {
      v.postStatus = "error";
      v.error = res.error || "unknown";
    }
    done += 1;
    setProgress("Posting comments", done, total);
    renderPostList();
    progressPostingCount.textContent = `${done}/${total}`;
    progressPostingFill.style.width = `${Math.max(0, Math.min(100, Math.round((done / total) * 100)))}%`;

    if (i < targets.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  isBatchPosting = false;
  setButtonsEnabled();
  clearProgress();
  setResult("Comment all complete.", "ok");
});

refresh();

initYearMonth();
applyDiscoveryModeUi();
