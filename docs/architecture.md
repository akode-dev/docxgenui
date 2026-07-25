# Architecture

## Goals

DocxGen UI provides a small, fast, cross-platform desktop experience while
reusing the tested .NET document engine. The application is local-first,
offline by default, and does not require Microsoft Office.

## Components

```text
React + TypeScript
  └─ invokes one typed Tauri command
       └─ Rust/Cargo desktop shell
            └─ starts a bundled .NET 10 sidecar for one operation
                 └─ Akode.DocxGen 2.1.1
                      └─ reads/writes Markdown, JSON, DOCX, and image assets
```

### Frontend (`src`)

The frontend owns navigation, file selection, options, progress, diagnostics,
and results. It cannot execute arbitrary commands. Native file dialogs use the
official Tauri dialog plugin.

### Native shell (`src-tauri`)

Tauri owns the application window, bundle metadata, capabilities, and the
sidecar boundary. A single command, `run_backend`, accepts only five explicit
operations: `health`, `inspect`, `convert`, `render`, and `extract`.

The request is serialized as JSON, encoded with Base64URL, and sent as one
process argument to avoid shell parsing. Tauri launches a fixed bundled binary
name; the frontend cannot supply a program or arbitrary arguments.

### Backend (`backend`)

The .NET backend is a short-lived, self-contained console application. It
deserializes the request, calls `Akode.DocxGen`, writes output atomically, and
returns one JSON response. One process per operation provides simple
cancellation, cleanup, and crash isolation without a localhost server.

The backend supports:

- quick Markdown-to-DOCX conversion with an optional style reference;
- placeholder-template rendering with Markdown and an optional JSON model;
- deterministic template inspection;
- semantic DOCX-to-Markdown extraction with embedded image assets.

## Security and privacy

- All conversion is local; no telemetry or document upload exists.
- Tauri uses a restrictive content-security policy.
- The UI has only open/save dialog permissions.
- The Rust bridge uses an operation allow-list and a fixed sidecar.
- Remote images and raw HTML remain disabled in the document engine.
- Existing files are protected unless overwrite is explicitly selected.
- User-facing failures report paths and diagnostics, not document contents.

## Packaging

`eng/prepare-sidecar.mjs` maps each Rust target triple to the matching .NET
runtime identifier and publishes the backend as a self-contained single file.
Tauri embeds that architecture-specific binary and produces native installers.

GitHub Actions creates Windows, macOS, and Linux release assets from a version
tag. The lock files make all three dependency graphs reproducible.

## Deliberate non-goals

- pixel-perfect DOCX-to-Markdown-to-DOCX layout round trips;
- editing DOCX content inside the application;
- cloud storage integrations;
- arbitrary executable or plugin execution;
- automatic remote template downloads.
