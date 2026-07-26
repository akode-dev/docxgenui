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
                 └─ Akode.DocxGen 2.1.3
                      └─ reads/writes Markdown, JSON, DOCX, and image assets
```

### Frontend (`src`)

The frontend owns navigation, file selection, options, progress, diagnostics,
and results. It cannot execute arbitrary commands. Native file dialogs use the
official Tauri dialog plugin.

### Native shell (`src-tauri`)

Tauri owns the application window, bundle metadata, capabilities, and the
sidecar boundary. A single command, `run_backend`, accepts only seven explicit
operations: `health`, `inspect`, `convert`, `render`, `preflight`, `scaffold`,
and `extract`.

The request is serialized as JSON, encoded with Base64URL, and sent as one
process argument to avoid shell parsing. Tauri launches a fixed bundled binary
name; the frontend cannot supply a program or arbitrary arguments.

The shell also writes a bounded local JSON-lines diagnostic log. Entries
contain only the operation, timing, success state, error code, and diagnostic
codes. Requests, document contents, names, paths, and backend messages are
never logged. The UI can open the resolved platform log directory through a
fixed native command.

### Backend (`backend`)

The .NET backend is a short-lived, self-contained console application. It
deserializes the request, calls `Akode.DocxGen`, writes output atomically, and
returns one JSON response. One process per operation provides simple
cancellation, cleanup, and crash isolation without a localhost server.

The backend supports:

- quick Markdown-to-DOCX conversion with an optional style reference;
- placeholder-template rendering with Markdown and an optional JSON model;
- dry-run validation of selected template inputs before rendering;
- editable JSON model scaffolding from template placeholders;
- lenient optional-field rendering or explicit strict placeholder enforcement;
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
- Rotating operational logs omit document data and retain at most two files of
  no more than about 1 MB each.

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
