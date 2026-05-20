# Security Policy

## Known Limitations

**WebSecurity is disabled** in the Electron main process (`webSecurity: false`
and `--disable-web-security` flag in some configurations). This is required
because:

- The app loads local video/image files via `file://` URLs
- The app uses a custom `local-file://` protocol for background assets
- Cross-origin restrictions would otherwise prevent loading user-selected media

**What this means**: The app should NOT be used to browse untrusted websites.
The app is designed to load only local content and a Vite dev server (in
development mode).

**Future direction**: Removing `webSecurity: false` by routing all local file
access through the custom protocol. Contributions toward this goal are welcome.

## Reporting a Vulnerability

Please report security vulnerabilities via email.
Do NOT open a public issue for security vulnerabilities.
