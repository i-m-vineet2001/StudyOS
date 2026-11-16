# StudyOS

A fast, glassmorphic study tracker and exam preparation workspace built with React, TypeScript, Tailwind CSS v4, and Express. Designed for deep focus sessions, high-precision timing, visual analytics, local-first study notes & PDF storage, and AI-powered concept/vocabulary assistance.

---

## Key Features

### 1. Universal Timer & Subject Sub-Timers
- **Universal Study Timer**: Tracks cumulative daily study time across all subjects and general stopwatch sessions with live sub-second (`.000`) precision.
- **Per-Subject Countdown & Stopwatch**: Switch each subject independently between a countdown block and a count-up stopwatch.
- **Banking Exam Preset & Custom Topics**: Preloaded with *Quantitative Aptitude*, *Reasoning Ability*, *English Language*, and *General & Banking Awareness*—each with selectable, editable topic lists.
- **Session Tags**: Tag sessions (`Concept`, `Practice`, `Mock Test`, `Revision`, `PYQs`, `Vocabulary`, or custom tags) for richer history and analytics breakdowns.

### 2. Circular Focus Mode
- Distraction-free full-screen study view with one-tap **Play / Pause** (`Space` shortcut) and **Exit** (`Esc`).
- **Stopwatch** and **Countdown** mode switcher with an animated circular SVG progress ring and configurable **Glow Effect Intensity** (`0%–100%`).

### 3. Power BI-Style Analytics Dashboard
- Clean Bento grid layout with **1D / 1W / 1M** timeframe switching and interactive **Subject Cross-Filtering** (click any donut slice, subject bar, or slicer dropdown to filter all tiles).
- **4-Tile KPI Strip**: Total Studied, Goal Progress bar, Study Streak, and Session count/average.
- **Heat Bar Graph**: 5-tier thermal intensity bar chart with a dashed daily target line and hover/tap inspection.
- **Compact Consistency Heatmap**: Hourly (24h), Time-of-Day (7D), and Calendar (30D) intensity matrices.
- **Focus Matrix**: Tabular breakdown switching between top **Topics** and **Session Tags**.

### 4. Library: Notes, Reminders & Local PDF Vault
- **Subject & Topic Notes / Reminders**: Pin important formulas, rules, or exam reminders with optional due dates and completion checkboxes.
- **IndexedDB PDF Vault**: Upload, preview in-app, download, and manage study PDFs locally with zero cloud storage cost.

### 5. AI Study Assistant (`Ask StudyOS AI`)
- Server-side proxy (`POST /api/ai/ask`) powered by `@google/genai` (`GEMINI_API_KEY` stays strictly on the backend).
- Context-aware explanations for English vocabulary (meaning, part of speech, synonyms/antonyms, example sentence), Quantitative shortcuts, Reasoning concepts, and Banking Awareness—with one-click **Save to Notes**.

### 6. Personalization & Themes
- Personalized workspace greeting (`"Hi, <Your Name>"`).
- **Collapsible Circular Quick Controls**: Expandable circular button for **Color Themes** (*Sapphire*, *Lime & Black*, *Emerald*, *Indigo*, *Amber*, *Rose*), **Completion Chime**, and **Light / Dark Mode**.
- Full **Settings Modal** with adjustable **Glow Intensity** slider and daily goal minutes.
- **Portable JSON Backup**: Export and restore all subjects, sessions, notes, and preferences via `History → Export JSON / Import JSON`.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons
- **Backend**: Node.js (v22+), Express 4, `@google/genai`
- **Persistence**: Browser `localStorage` (timers, sessions, notes, settings) + `IndexedDB` (PDF binaries)

---

## Project Structure

```text
├── server.ts                  # Express server (serves /api/ai/ask + Vite dev / dist prod)
├── index.html                 # Entry HTML + pre-paint theme initialization
├── src/
│   ├── App.tsx                # Root layout, navigation, Focus Mode, Settings & AI modals
│   ├── index.css              # Tailwind v4 & Apple glassmorphic / Lime & Black styles
│   ├── types/study.ts         # TypeScript interfaces for subjects, sessions, notes, settings
│   ├── hooks/
│   │   ├── useStudyTracker.ts # Core timer engine, local persistence & CSS theme variables
│   │   └── useLiveSubMs.ts    # 60fps sub-second clock interpolation hook
│   ├── utils/
│   │   ├── storage.ts         # localStorage schema, Banking preset & sample history generator
│   │   ├── pdfVault.ts        # IndexedDB storage helpers for PDF files
│   │   ├── themes.ts          # Multi-color theme definitions
│   │   ├── sound.ts           # Web Audio API completion chime
│   │   └── time.ts            # Duration & local date formatting helpers
│   └── components/
│       ├── Header.tsx
│       ├── TimerWorkspace.tsx
│       ├── FocusMode.tsx
│       ├── DashboardView.tsx
│       ├── LibraryView.tsx
│       ├── HistoryBackupView.tsx
│       ├── SubjectModal.tsx
│       ├── SettingsModal.tsx
│       ├── AiAssistantModal.tsx
│       └── PreciseClock.tsx
```

---

## Local Development

### Prerequisites
- **Node.js 22+** (required for `node server.ts` native TypeScript execution in production, or use `npm run dev` with `tsx`)
- **npm**

### Setup
1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd <your-repo-folder>
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory based on `.env.example`:
   ```env
   GEMINI_API_KEY="your_gemini_api_key_here"
   ```
   > `GEMINI_API_KEY` is optional if you only use local timers, dashboard, notes, and PDF storage, and required for **Ask StudyOS AI**.

4. **Start the development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Script | Description |
| :--- | :--- |
| `npm run dev` | Starts `server.ts` via `tsx` with Express + Vite middleware on port `3000` |
| `npm run build` | Builds the production frontend bundle into `dist/` |
| `npm start` | Starts the production server (`node server.ts`) serving `dist/` and `/api/ai/ask` |
| `npm run lint` | Runs TypeScript type checking (`tsc --noEmit`) |
| `npm run clean` | Removes `dist/` |

---

## Deploying for Free (Render Web Service)

Because StudyOS includes an Express API route (`/api/ai/ask`) to keep your Gemini API key secure on the server, deploying as a Node **Web Service** on [Render](https://render.com) runs both the frontend and backend together on the free tier:

1. Push your repository to GitHub.
2. On Render, create a new **Web Service** and connect your GitHub repo.
3. Configure the build and start commands:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start` *(or `npx tsx server.ts` if using Node < 22)*
4. Add environment variables in Render:
   - `NODE_ENV` = `production`
   - `GEMINI_API_KEY` = `your_gemini_api_key`
5. Deploy and open your live HTTPS URL on desktop or mobile (you can use **Add to Home Screen** on Android Chrome / Samsung Internet or **Add to Dock** on macOS Safari for an app-like experience).

---

## License

Apache-2.0
