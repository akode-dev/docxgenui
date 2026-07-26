using Akode.DocxGen.Ui.Backend.Contracts;
using Akode.DocxGen.Ui.Backend.Services;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Shouldly;
using Xunit;

namespace Akode.DocxGen.Ui.Backend.Tests;

public sealed class DocumentConversionServiceTests
{
    [Fact]
    public async Task ConvertAndExtractRoundTripCreatesPortableFiles()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        using var workspace = new TemporaryWorkspace();
        var markdownPath = workspace.PathFor("source.md");
        var documentPath = workspace.PathFor("output.docx");
        var extractedPath = workspace.PathFor("extracted.md");
        await File.WriteAllTextAsync(
            markdownPath,
            """
            # Release notes

            A **portable** document.

            - Windows
            - Linux
            - macOS
            """,
            cancellationToken);

        var service = new DocumentConversionService();
        var converted = await service.ConvertAsync(
            new ConvertMarkdownPayload(
                markdownPath,
                documentPath,
                StyleReferencePath: null,
                HeadingOffset: 0,
                IncludeToc: false,
                ValidateOutput: true,
                Overwrite: false),
            cancellationToken);

        converted.Ok.ShouldBeTrue(converted.Message);
        File.Exists(documentPath).ShouldBeTrue();

        var extracted = await service.ExtractAsync(
            new ExtractMarkdownPayload(
                documentPath,
                extractedPath,
                AssetsDirectory: null,
                Overwrite: false),
            cancellationToken);

        extracted.Ok.ShouldBeTrue(extracted.Message);
        var markdown = await File.ReadAllTextAsync(
            extractedPath,
            cancellationToken);
        markdown.ShouldContain("# Release notes");
        markdown.ShouldContain("**portable**");
        markdown.ShouldContain("- Windows");
    }

    [Fact]
    public async Task ConvertDoesNotOverwriteByDefault()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        using var workspace = new TemporaryWorkspace();
        var markdownPath = workspace.PathFor("source.md");
        var documentPath = workspace.PathFor("output.docx");
        await File.WriteAllTextAsync(
            markdownPath,
            "# Document",
            cancellationToken);
        await File.WriteAllTextAsync(
            documentPath,
            "existing",
            cancellationToken);

        var service = new DocumentConversionService();

        await Should.ThrowAsync<IOException>(
            () => service.ConvertAsync(
                new ConvertMarkdownPayload(
                    markdownPath,
                    documentPath,
                    StyleReferencePath: null,
                    HeadingOffset: 0,
                    IncludeToc: false,
                    ValidateOutput: false,
                    Overwrite: false),
                cancellationToken));
    }

    [Fact]
    public async Task TemplateRenderingCanLeaveUnboundFieldsOptional()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        using var workspace = new TemporaryWorkspace();
        var templatePath = workspace.PathFor("optional.docx");
        var markdownPath = workspace.PathFor("body.md");
        CreateTemplate(templatePath, "{{ds.OptionalValue}}");
        await File.WriteAllTextAsync(markdownPath, "# Body", cancellationToken);
        var service = new DocumentConversionService();

        var lenient = await service.RenderAsync(
            new RenderTemplatePayload(
                templatePath,
                markdownPath,
                ModelPath: null,
                workspace.PathFor("lenient.docx"),
                AssetsRoot: null,
                HeadingOffset: 0,
                Strict: false,
                ValidateOutput: true,
                Overwrite: false),
            cancellationToken);
        var strict = await service.RenderAsync(
            new RenderTemplatePayload(
                templatePath,
                markdownPath,
                ModelPath: null,
                workspace.PathFor("strict.docx"),
                AssetsRoot: null,
                HeadingOffset: 0,
                Strict: true,
                ValidateOutput: false,
                Overwrite: false),
            cancellationToken);

        lenient.Ok.ShouldBeTrue(lenient.Message);
        lenient.Diagnostics.ShouldContain(
            diagnostic => diagnostic.Code == "W-MDL-007");
        strict.Ok.ShouldBeFalse();
        strict.ErrorCode.ShouldBe("E-MDL-003");
    }

    [Fact]
    public async Task TemplateDirectivesUseTheSelectedReferencedFilesFolder()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        using var workspace = new TemporaryWorkspace();
        var templatePath = workspace.PathFor("markdown.docx");
        var modelPath = workspace.PathFor("model.json");
        var assetsRoot = workspace.PathFor("assets");
        Directory.CreateDirectory(assetsRoot);
        CreateTemplate(templatePath, "{{ds.Body}:MD}");
        await File.WriteAllTextAsync(
            Path.Combine(assetsRoot, "content.md"),
            "# Referenced content",
            cancellationToken);
        await File.WriteAllTextAsync(
            modelPath,
            """
            {
              "modelVersion": "1.0",
              "template": {
                "id": "markdown",
                "version": "1.0.0"
              },
              "data": {
                "ds": {
                  "Body": {
                    "$mdFile": "content.md"
                  }
                }
              }
            }
            """,
            cancellationToken);

        var result = await new DocumentConversionService().RenderAsync(
            new RenderTemplatePayload(
                templatePath,
                MarkdownPath: null,
                modelPath,
                workspace.PathFor("rendered.docx"),
                assetsRoot,
                HeadingOffset: 0,
                Strict: false,
                ValidateOutput: true,
                Overwrite: false),
            cancellationToken);

        result.Ok.ShouldBeTrue(result.Message);
        result.Diagnostics.ShouldNotContain(
            diagnostic => diagnostic.Code == "E-SEC-003");
    }

    [Fact]
    public async Task PreflightReportsAllSchemaRequiredFieldsBeforeRendering()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        using var workspace = new TemporaryWorkspace();
        var templatePath = workspace.PathFor("required.docx");
        var markdownPath = workspace.PathFor("body.md");
        CreateTemplate(
            templatePath,
            "{{ds.Document.Title}}",
            "{{ds.Body}:MD}");
        await File.WriteAllTextAsync(
            Path.ChangeExtension(templatePath, ".schema.json"),
            """
            {
              "type": "object",
              "properties": {
                "data": {
                  "required": ["ds"],
                  "properties": {
                    "ds": {
                      "type": "object",
                      "required": ["Document"],
                      "properties": {
                        "Document": {
                          "type": "object",
                          "required": ["Title"],
                          "properties": {
                            "Title": { "type": "string", "minLength": 1 }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            """,
            cancellationToken);
        await File.WriteAllTextAsync(markdownPath, "# Body", cancellationToken);

        var result = await new DocumentConversionService().PreflightAsync(
            new PreflightTemplatePayload(
                templatePath,
                markdownPath,
                ModelPath: null,
                AssetsRoot: null,
                HeadingOffset: 0,
                Strict: false),
            cancellationToken);

        result.Ok.ShouldBeFalse();
        result.ErrorCode.ShouldBe("E-MDL-003");
        result.Message.ShouldBe("1 template field is required for this render.");
        result.Diagnostics.ShouldContain(
            diagnostic => diagnostic.Path == "/data/ds/Document/Title");
        File.Exists(workspace.PathFor("output.docx")).ShouldBeFalse();
    }

    [Fact]
    public async Task ScaffoldCreatesAnEditableJsonModel()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        using var workspace = new TemporaryWorkspace();
        var templatePath = workspace.PathFor("handbook.docx");
        var modelPath = workspace.PathFor("handbook.model.json");
        CreateTemplate(
            templatePath,
            "{{ds.Document.Title}}",
            "{{ds.Body}:MD}");

        var result = await new DocumentConversionService().ScaffoldAsync(
            new ScaffoldModelPayload(
                templatePath,
                modelPath,
                Overwrite: false),
            cancellationToken);

        result.Ok.ShouldBeTrue(result.Message);
        File.Exists(modelPath).ShouldBeTrue();
        var json = await File.ReadAllTextAsync(modelPath, cancellationToken);
        json.ShouldContain("\"Document\"");
        json.ShouldContain("\"Title\"");
        json.ShouldContain("\"Body\"");
    }

    private static void CreateTemplate(string path, string placeholder)
    {
        CreateTemplate(path, [placeholder]);
    }

    private static void CreateTemplate(string path, params string[] placeholders)
    {
        using var package = WordprocessingDocument.Create(
            path,
            WordprocessingDocumentType.Document);
        var main = package.AddMainDocumentPart();
        main.Document = new Document(
            new Body(
                placeholders.Select(
                    placeholder =>
                        new Paragraph(new Run(new Text(placeholder))))));
        main.Document.Save();
    }

    private sealed class TemporaryWorkspace : IDisposable
    {
        private readonly string root = System.IO.Path.Combine(
            System.IO.Path.GetTempPath(),
            $"docxgen-ui-tests-{Guid.NewGuid():N}");

        public TemporaryWorkspace()
        {
            Directory.CreateDirectory(root);
        }

        public string PathFor(string fileName) =>
            System.IO.Path.Combine(root, fileName);

        public void Dispose()
        {
            try
            {
                Directory.Delete(root, recursive: true);
            }
            catch (IOException)
            {
                // Test cleanup is best effort on platforms with delayed file release.
            }
            catch (UnauthorizedAccessException)
            {
                // Test cleanup is best effort on platforms with delayed file release.
            }
        }
    }
}
