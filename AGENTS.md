# DocxGen UI agent instructions

These instructions apply to the entire repository.

## Start here

1. Read `README.md`.
2. Read `docs/architecture.md` and `docs/development.md`.
3. Inspect the working tree before editing and preserve unrelated changes.

## Architecture boundaries

- `backend/DocxGen.Ui.Backend` owns document operations and is the only project
  that may reference `Akode.DocxGen`.
- `src-tauri` owns native lifecycle, the strict command allow-list, and sidecar
  invocation. It must not implement document conversion.
- `src` owns presentation and user interaction. It must not read documents
  directly or invoke arbitrary processes.
- Keep the backend protocol small, versionable, JSON-based, and free of document
  contents in error messages.
- Documents remain local. Do not add telemetry, remote processing, remote
  images, or raw HTML without an explicit product and security decision.

## Required verification

Run from the repository root:

```powershell
dotnet restore DocxGen.Ui.slnx --locked-mode
dotnet build DocxGen.Ui.slnx --configuration Release --no-restore
dotnet test DocxGen.Ui.slnx --configuration Release --no-build
npm ci
npm run lint
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --manifest-path src-tauri/Cargo.toml --locked
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

For packaging changes, also run `npm run desktop:build` on a supported host and
inspect the generated bundle.

## Engineering rules

- Backend: .NET 10, C# 14, nullable enabled, warnings as errors, asynchronous
  file I/O, cancellation tokens, and centrally pinned package versions.
- Backend tests use xUnit v3 and Shouldly.
- Frontend: strict TypeScript, accessible semantic controls, no remote runtime
  dependencies, and no Node APIs in browser code.
- Rust: keep the native surface minimal, formatted, Clippy-friendly, and free
  from `unsafe` code.
- Commit `package-lock.json`, `Cargo.lock`, and NuGet `packages.lock.json`.
- Do not edit generated Tauri icons by hand; regenerate them from
  `assets/app-icon.svg`.

## Git and handoff

- `main` is stable and releasable; `develop` is the integration branch.
- Use `feature/<name>` or `fix/<name>` from `develop`.
- Do not push, rewrite history, or create releases unless the user asks.
- Report changed behavior, verification actually run, remaining assumptions,
  current branch, and commit state.
