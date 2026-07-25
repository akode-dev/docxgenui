using System.Diagnostics;
using System.Reflection;
using Akode.DocxGen;
using Akode.DocxGen.Core.Diagnostics;
using Akode.DocxGen.Core.Pipeline;
using Akode.DocxGen.Ui.Backend.Contracts;
using Akode.DocxGen.Ui.Backend.Infrastructure;

namespace Akode.DocxGen.Ui.Backend.Services;

public sealed class DocumentConversionService
{
    private readonly DocxGenPipeline pipeline;

    public DocumentConversionService()
        : this(DocxGenPipelineFactory.CreatePipeline())
    {
    }

    internal DocumentConversionService(DocxGenPipeline pipeline)
    {
        this.pipeline = pipeline;
    }

    public static BackendResponse Health()
    {
        var backendVersion = Assembly.GetExecutingAssembly()
            .GetName()
            .Version?
            .ToString(3) ?? "0.0.0";
        var docxGenVersion = typeof(DocxGenPipelineFactory)
            .Assembly
            .GetName()
            .Version?
            .ToString(3) ?? "unknown";

        return BackendResponse.Success(
            "health",
            "DocxGen UI backend is ready.",
            0,
            data: new HealthData(
                backendVersion,
                docxGenVersion,
                System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
                System.Runtime.InteropServices.RuntimeInformation.OSDescription));
    }

    public async Task<BackendResponse> InspectAsync(
        InspectTemplatePayload payload,
        CancellationToken cancellationToken)
    {
        var timer = Stopwatch.StartNew();
        ValidateInputFile(payload.TemplatePath, ".docx", "template");

        await using var template = OpenInput(payload.TemplatePath);
        var result = await pipeline.InspectAsync(
                new InspectRequest(
                    new InputArtifact(payload.TemplatePath, template)),
                cancellationToken)
            .ConfigureAwait(false);

        timer.Stop();
        var data = new InspectionData(
            result.Schema.TemplateHash,
            result.Schema.TemplateId,
            result.Schema.TemplateVersion,
            result.Schema.Placeholders
                .Select(PlaceholderData.FromPlaceholder)
                .ToArray(),
            result.Schema.RequiredStyles,
            result.UnsupportedForStaticAnalysis);

        var hasErrors = result.Schema.Diagnostics.Any(
            diagnostic => diagnostic.Severity == DiagnosticSeverity.Error);
        return hasErrors
            ? BackendResponse.Failure(
                "inspect",
                result.Schema.Diagnostics.First(
                    diagnostic => diagnostic.Severity == DiagnosticSeverity.Error).Code,
                "The template could not be inspected.",
                "Open the diagnostics, repair the DOCX template, and try again.",
                timer.ElapsedMilliseconds,
                result.Schema.Diagnostics)
            : BackendResponse.Success(
                "inspect",
                $"Template inspected: {data.Placeholders.Count} placeholder(s).",
                timer.ElapsedMilliseconds,
                diagnostics: result.Schema.Diagnostics,
                data: data);
    }

    public async Task<BackendResponse> ConvertAsync(
        ConvertMarkdownPayload payload,
        CancellationToken cancellationToken)
    {
        var timer = Stopwatch.StartNew();
        ValidateInputFile(payload.MarkdownPath, ".md", "Markdown");
        ValidateOutputExtension(payload.OutputPath, ".docx");
        if (payload.StyleReferencePath is not null)
        {
            ValidateInputFile(payload.StyleReferencePath, ".docx", "style reference");
        }

        await using var markdown = OpenInput(payload.MarkdownPath);
        await using var styleReference = payload.StyleReferencePath is null
            ? null
            : OpenInput(payload.StyleReferencePath);

        var result = await pipeline.ConvertAsync(
                new ConvertRequest(
                    new InputArtifact(payload.MarkdownPath, markdown),
                    styleReference is null
                        ? null
                        : new InputArtifact(payload.StyleReferencePath!, styleReference),
                    payload.HeadingOffset,
                    payload.IncludeToc,
                    payload.ValidateOutput),
                cancellationToken)
            .ConfigureAwait(false);

        await using (result.Document)
        {
            if (!result.IsSuccess)
            {
                timer.Stop();
                return FailureFromDiagnostics(
                    "convert",
                    "Markdown conversion failed.",
                    "Review the diagnostics and correct the Markdown or style reference.",
                    timer.ElapsedMilliseconds,
                    result.Diagnostics);
            }

            await AtomicOutput.WriteStreamAsync(
                    result.Document,
                    payload.OutputPath,
                    payload.Overwrite,
                    cancellationToken)
                .ConfigureAwait(false);
        }

        timer.Stop();
        return BackendResponse.Success(
            "convert",
            "Word document created.",
            timer.ElapsedMilliseconds,
            Path.GetFullPath(payload.OutputPath),
            result.Diagnostics,
            new ConversionData(
                result.MarkdownStats.Sections,
                result.MarkdownStats.Headings,
                result.MarkdownStats.Tables,
                result.MarkdownStats.Images,
                result.MarkdownStats.CodeBlocks,
                result.Validation?.IsValid ?? false));
    }

    public async Task<BackendResponse> RenderAsync(
        RenderTemplatePayload payload,
        CancellationToken cancellationToken)
    {
        var timer = Stopwatch.StartNew();
        ValidateInputFile(payload.TemplatePath, ".docx", "template");
        ValidateOutputExtension(payload.OutputPath, ".docx");
        if (payload.MarkdownPath is null && payload.ModelPath is null)
        {
            throw new ArgumentException(
                "Template rendering requires a Markdown file, a JSON model, or both.");
        }

        if (payload.MarkdownPath is not null)
        {
            ValidateInputFile(payload.MarkdownPath, ".md", "Markdown");
        }

        if (payload.ModelPath is not null)
        {
            ValidateInputFile(payload.ModelPath, ".json", "model");
        }

        var assetsRoot = ResolveAssetsRoot(payload);
        await using var template = OpenInput(payload.TemplatePath);
        await using var markdown = payload.MarkdownPath is null
            ? null
            : OpenInput(payload.MarkdownPath);
        await using var model = payload.ModelPath is null
            ? null
            : OpenInput(payload.ModelPath);

        var options = new RenderOptions
        {
            Culture = "en-US",
            Strict = true,
            HeadingOffset = payload.HeadingOffset,
            AllowRawHtml = false,
            AllowRemoteImages = false,
            UpdateFieldsOnOpen = true,
            Overrides = RenderOptionOverrides.Culture
                | RenderOptionOverrides.Strict
                | RenderOptionOverrides.HeadingOffset
                | RenderOptionOverrides.AllowRawHtml
                | RenderOptionOverrides.AllowRemoteImages
                | RenderOptionOverrides.UpdateFieldsOnOpen,
        };
        var result = await pipeline.RenderAsync(
                new RenderRequest(
                    new InputArtifact(payload.TemplatePath, template),
                    model is null
                        ? null
                        : new InputArtifact(payload.ModelPath!, model),
                    markdown is null
                        ? null
                        : new InputArtifact(payload.MarkdownPath!, markdown),
                    assetsRoot,
                    options,
                    validateOutput: payload.ValidateOutput),
                cancellationToken)
            .ConfigureAwait(false);

        if (!result.IsSuccess || result.Document is null)
        {
            result.Document?.Dispose();
            timer.Stop();
            return FailureFromDiagnostics(
                "render",
                "Template rendering failed.",
                "Review missing or invalid fields, then update the Markdown, model, or template.",
                timer.ElapsedMilliseconds,
                result.Diagnostics);
        }

        await using (result.Document)
        {
            await AtomicOutput.WriteStreamAsync(
                    result.Document,
                    payload.OutputPath,
                    payload.Overwrite,
                    cancellationToken)
                .ConfigureAwait(false);
        }

        timer.Stop();
        return BackendResponse.Success(
            "render",
            "Template-based Word document created.",
            timer.ElapsedMilliseconds,
            Path.GetFullPath(payload.OutputPath),
            result.Diagnostics,
            new RenderData(
                result.TemplateHash,
                result.BoundPaths,
                result.UnboundPaths,
                result.MarkdownStats.Sections,
                result.MarkdownStats.Headings,
                result.MarkdownStats.Tables,
                result.MarkdownStats.Images,
                result.MarkdownStats.CodeBlocks,
                result.Validation?.IsValid ?? false));
    }

    public async Task<BackendResponse> ExtractAsync(
        ExtractMarkdownPayload payload,
        CancellationToken cancellationToken)
    {
        var timer = Stopwatch.StartNew();
        ValidateInputFile(payload.DocumentPath, ".docx", "document");
        ValidateOutputExtension(payload.OutputPath, ".md");

        var outputPath = AtomicOutput.NormalizeDestination(payload.OutputPath);
        AtomicOutput.EnsureCanWrite(outputPath, payload.Overwrite);
        var outputDirectory = Path.GetDirectoryName(outputPath)!;
        var assetsDirectory = string.IsNullOrWhiteSpace(payload.AssetsDirectory)
            ? Path.Combine(
                outputDirectory,
                $"{Path.GetFileNameWithoutExtension(outputPath)}.assets")
            : Path.GetFullPath(payload.AssetsDirectory);
        Directory.CreateDirectory(assetsDirectory);

        var prefix = Path.GetRelativePath(outputDirectory, assetsDirectory)
            .Replace('\\', '/');
        if (prefix == ".")
        {
            prefix = "assets";
            assetsDirectory = Path.Combine(outputDirectory, prefix);
            Directory.CreateDirectory(assetsDirectory);
        }

        await using var document = OpenInput(payload.DocumentPath);
        var result = await pipeline.ExtractAsync(
                new ExtractRequest(
                    new InputArtifact(payload.DocumentPath, document),
                    prefix),
                cancellationToken)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            timer.Stop();
            return FailureFromDiagnostics(
                "extract",
                "DOCX extraction failed.",
                "Review the diagnostics and verify that the input is a valid macro-free DOCX.",
                timer.ElapsedMilliseconds,
                result.Diagnostics);
        }

        foreach (var asset in result.Assets)
        {
            var assetPath = Path.Combine(assetsDirectory, asset.FileName);
            await AtomicOutput.WriteBytesAsync(
                    asset.Content,
                    assetPath,
                    payload.Overwrite,
                    cancellationToken)
                .ConfigureAwait(false);
        }

        await AtomicOutput.WriteTextAsync(
                result.Markdown,
                outputPath,
                payload.Overwrite,
                cancellationToken)
            .ConfigureAwait(false);

        timer.Stop();
        return BackendResponse.Success(
            "extract",
            "Markdown and embedded images extracted.",
            timer.ElapsedMilliseconds,
            outputPath,
            result.Diagnostics,
            new ExtractionData(
                assetsDirectory,
                result.Stats.Paragraphs,
                result.Stats.Headings,
                result.Stats.ListItems,
                result.Stats.Tables,
                result.Stats.Images));
    }

    private static BackendResponse FailureFromDiagnostics(
        string operation,
        string message,
        string hint,
        long durationMilliseconds,
        IReadOnlyList<Diagnostic> diagnostics)
    {
        var firstError = diagnostics.FirstOrDefault(
            diagnostic => diagnostic.Severity == DiagnosticSeverity.Error);
        return BackendResponse.Failure(
            operation,
            firstError?.Code ?? "E-UI-OPERATION",
            message,
            firstError?.Hint ?? hint,
            durationMilliseconds,
            diagnostics);
    }

    private static FileStream OpenInput(string path) =>
        new(
            Path.GetFullPath(path),
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            131_072,
            FileOptions.Asynchronous | FileOptions.SequentialScan);

    private static void ValidateInputFile(
        string path,
        string extension,
        string label)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        if (!string.Equals(
                Path.GetExtension(path),
                extension,
                StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException(
                $"The {label} must be a '{extension}' file.");
        }

        if (!File.Exists(path))
        {
            throw new FileNotFoundException(
                $"The {label} file was not found.",
                path);
        }
    }

    private static void ValidateOutputExtension(string path, string extension)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        if (!string.Equals(
                Path.GetExtension(path),
                extension,
                StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException(
                $"The output path must end with '{extension}'.");
        }
    }

    private static string ResolveAssetsRoot(RenderTemplatePayload payload)
    {
        if (!string.IsNullOrWhiteSpace(payload.AssetsRoot))
        {
            return Path.GetFullPath(payload.AssetsRoot);
        }

        var source = payload.MarkdownPath
            ?? payload.ModelPath
            ?? payload.TemplatePath;
        return Path.GetDirectoryName(Path.GetFullPath(source))
            ?? Environment.CurrentDirectory;
    }
}
