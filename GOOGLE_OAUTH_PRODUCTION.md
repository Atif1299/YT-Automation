# Google OAuth – Production / consent 500 checklist

Use this in **Google Cloud Console** for this app. The Electron build does not fix HTTP **500** on `accounts.google.com/.../oauth/consent`; that is resolved by Console configuration, verification, or retrying if Google had a transient outage.

Requested scope in code: `https://www.googleapis.com/auth/youtube.force-ssl` (see `main.js`).

---

## 1. OAuth consent screen (External + Production)

In **APIs & Services → OAuth consent screen**:

- [ ] **User type** matches your intent: **External** (any Google account) or **Internal** (Google Workspace in your org only – if available).
- [ ] **App name**, **User support email**, **Developer contact email** are set.
- [ ] **Authorized domains** – Only domains you control; must match where your **App domain** / links are hosted (no `localhost` as a production domain).
- [ ] **Application home page** – Valid **HTTPS** URL; page loads for the public.
- [ ] **Privacy policy link** – Valid **HTTPS** URL; policy mentions OAuth data use if applicable.
- [ ] **Application terms of service link** – If required or shown, valid **HTTPS** URL.

Fix broken or placeholder links before expecting Production consent to work.

---

## 2. OAuth app verification (sensitive / YouTube scopes)

For `youtube.force-ssl` with users **outside** the test-user list in Production:

- [ ] Open **APIs & Services → OAuth consent screen** and read any **verification** or **policy** banners.
- [ ] Start **[OAuth app verification](https://support.google.com/cloud/answer/9110914)** if prompted for sensitive or restricted scopes.
- [ ] Complete YouTube / sensitive scope review steps Google requests (demo video, justification, etc.).

Until verification is approved, non–test users may see errors, warnings, or intermittent failures during consent.

---

## 3. If you still see HTTP 500 on consent

- [ ] Wait and **retry** sign-in later (Google-side transient errors happen).
- [ ] Check **[Google Cloud Status](https://status.cloud.google.com/)** and whether **Google Account / Identity** services have incidents.
- [ ] Confirm the **OAuth client** used in builds matches the project where you completed the consent screen (**Desktop** client for this app’s loopback flow).

---

## Short-term option (company-only testers)

Keep the app in **Testing** and add every tester under **Test users** on the consent screen, **or** use **Internal** user type if your Workspace setup supports it—without opening access to all Gmail accounts until Production + verification are ready.
