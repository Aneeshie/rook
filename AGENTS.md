# Repository Guidelines

## Project Structure & Module Organization

This repository is a desktop terminal app built with Tauri, React, and TypeScript. The frontend lives in `src/`: `App.tsx` and `App.css` provide the app shell, while `components/TerminalTab.tsx` and `components/TerminalView.tsx` handle terminal UI. Static frontend files are in `public/`; bundled assets are in `src/assets/`. The Rust/Tauri backend is in `src-tauri/src/`: `commands.rs` exposes Tauri commands, `session.rs` manages sessions, and `pty.rs` handles pseudo-terminal I/O. Tauri configuration, capabilities, and platform icons are under `src-tauri/`.

## Build, Test, and Development Commands

- `bun install` installs the JavaScript dependencies recorded in `bun.lock`.
- `bun run dev` starts the Vite frontend development server.
- `bun run build` runs the TypeScript compiler, then creates the production frontend bundle.
- `bun run preview` serves the built frontend locally for inspection.
- `bun run tauri dev` launches the complete desktop app with the Rust backend; `bun run tauri build` packages it.
- `cargo check --manifest-path src-tauri/Cargo.toml` checks the Rust backend.

Run desktop commands with the Tauri prerequisites for your platform installed. `bun run test` type-checks and runs the frontend tests (`bun test`, files named `*.test.ts` next to the code) and the Rust tests (`cargo test`, `#[cfg(test)]` modules in each file).

## Coding Style & Naming Conventions

Follow the existing TypeScript/React style: two-space indentation, semicolons, single quotes, and PascalCase for React components and files (for example, `TerminalView.tsx`). Use camelCase for functions, variables, and props. In Rust, use standard `rustfmt` formatting, snake_case for modules and functions, and descriptive types. Keep frontend/backend command names and serialized payload fields aligned when changing the Tauri interface.

## Testing Guidelines

Before submitting changes, run `bun run build` and `bun run test`; CI runs both on every pull request. For UI changes, also launch `bun run tauri dev` and manually check terminal creation, input/output, resizing, and session updates as applicable. Add focused automated tests when introducing logic that can be exercised independently; keep such logic in pure functions (like `src/layout/paneTree.ts`) so it can be.

## Commit & Pull Request Guidelines

Recent history uses short, imperative Conventional Commit-style subjects, such as `feat: add dynamic font resizing` and `chore: refactor code`. Follow `feat:`, `fix:`, or `chore:` with a concise summary. Pull requests should describe the user-visible change, list validation commands and results, link related issues when available, and include screenshots for visual changes.

## Security & Configuration Tips

Keep secrets and machine-specific configuration out of the repository. Review Tauri command exposure and `src-tauri/capabilities/default.json` whenever adding backend capabilities or granting frontend access.
