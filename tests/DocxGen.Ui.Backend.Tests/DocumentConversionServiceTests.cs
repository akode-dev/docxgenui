using Akode.DocxGen.Ui.Backend.Contracts;
using Akode.DocxGen.Ui.Backend.Services;
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
