# DocxGen UI

DocxGen UI is a small, local-first desktop application for people who want to
move documents between Markdown and Microsoft Word without learning a command
line.

It converts Markdown into a clean DOCX, can apply the styles from an existing
Word document, can fill a placeholder-based DOCX template, and can extract a
DOCX back into portable Markdown with its embedded images. Files are processed
on the computer: there is no account, web service, Office installation, or
document upload.

## What it does

- **Markdown → Word:** create a standalone DOCX, optionally using another DOCX
  as the style reference.
- **Template → finished document:** select a DOCX containing DocxGen
  placeholders, add Markdown for the body, and optionally add a JSON data model
  for titles, document-control fields, tables, and repeated sections.
- **Word → Markdown:** recover headings, paragraphs, lists, tables, links,
  formatting, and embedded images into an editable Markdown document.
- **Template inspection:** see placeholders and requirements before rendering.
- **Safe by default:** no remote images or raw HTML; existing output files are
  not overwritten unless the user explicitly enables it.

The document engine is the open-source
[`Akode.DocxGen`](https://www.nuget.org/packages/Akode.DocxGen) package.

## Download

Open the [latest release](https://github.com/akode-dev/docxgenui/releases/latest)
and choose the installer for your system:

- Windows: `.msi`
- macOS: `.dmg`
- Linux: `.AppImage` or `.deb`

The application bundle includes its .NET backend. End users do not need Node,
Rust, the .NET SDK, Microsoft Word, or LibreOffice.

> The first public builds are unsigned. Windows SmartScreen and macOS Gatekeeper
> may therefore show an unverified-publisher warning. Code signing is tracked as
> a release-hardening follow-up.

## Using a Word template

Design belongs in Word; content belongs in Markdown and JSON.

1. Create the cover, headers, footers, logo, final page, and styles in a DOCX.
2. Put scalar placeholders such as `{{ds.Title}}` where values should appear.
3. Put `{{ds.Body}:MD}` in its own paragraph where the Markdown body should be
   rendered.
4. In DocxGen UI, choose **Markdown → Word**, then **Template document**.
5. Select the template and inspect its detected placeholders.
6. Select a Markdown file and, when the template has other fields, a JSON model.
7. Choose the output path and render.

Example JSON:

```json
{
  "ds": {
    "Title": "Platform handbook",
    "Description": "Operational guidance",
    "Author": {
      "FirstName": "Andrei",
      "LastName": "Kaliada"
    }
  }
}
```

The Markdown file supplies `ds.Body`; the JSON model supplies the remaining
paths. See the
[DocxGen template authoring guide](https://github.com/akode-dev/docxgen/blob/main/docs/template-authoring-guide.md)
for loops, conditions, tables, images, and template schema generation.

## Development

Prerequisites are .NET SDK 10, Node.js 24, Rust 1.88 or later, and the native
Tauri prerequisites for the current operating system.

```powershell
dotnet restore DocxGen.Ui.slnx --locked-mode
dotnet build DocxGen.Ui.slnx --configuration Release --no-restore
dotnet test DocxGen.Ui.slnx --configuration Release --no-build
npm ci
npm run lint
npm test
npm run desktop:dev
```

The project deliberately keeps the document engine out of Rust and JavaScript.
See [architecture](docs/architecture.md), [development](docs/development.md),
and [release process](docs/release.md) for details.

## Community

Issues and focused pull requests are welcome. Read
[CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the
[Code of Conduct](CODE_OF_CONDUCT.md) first.

DocxGen UI is licensed under the [MIT License](LICENSE).
