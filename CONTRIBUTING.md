# Contributing to JianYing Projection

Thanks for your interest in contributing.

## Getting Started

1. Fork the repo
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/jianying-projection.git`
3. Install dependencies: `npm install`
4. Start dev: `npm run electron:dev`

## Development Workflow

- Create a feature branch from `main`
- Make your changes
- Run `npm run lint` before committing
- Test with `npm run electron:dev`

## Code Style

- Follow the project's ESLint configuration
- Follow existing React patterns in `src/components/`
- Keep the minimalist black/white/gray design language
- Use the existing i18n system (`src/data/i18n.js`) for user-facing strings

## Building

```bash
# International build (public domain content only)
npm run electron:build:intl:mac
npm run electron:build:intl:win
npm run electron:build:intl:linux
```

## Adding Bible or Song Data

- Do NOT commit copyrighted Bible translations or song lyrics
- Use the `.jydata` data pack system for data contributions
- See `scripts/build-data-pack.js` for the pack format

## Reporting Issues

- Use GitHub Issues
- Include your OS, Electron version, and steps to reproduce
- For security vulnerabilities, see SECURITY.md
