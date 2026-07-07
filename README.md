# FicWriter

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![Tauri](https://img.shields.io/badge/Tauri-FFC131?logo=tauri&logoColor=white)](https://tauri.app/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![License](https://img.shields.io/badge/license-custom-lightgrey)](./LICENSE)
[![Status](https://img.shields.io/badge/status-active%20prototype-2ea44f)](#)

FicWriter is a desktop writing workspace for fiction authors who want one place for drafting, project organization, visual planning, notes, and inspiration boards. The project combines a `React + TypeScript` frontend with a `Tauri` desktop shell for a focused local-first writing experience.

## Short Description

This project explores how a writing tool can feel more like a creative studio than a plain text editor. FicWriter brings chapters, notes, wallpapers, and interactive planning boards into a single desktop app designed around long-form fiction workflows.

## Project Goals

FicWriter is built to support writers who need more than a blank page. The product goal is to give authors a structured but aesthetically flexible environment for managing projects, writing chapters, collecting notes, and shaping ideas visually while staying inside one app.

## Why This Project Matters

This repository reflects product thinking, not only implementation detail:

- it treats writing as a workflow that includes planning, drafting, reference material, and visual context
- it keeps the app local-first through a desktop architecture instead of assuming cloud-first collaboration
- it blends text editing with project structure and board-style ideation rather than isolating each workflow in separate tools
- it focuses on atmosphere and personalization, which matters for creative tools where environment affects usability

## Key Features

- Local desktop app powered by `Tauri`
- Project library for organizing multiple writing projects
- Chapter-based writing flow with a rich text editor
- Separate notes space for quick idea capture and reference writing
- Interactive planning board built with `tldraw`
- Visual wallpaper system for mood-setting and personalization
- Local file handling and desktop-native dialogs through Tauri plugins
- Error logging path for easier debugging and user support

## Tech Stack

- Frontend: `React 18`, `TypeScript`, `Vite`
- Desktop shell: `Tauri 2`
- Editor stack: `Tiptap`
- Visual planning board: `tldraw`
- File/document utilities: `@tauri-apps/*` plugins, `mammoth`
- Native layer: `Rust`

## Screenshots

Add real screenshots to these placeholder paths:

```text
docs/screenshots/library-screen.png
docs/screenshots/editor-screen.png
docs/screenshots/notebook-screen.png
docs/screenshots/board-screen.png
docs/screenshots/wallpapers-screen.png
```

## Demo GIF

Add a short app walkthrough here when ready:

```text
docs/demo/ficwriter-demo.gif
```

## Installation

### Prerequisites

- `Node.js 20+`
- `npm 10+`
- `Rust`
- `Tauri 2` system prerequisites

Tauri setup guide:
[https://tauri.app/start/prerequisites/](https://tauri.app/start/prerequisites/)

### Windows Setup

```powershell
git clone https://github.com/viktorelf/FicWriter.git
cd FicWriter
cd ficwriter
npm install
```

## Usage

### Run The Frontend In Browser Mode

```powershell
npm run dev
```

### Run The Desktop App

```powershell
npm run tauri dev
```

### Production Build

```powershell
npm run build
```

### Available Scripts

```bash
npm run dev
npm run build
npm run preview
npm run tauri
```

## Folder Structure

```text
ficwriter/
|- public/
|- src/
|  |- board/
|  |- components/
|  |- editor/
|  |- layouts/
|  |- mindmap/
|  |- screens/
|  |- store/
|  `- utils/
|- src-tauri/
|  |- capabilities/
|  |- icons/
|  `- src/
|- docs/
|  |- demo/
|  `- screenshots/
|- package.json
`- README.md
```

## Architecture Notes

- `src/` contains the React application, route structure, writing screens, local stores, and UI logic.
- `src-tauri/` contains the desktop wrapper, native configuration, and Rust entrypoints.
- The writing editor and note flows are handled in the frontend, while desktop integration is delegated to Tauri plugins and the Rust shell.
- The app is designed around local project state and native desktop behavior rather than a backend service.

## Error Logs

If the app misbehaves, the main log file on Windows is:

```text
C:\Users\<YourUser>\AppData\Local\com.admin.ficwriter\logs\FicWriter.log
```

If the file is missing:

1. Launch the app.
2. Reproduce the issue.
3. Close the app.
4. Check the path again.

## Future Improvements

- Add export/import flows for complete writing projects
- Improve document structure tools for scenes, outlines, and metadata
- Add autosave status visibility across more parts of the app
- Expand board and note linking between planning and chapter writing
- Polish onboarding and first-run empty states
- Add a more professional release and distribution workflow

## Author

- GitHub: [viktorelf](https://github.com/viktorelf)
- Telegram: [@viktorelff](https://t.me/viktorelff)
- Discord: `vouarthefelling`

## License

This repository currently uses the license text in [LICENSE](./LICENSE).
