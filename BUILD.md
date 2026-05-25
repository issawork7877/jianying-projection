# 简影投屏 — Build & Signing Guide

## App Info

- **Name**: 简影投屏 / JianYing Projection
- **Version**: 1.0.0
- **Bundle ID**: com.jianying.projection

## Quick Build

```bash
npm install

# Development
npm run electron:dev

# Production builds
npm run electron:build:mac
npm run electron:build:win
npm run electron:build:linux
```

Output goes to `release/`.

---

## Code Signing

### macOS

Requirements:
- Apple Developer Program ($99/year) at [developer.apple.com](https://developer.apple.com)
- A "Developer ID Application" certificate (for distribution outside the Mac App Store)
- An app-specific password for notarization (generate at [appleid.apple.com](https://appleid.apple.com))

Setup:

```bash
# Copy the example env file
cp .env.example .env

# Fill in your credentials in .env:
#   APPLE_ID=you@example.com
#   APPLE_ID_PASSWORD=xxxx-xxxx-xxxx-xxxx
#   APPLE_TEAM_ID=ABCDE12345
#   CSC_LINK=/path/to/cert.p12
#   CSC_KEY_PASSWORD=your-cert-password

# Load env vars and build
source .env && npm run electron:build:mac
```

If env vars are set, electron-builder will auto-sign and notarize the `.dmg`.

Verify notarization:
```bash
spctl -a -v release/简影投屏-*.dmg
```

### Windows

Requirements:
- EV or OV Code Signing Certificate (~$300-400/year from DigiCert, Sectigo, etc.)
- Certificate in `.pfx` or `.p12` format

Setup:

```bash
# Set in .env:
#   CSC_LINK=/path/to/cert.pfx
#   CSC_KEY_PASSWORD=your-cert-password

# Build
source .env && npm run electron:build:win
```

New certificates need download volume before SmartScreen reputation builds up. Expect warnings for the first few hundred downloads.

---

## Auto-Update

This project uses `electron-updater` with GitHub Releases as the publish target.

### Setup

1. Create a GitHub Personal Access Token at [github.com/settings/tokens](https://github.com/settings/tokens) with `repo` scope.

2. Set the token in `.env`:
```bash
GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

3. The `publish` config in `package.json` is already configured for `github` provider (owner: `issayh`, repo: `jianying-projection`).

4. Build and publish:
```bash
source .env && npm run electron:build:mac
```

The build will upload artifacts to GitHub Releases automatically. `electron-updater` checks `latest.yml` on GitHub Releases for new versions.

### How updates work in the app

- On startup, the app checks GitHub Releases for a newer version.
- If an update is available, it fires `onUpdateAvailable` → the renderer can show a notification.
- The user triggers the download → autoUpdater downloads in the background.
- When downloaded, `onUpdateDownloaded` fires → the user can restart to install.

IPC channels available in the renderer:
```js
window.electronAPI.onUpdateAvailable((info) => { /* info.version */ })
window.electronAPI.onUpdateDownloaded((info) => { /* info.version */ })
window.electronAPI.downloadUpdate()
window.electronAPI.installUpdate()
```

---

## Environment Variables Reference

| Variable | Platform | Purpose |
|----------|----------|---------|
| `CSC_LINK` | macOS, Windows | Path to .p12/.pfx signing certificate |
| `CSC_KEY_PASSWORD` | macOS, Windows | Certificate password |
| `APPLE_ID` | macOS | Apple Developer account email |
| `APPLE_ID_PASSWORD` | macOS | App-specific password for notarization |
| `APPLE_TEAM_ID` | macOS | Apple Developer Team ID |
| `GH_TOKEN` | All | GitHub token for release publishing |

See `.env.example` for the template.

---

## CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml` runs lint + vite build on push.

To add release builds in CI, store the signing certificates and env vars as [GitHub Secrets](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions).
