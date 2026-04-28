# UI layout options (stepper flow)

Goal: keep the same features (search + filters + results + batch generate + batch post + dedupe + country + time filters) but make the UI **feel simpler** by not showing everything at once.

This approach is a **3-step flow** with a persistent top bar. You move forward/back without losing data.

---

## Stepper layout (single recommended option)

### Global (always visible)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ AppBar: Logo  YT Commenting                                  ACTIVE  ... │
│ Stepper:  [1 Search]  →  [2 Drafts]  →  [3 Posting]                 SignOut│
└──────────────────────────────────────────────────────────────────────────┘
```

- Stepper shows which step you’re on; other steps are clickable if enabled.
- The app keeps the same search results + drafts in memory while you move between steps.

---

### Step 1 — Search (find videos + choose which to include)

Purpose: search and select the target set. Clean list. No comment editor yet.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Keyword ______________________] [Region __] [Max __] [Year __] [Month __]│
│ [Search]   Filter defaults: last 30d unless Year/Month chosen            │
├──────────────────────────────────────────────────────────────────────────┤
│ Results (scroll)                                                         │
│ [ ] Title …  · Channel (Country) · Date                                  │
│     Draft: —  · Posted: —                                                │
│ [ ] Title …                                                              │
│ ...                                                                      │
├──────────────────────────────────────────────────────────────────────────┤
│ Actions:  [Select all] [Clear]                               [Next → Drafts]│
│ Status line                                                              │
└──────────────────────────────────────────────────────────────────────────┘
```

Notes:
- Each result has a checkbox. Only checked items move to Drafts.
- Already-commented videos are already filtered out (dedupe).

---

### Step 2 — Drafts (generate + review/edit)

Purpose: generate drafts in batches of 5, then review/edit one at a time.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Left: Draft queue (scroll)          Right: Draft editor                  │
│  > Title …  Draft: ready            Video: Title / Channel / Country     │
│    Title …  Draft: generating…      Comment textarea                     │
│    Title …  Draft: error            [Save] (auto-saves on typing)        │
│                                   ┌───────────────────────────────────┐ │
│ Footer actions:                    │ textarea…                          │ │
│  [Generate all (5x)] [Generate selected] [Prev] [Next]                  │
│  Progress bar + done/total                                           [Next → Posting]│
└──────────────────────────────────────────────────────────────────────────┘
```

Notes:
- “Generate all” only targets checked items missing drafts.
- Draft text is always editable before posting.

---

### Step 3 — Posting (comment all with delay + log)

Purpose: post sequentially with delay and clear feedback.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Posting settings:  Delay (s) [ 5 ]                                       │
│ [Start Comment all]  [Stop]                                              │
├──────────────────────────────────────────────────────────────────────────┤
│ Progress: Posting comments  7/20  [==========      ]                     │
├──────────────────────────────────────────────────────────────────────────┤
│ Log / list:                                                               │
│  Title …  Posted: yes   (threadId …)                                     │
│  Title …  Posted: error (reason…)                                        │
│  ...                                                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

Notes:
- After each success, the `videoId` is persisted so it won’t show in future searches.

---

## What I need from you
Reply **“Approve stepper”** if you want me to implement this layout.

If you want one tweak before implementation, say it like:\n- “In Step 1 I want results as a table”\n- “In Step 2 I want editor full width and queue on top”\n- “In Step 3 show only errors in the log by default”

