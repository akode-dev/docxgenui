# Changelog

All notable changes to DocxGen UI are documented here.

## [0.1.3] - 2026-07-26

### Added

- In-app template field guide for scalar, Markdown, image, and collection
  placeholders.
- Optional referenced-files folder for `$mdFile`, `$file`, and local Markdown
  images.
- Explicit template strictness option; intentionally empty optional fields are
  removed by default.

### Changed

- Replaced the promotional hero copy with a direct description of the three
  document workflows.
- Grouped repeated diagnostics by code and added plain-language explanations
  for expected DOCX-to-Markdown semantic warnings.
- Capped active log files before each write, retaining at most about 2 MB.

### Fixed

- Updated the bundled engine to Akode.DocxGen 2.1.3 so task lists render and
  real-world style references with Word numbering cleanup metadata remain
  valid.

## [0.1.2] - 2026-07-25

### Fixed

- Installed `xdg-utils` in Linux release jobs so the ARM64 AppImage bundler
  always has the required `xdg-open` helper.

## [0.1.1] - 2026-07-25

### Fixed

- Updated the bundled engine to Akode.DocxGen 2.1.2 so real-world DOCX files
  with duplicate style or numbering identifiers extract successfully.
- Displayed backend error codes and all diagnostics instead of hiding
  error-severity details.
- Reported native bridge startup failures instead of leaving the engine status
  indefinitely at `Starting engine`.

### Added

- Privacy-safe, rotating local operation logs with **Open logs** actions in the
  footer and error states.
- Visible links to the `akode-dev/docxgen` engine source and the
  `akode-dev/docxgenui` desktop source and issue tracker.

## [0.1.0] - 2026-07-25

### Added

- Local Markdown-to-DOCX conversion with optional Word style reference.
- Placeholder-template rendering with Markdown and JSON data.
- Deterministic template inspection in the UI.
- Semantic DOCX-to-Markdown extraction with embedded image assets.
- Tauri 2 desktop shell and self-contained .NET 10 backend.
- Native Windows, macOS, and Linux packaging workflows.
