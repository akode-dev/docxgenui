# Release process

DocxGen UI uses semantic versions. The version must match in:

- `package.json`;
- `src-tauri/Cargo.toml`;
- `src-tauri/tauri.conf.json`;
- `Directory.Build.props`.

## Before tagging

1. Update `CHANGELOG.md`.
2. Run every command in `docs/development.md`.
3. Build and smoke-test a local installer.
4. Merge the release commit into `main`.
5. Confirm `develop` contains the same release commit.

## Publish

Create and push an annotated tag:

```powershell
git tag -a v0.1.0 -m "DocxGen UI v0.1.0"
git push origin v0.1.0
```

`.github/workflows/release.yml` builds native bundles and publishes them to one
GitHub release. Public releases are intentionally tag-driven; ordinary commits
never publish installers.

## Current signing status

Version 0.1.0 is unsigned. Production code signing requires:

- a Windows Authenticode certificate;
- Apple Developer ID Application signing and notarization credentials;
- secure GitHub environments/secrets and documented rotation.

Do not commit signing material. Until signing is configured, release notes and
the README must say that operating systems can show an unverified-publisher
warning.
