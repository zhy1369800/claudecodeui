# Repository Guidelines

## Project Structure & Module Organization
- `src/`: React frontend (UI components, contexts, hooks, i18n, utilities).
- `server/`: Node/Express backend, WebSocket handling, route modules, middleware, and DB bootstrap.
- `shared/`: constants shared between client and server.
- `public/`: static assets (icons, PWA files, screenshots, docs pages).
- `dist/`: Vite build output (generated).
- Root config files: `vite.config.js`, `tailwind.config.js`, `tsconfig.json`, `.env.example`.

## Build, Test, and Development Commands
- `npm run dev`: starts backend (`server/index.js`) and Vite client together.
- `npm run server`: runs backend only on `PORT` (default `3001`).
- `npm run client`: runs Vite dev server (default `VITE_PORT` or `5173`).
- `npm run build`: creates production frontend bundle in `dist/`.
- `npm run start`: builds frontend, then starts backend for production-style run.
- `npm run preview`: previews built frontend locally.
- `npm run typecheck`: runs strict TypeScript checks (`tsc --noEmit`).

## Coding Style & Naming Conventions
- Use ES modules and single quotes; match existing semicolon usage per file.
- Frontend components use `PascalCase` filenames (for example `ChatInterface.jsx`).
- Hooks use `useXxx` naming (for example `useVersionCheck.js`).
- Keep route handlers grouped by domain in `server/routes/`.
- Prefer small, focused modules; place shared constants in `shared/`.

## Testing Guidelines
- No dedicated test suite is currently checked in.
- Minimum pre-PR validation:
  - `npm run typecheck`
  - `npm run build`
  - manual smoke test of key flows (chat, project list, shell, auth/settings)
- When adding tests, place frontend tests near source (`src/**`) and backend tests near server modules (`server/**`) using `*.test.*` naming.

## Commit & Pull Request Guidelines
- Prefer Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`); keep subject imperative and concise.
- One logical change per commit; include scope when useful (for example `fix(chat): ...`).
- PRs should include:
  - clear summary and motivation
  - linked issue(s) when applicable
  - screenshots/GIFs for UI changes
  - notes on config/env impacts and manual test steps

## Security & Configuration Tips
- Copy `.env.example` to `.env` and avoid committing secrets.
- Treat tool/agent permissions conservatively; enable only what is needed.
- Validate filesystem and command-related changes carefully in `server/routes/` and `server/utils/`.
