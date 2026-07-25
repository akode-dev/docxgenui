# Development guide

## Prerequisites

- .NET SDK 10.0.302 or a compatible feature-band SDK
- Node.js 24 and npm
- Rust 1.88 or later with the target toolchain
- Tauri 2 operating-system prerequisites

On Debian/Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf
```

## Restore and verify

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

## Run the desktop app

```powershell
npm run desktop:dev
```

This first publishes the local .NET sidecar for the current Rust host triple,
then starts Vite and Tauri.

To build an installer:

```powershell
npm run desktop:build
```

Bundles are written beneath `src-tauri/target/release/bundle`.

## Dependency updates

- Pin all .NET package versions in `Directory.Packages.props`, then regenerate
  and review both `packages.lock.json` files.
- Use exact npm versions and commit `package-lock.json`.
- Update Rust dependencies with Cargo and commit `src-tauri/Cargo.lock`.
- Never bypass a lock file in CI or release workflows.

## Backend protocol

The Tauri command sends:

```json
{
  "operation": "convert",
  "payload": {
    "markdownPath": "/documents/guide.md",
    "outputPath": "/documents/guide.docx"
  }
}
```

The .NET executable receives it through
`--request <base64url-json>` and writes exactly one response object to stdout.
Keep stdout machine-readable. The Rust bridge writes privacy-safe operational
metadata to the platform application log directory and deliberately excludes
the request payload, response messages, document names, paths, and contents.

Use **Open logs** in the desktop footer while testing. The current file is
`docxgen-ui.log` and one rotated `docxgen-ui.previous.log` is retained.

## Tests

- Backend tests exercise real DOCX conversion through the public NuGet package.
- Frontend tests cover navigation, guard rails, and response presentation with
  native integrations mocked.
- Rust tests cover the native allow-list and bridge invariants.
- Release builds are the end-to-end packaging check for every supported OS.
