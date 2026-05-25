# 简影投屏 / JianYing Projection

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-41.x-47848f)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.x-61dafb)](https://react.dev/)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)]()

> Minimalist worship projection software. Bible verses, hymn lyrics, backgrounds, multi-screen. Free, open source, cross-platform.

> 极简主义教会/舞台投影软件。经文 · 诗歌 · 背景 · 多屏。免费 · 开源 · 跨平台。

---

## Features / 功能

- Bible verse projection / 圣经经文投影
- Hymn/lyric projection with slides / 诗歌歌词投屏
- Custom backgrounds — images (JPG/PNG/WebP) and video (MP4/MOV/WebM) / 自定义背景
- Multi-display support — projection, stage, live, external / 多屏幕输出
- Countdown timer / 倒计时工具
- Clock display / 时钟显示
- Screen sharing / 屏幕分享
- Playlist creation and playback / 播放列表
- `.jydata` data pack import system / 数据包导入
- Bilingual UI: Chinese (Simplified/Traditional) + English / 中英文界面

## Screenshots / 截图

*Coming soon*

## Quick Start / 快速开始

```bash
npm install
npm run electron:dev
```

## Installation / 安装

Download the latest installer from [GitHub Releases](https://github.com/issawork7877/jianying-projection/releases).

| Platform | Format |
|----------|--------|
| macOS | `.dmg` (Apple Silicon + Intel) |
| Windows | `.exe` (NSIS installer) |
| Linux | `.deb` |

从 [GitHub Releases](https://github.com/issawork7877/jianying-projection/releases) 下载最新安装包。

## International vs Domestic / 国际版与国内版

**This repository is the international version.** It includes only public domain content:

| Content | International (this repo) | Domestic (separate distribution) |
|---------|--------------------------|----------------------------------|
| Bible | KJV (public domain) | CUV Simplified + Traditional, NIV |
| Hymns | 5 public domain hymns | 61,344 hymns |
| Data | Import via `.jydata` | Built-in |

The domestic version with full Chinese content is distributed separately. This repository contains no copyrighted Bible translations or song lyrics.

**本仓库是国际版**，仅包含公共领域内容。国内版（含和合本圣经和完整诗歌库）另行分发。

## Adding Bible & Song Data / 添加数据

Use `.jydata` data pack files to import additional Bibles and song libraries:

1. Open the app → Settings → Data Packs
2. Import a `.jydata` file
3. Build custom packs: `node scripts/build-data-pack.js`

通过 `.jydata` 数据包文件导入更多圣经版本和诗歌库。

## Development / 开发

### Prerequisites

- Node.js 20+
- npm 9+

### Scripts

```bash
npm install              # Install dependencies
npm run electron:dev     # Start dev mode (Vite + Electron)
npm run lint             # Run ESLint
npm run build            # Vite production build

# International build (public domain content)
npm run electron:build:intl:mac
npm run electron:build:intl:win
npm run electron:build:intl:linux
```

## Project Structure / 项目结构

```
jiayan-projection/
├── electron/          # Electron main process
│   └── main.js
├── src/
│   ├── components/    # React components
│   ├── data/          # Bible data, songs, i18n, loader
│   ├── pages/         # Page-level components
│   ├── utils/         # Utility functions
│   ├── App.jsx        # Root component (router)
│   └── main.jsx       # Renderer entry point
├── scripts/           # Build scripts
│   ├── build-data-pack.js
│   ├── prebuild-intl.js
│   └── postbuild-intl.js
├── public/
│   └── backgrounds/   # Default background images
├── build/             # App icon assets
├── preload.js         # Electron preload script
└── package.json
```

## Keyboard Shortcuts / 快捷键

| Key / 键 | Action / 功能 |
|-----------|--------------|
| `Space` | Next slide/verse / 下一页 |
| `↑` `↓` | Navigate up/down / 上下选择 |
| `Enter` | Confirm/Apply / 确认 |
| `Esc` | Cancel/Stop / 取消 |
| `?` | Show help / 帮助 |

## Design Philosophy / 设计理念

- Pure black/white/gray palette / 纯黑白灰
- No rounded corners / 无圆角
- No shadows / 无阴影
- Function over decoration / 功能优先

## Contributing / 贡献

See [CONTRIBUTING.md](CONTRIBUTING.md). Pull requests welcome.

## Security / 安全

See [SECURITY.md](SECURITY.md) for known limitations and vulnerability reporting.

## License / 许可证

[MIT](LICENSE) — Copyright (c) 2026 简影投屏 (JianYing Projection)

---

## Support / 支持

If you find this app useful, consider supporting its development:

- 爱发电 (Afdian): [ifdian.net/a/issawork7877](https://ifdian.net/a/issawork7877)
- [GitHub Sponsors](https://github.com/sponsors/issawork7877)

如果你觉得这个软件对你有帮助，欢迎通过以下方式支持开发：

- 爱发电: [ifdian.net/a/issawork7877](https://ifdian.net/a/issawork7877)
- [GitHub Sponsors](https://github.com/sponsors/issawork7877)
