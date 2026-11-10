> **This is the original README of Manga Editor Desu!** DESU-X (this repository) is a modified version. See [README.md](README.md) and [CHANGES_DESU-X.md](CHANGES_DESU-X.md).

English |
[日本語](https://github.com/new-sankaku/manga-editor-desu/blob/main/README_JP.md) |
[中文](https://github.com/new-sankaku/manga-editor-desu/blob/main/README_CN.md)

# Manga Editor Desu! Pro Edition

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![GitHub Stars](https://img.shields.io/github/stars/new-sankaku/manga-editor-desu?style=social)](https://github.com/new-sankaku/manga-editor-desu)

A web-based manga creation tool with AI image generation support. Create professional manga pages directly in your browser.

**[Try the Demo](https://new-sankaku.github.io/manga-editor-desu/)** - No installation required!

<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/01_mainpage.webp" width="700">

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Requirements](#requirements)
- [AI Image Generation Setup](#ai-image-generation-setup)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Gallery](#gallery)
- [FAQ](#faq)
- [Support](#support)
- [License](#license)

---

## Features

### Core Features
- **Panel Layouts** - 69 pre-built templates (41 portrait, 28 landscape), knife tool splitting, vertex editing and random cut
- **Multi-Page Projects** - Page thumbnail bar with click-to-switch and drag-to-reorder
- **Speech Bubbles** - 48 styles with customizable colors and transparency, plus freehand custom bubbles
- **Text Tools** - Vertical (tategaki) and horizontal text, 156 bundled fonts in 4 categories, plus 31 decorative image-text styles
- **Layer Management** - Organize images, text, and panels with familiar layer controls
- **Undo/Redo** - No step limit within a page (history is per page and clears on page switch)

### Image Editing
- **Auto-Fit** - Images automatically scale and trim to fit panels
- **Adjustments** - Rotation, position, scale, skew, opacity, flip horizontal/vertical, crop
- **Monochrome Conversion** - 6 one-click presets, applicable to one image, one page, or the whole project
- **Filters** - 15 filters including unsharp mask, zoom blur, dot screen, hex pixelate, ink, vibrance, hue/saturation
- **Blend Modes** - 25 Photoshop-style blend modes
- **Screen Tones** - 5 generators: halftone, noise, snow, speed lines, focus lines

### AI Integration
AI generation is optional — every editing feature works without it. You supply and configure the backend.

- **Text2Image / Image2Image** - Generate or transform images directly in panels
- **Inpaint** - Paint a mask and regenerate just that area (ComfyUI only)
- **Angle Generate** - Regenerate an image from a new camera angle (ComfyUI only)
- **Upscale / Remove Background** - Post-processing on generated or imported images
- **LLM features** - Story to per-panel prompts, image to prompt
- **Prompt Queue** - Batch generate across panels and pages, with per-service concurrency
- **Supported Backends (6):**
  - ComfyUI — local (SD1.5, SDXL, Flux, Z-Image-turbo, Qwen-Image, custom workflows)
  - RunPod ComfyUI — the same, running on your RunPod pod
  - SD WebUI — A1111 and Forge (SD1.5, SDXL, Pony, Flux1)
  - Fal.ai — cloud, API key
  - Grok (xAI) — cloud, language model tasks
  - Ollama — local, language model tasks

Each task type is routed independently, so image generation and dialogue translation can use different services. See the [AI backend setup guide](https://new-sankaku.github.io/manga-editor-desu/html/docs/ai-setup.html).

### Export & Save
- **Project Save/Load** - Saves as a single `.lz4` archive (`DESU-Project.lz4`); loading accepts `.lz4` and `.zip`
- **Settings Save/Load** - Preserve your workflow preferences
- **Auto Save** - Saves to the browser every 10–600 seconds, with recovery on next launch
- **Image Export** - PNG at a resolution derived from page size in mm × DPI (default 300), or SVG

### Supported Languages
English, Japanese, Korean, French, Chinese, Russian, Spanish, German (8 languages)

<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/02_trans.webp" height="300">

---

## Quick Start

### Option 1: Use Online (Recommended)
Visit **[https://new-sankaku.github.io/manga-editor-desu/](https://new-sankaku.github.io/manga-editor-desu/)**

No setup required. Works with all features including AI generation when connected to a local backend.

### Option 2: Run Locally
```bash
git clone https://github.com/new-sankaku/manga-editor-desu.git
cd manga-editor-desu
start index.html
```

---

## Requirements

### Browser Support
- Chrome (Recommended)
- Firefox
- Edge
- Safari

### For AI Image Generation (Optional)
One of the following:
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI)
- [Stable Diffusion WebUI (A1111)](https://github.com/AUTOMATIC1111/stable-diffusion-webui)
- [Forge](https://github.com/lllyasviel/stable-diffusion-webui-forge)

---

## AI Image Generation Setup

### ComfyUI Setup

1. Start ComfyUI with API access enabled:
   ```bash
   python main.py --listen --enable-cors-header
   ```

2. In Manga Editor, click the **Settings** icon
3. Select **ComfyUI** as the backend
4. Enter the API URL (default: `http://127.0.0.1:8188`)
5. Click **Connect**

### A1111 WebUI / Forge Setup

1. Start WebUI with API access:
   ```bash
   ./webui.sh --api --cors-allow-origins=*
   ```
   Or add to `webui-user.bat`:
   ```
   set COMMANDLINE_ARGS=--api --cors-allow-origins=*
   ```

2. In Manga Editor, click the **Settings** icon
3. Select **WebUI** or **Forge** as the backend
4. Enter the API URL (default: `http://127.0.0.1:7860`)
5. Click **Connect**

---

## Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|---------------|-----|
| New Page | `Alt + N` | `Alt + N` |
| Previous Page | `Alt + Left` | `Alt + Left` |
| Next Page | `Alt + Right` | `Alt + Right` |
| Undo | `Ctrl + Z` | `Cmd + Z` |
| Redo | `Ctrl + Y` | `Cmd + Y` |
| Copy | `Ctrl + C` | `Cmd + C` |
| Paste | `Ctrl + V` | `Cmd + V` |
| Delete | `Delete` / `Backspace` | `Delete` / `Backspace` |
| Save Project | `Ctrl + S` | `Cmd + S` |
| Load Project | `Ctrl + O` | `Cmd + O` |
| Image Download | `Ctrl + D` | `Cmd + D` |
| Save Settings | `Ctrl + Shift + S` | `Cmd + Shift + S` |
| Toggle Grid | `Ctrl + G` | `Ctrl + G` |
| Toggle Layers Panel | `Ctrl + L` | `Ctrl + L` |
| Toggle Controls | `Ctrl + K` | `Ctrl + K` |
| Zoom In | `Ctrl + 8` | `Ctrl + 8` |
| Zoom Out | `Ctrl + 9` | `Ctrl + 9` |
| Zoom Fit | `Ctrl + 0` | `Ctrl + 0` |
| Move Object | `Arrow Keys` | `Arrow Keys` |
| Move Object (Fast) | `Shift + Arrow Keys` | `Shift + Arrow Keys` |
| Layer Up | `Ctrl + Up` | `Cmd + Up` |
| Layer Down | `Ctrl + Down` | `Cmd + Down` |
| Toggle Page Bar | `Ctrl + B` | `Ctrl + B` |
| Show Prompts | `Ctrl + P` | `Cmd + P` |
| Deselect / Clear Mode | `Escape` | `Escape` |
| Shortcut List | `F1` | `F1` |
| Complete Crop | `Enter` | `Enter` |

Arrow-key movement snaps to the grid spacing when the grid is on, moves 1 px otherwise, and accelerates on a long press. Shortcuts are suppressed while a text field has focus.

---

## Gallery

### Image Drop
https://github.com/user-attachments/assets/7cf94e6c-fc39-4aed-a0a1-37ca70260fe4

### Speech Bubbles
https://github.com/user-attachments/assets/6f1dae5f-b50f-4b04-8875-f0b07111f2ab

### Prompt Helper
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/03_prompthelper.webp" width="700">

### Grid & Knife Mode
<div style="display: flex; gap: 10px;">
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/05_gridline.webp" height="300">
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/06_knifemode.webp" height="300">
</div>

### Dark Mode
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/09_darkmode.webp" height="300">

### Blend Modes
<div style="display: flex; gap: 10px;">
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/12_blend.webp" height="300">
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/13_blend.webp" height="300">
</div>

### Effects
<div style="display: flex; gap: 10px;">
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/04_gpix01.webp" height="300">
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/04_gpix02.webp" height="300">
</div>

### Text & Speech Bubbles
<div style="display: flex; gap: 10px;">
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/08_speechbubble.webp" height="300">
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/07_font.webp" height="300">
</div>

---

## FAQ

### Q: Can I use this without AI image generation?
**A:** Yes! All editing features work standalone. AI generation is optional and requires a separate backend (ComfyUI/WebUI/Forge).

### Q: Why won't my AI backend connect?
**A:** Common solutions:
1. Ensure CORS headers are enabled (`--cors-allow-origins=*` or `--enable-cors-header`)
2. Check the API URL is correct
3. Verify the backend is running
4. Try using `http://127.0.0.1` instead of `localhost`

### Q: Can I use custom ComfyUI workflows?
**A:** Yes! You can import and use your own ComfyUI workflows.

### Q: Where are my projects saved?
**A:** Project Save downloads a single LZ4 archive named `DESU-Project.lz4` to your computer. Loading accepts both `.lz4` and `.zip`. Projects are never uploaded.

### Q: What data is stored in my browser?
**A:** In localStorage:
- Interface language and UI settings
- API connection settings, including API keys for cloud services
- Custom prompt presets
- Tutorial completion status

In IndexedDB:
- Imported ComfyUI workflows
- Uploaded fonts
- Auto-saved projects
- Usage statistics and estimated API cost records

**API keys are stored unencrypted.** Avoid entering them on a shared computer.

### Q: How do I clear saved settings?
**A:** Open browser DevTools (F12) → Application tab → Local Storage → Clear the site data. Or use your browser's "Clear site data" feature.

### Q: Is my data sent anywhere?
**A:** The editor has no server of its own, and your projects are never uploaded by the application. Two things do leave your machine:

1. **Analytics.** The hosted site uses Google Analytics, so page views and interface interactions are recorded.
2. **Cloud AI services.** If you configure RunPod, Fal.ai or Grok, the prompts, story or dialogue text and panel images for those requests are sent to that service. Using only ComfyUI, SD WebUI or Ollama on your own machine keeps generation local.

Page loads also fetch assets from Google Fonts, cdnjs and unpkg.

### Q: Where can I read more?
**A:** [Feature reference](https://new-sankaku.github.io/manga-editor-desu/html/docs/features.html) ([日本語](https://new-sankaku.github.io/manga-editor-desu/html/docs/features-ja.html)) · [FAQ](https://new-sankaku.github.io/manga-editor-desu/html/docs/faq.html) ([日本語](https://new-sankaku.github.io/manga-editor-desu/html/docs/faq-ja.html)) · [AI backend setup](https://new-sankaku.github.io/manga-editor-desu/html/docs/ai-setup.html) ([日本語](https://new-sankaku.github.io/manga-editor-desu/html/docs/ai-setup-ja.html))

---

## Support

- **Bug Reports & Feature Requests:** [GitHub Issues](https://github.com/new-sankaku/manga-editor-desu/issues)
- **Chat:** [Discord](https://discord.gg/XCp7dyHj3N)
- **Contributing:** See [CONTRIBUTING.md](CONTRIBUTING.md)
- **Documentation:** [Feature reference](https://new-sankaku.github.io/manga-editor-desu/html/docs/features.html) · [FAQ](https://new-sankaku.github.io/manga-editor-desu/html/docs/faq.html) · [AI backend setup](https://new-sankaku.github.io/manga-editor-desu/html/docs/ai-setup.html)

---

## License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

---

Made with love for manga creators worldwide.
