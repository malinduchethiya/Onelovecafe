# Cloudflare Pages Deployment Guide for OneLove Café

This repository is optimized for deployment on **Cloudflare Pages**, **Vercel**, and **Appwrite**.

---

## 🛠 Cloudflare Pages Dashboard Settings

When connecting your Git repository (GitHub / GitLab) to Cloudflare Pages:

1. **Project Name**: `onelovecafe` (or your chosen name)
2. **Production Branch**: `main` (or `master`)
3. **Framework Preset**: Select **`Vite`**
4. **Build Command**: `npm run build`
5. **Build Output Directory**: `dist`
6. **Root Directory**: *(Leave empty / root)*

---

## ⚙️ Critical Environment Variables (Cloudflare Pages Dashboard)

In your Cloudflare Pages project under **Settings** > **Environment variables** > **Production & Preview**:

| Variable Name | Value | Description |
|---|---|---|
| `NODE_VERSION` | `20` | **Mandatory** — Vite 8 and modern dependencies require Node 20+ (Cloudflare default build image runs older Node without this) |
| `NPM_FLAGS` | `--legacy-peer-deps` | Prevents strict npm peer dependency conflicts |

*(Note: `.nvmrc` and `.node-version` are also included in the repository root set to `20.18.0` for automatic detection).*

---

## 🔐 Optional Firebase Environment Variables

If you prefer to keep `firebase-applet-config.json` private or override settings per environment, you can set these in Cloudflare Pages:

- `VITE_FIREBASE_API_KEY`: Your Firebase Web API Key
- `VITE_FIREBASE_PROJECT_ID`: `advance-sandbox-gmzf6`
- `VITE_FIREBASE_DATABASE_ID`: `ai-studio-5fe42b00-de17-4d88-b455-9367f3431665`
- `VITE_FIREBASE_AUTH_DOMAIN`: `advance-sandbox-gmzf6.firebaseapp.com`
- `VITE_FIREBASE_STORAGE_BUCKET`: `advance-sandbox-gmzf6.firebasestorage.app`
- `VITE_FIREBASE_APP_ID`: `1:448261670736:web:b9c2a2ffea58dfe8ce0e55`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: `448261670736`

---

## 🚦 SPA Routing & Assets (Already Handled)

- `public/_redirects`: Directs all paths (`/admin`, `/reserve`, etc.) to `/index.html` with HTTP 200, preventing 404s on page refresh.
- `public/_headers`: Sets XML/plaintext headers and caching for `sitemap.xml` and `robots.txt`.
- Output is generated in `dist/` with all static assets in `dist/assets/`.

---

## 💡 Troubleshooting "error: lockfile had changes, but lockfile is frozen"

If Cloudflare Pages displays:
```
error: lockfile had changes, but lockfile is frozen
note: dependencies in package.json changed since bun.lock was saved
```

This occurs because Cloudflare Pages detects `bun.lock` and runs `bun install --frozen-lockfile`. When `package.json` is modified without committing the updated `bun.lock`, Bun rejects the build.

**Solution (Choose one):**
1. **Push both files together**:
   Make sure you commit the updated `bun.lock` along with `package.json`:
   ```bash
   git add package.json bun.lock
   git commit -m "Sync bun.lock with package.json"
   git push
   ```
2. **Or use standard npm instead of Bun**:
   Delete `bun.lock` from your repository (`git rm bun.lock && git commit -m "Use npm" && git push`). Cloudflare Pages will automatically switch to npm using the included `.npmrc`.

