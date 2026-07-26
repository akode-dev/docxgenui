using System.Text.Json;
using System.Text.Json.Serialization;
using Akode.DocxGen.Core.Diagnostics;
using Akode.DocxGen.Core.Model;
using Akode.DocxGen.Core.Pipeline;

namespace Akode.DocxGen.Ui.Backend.Contracts;

public sealed record BackendEnvelope(
    string Operation,
    JsonElement Payload);

public sealed record BackendResponse(
    bool Ok,
    string Operation,
    string Message,
    string? Hint,
    string? ErrorCode,
    string? OutputPath,
    long DurationMilliseconds,
    IReadOnlyList<BackendDiagnostic> Diagnostics,
    object? Data)
{
    public static BackendResponse Success(
        string operation,
        string message,
        long durationMilliseconds,
        string? outputPath = null,
        IReadOnlyList<Diagnostic>? diagnostics = null,
        object? data = null) =>
        new(
            true,
            operation,
            message,
            null,
            null,
            outputPath,
            durationMilliseconds,
            MapDiagnostics(diagnostics),
            data);

    public static BackendResponse Failure(
        string operation,
        string errorCode,
        string message,
        string hint,
        long durationMilliseconds,
        IReadOnlyList<Diagnostic>? diagnostics = null) =>
        new(
            false,
            operation,
            message,
            hint,
            errorCode,
            null,
            durationMilliseconds,
            MapDiagnostics(diagnostics),
            null);

    private static BackendDiagnostic[] MapDiagnostics(
        IReadOnlyList<Diagnostic>? diagnostics) =>
        diagnostics is null
            ? []
            : diagnostics.Select(BackendDiagnostic.FromDiagnostic).ToArray();
}

public sealed record BackendDiagnostic(
    string Code,
    string Severity,
    string Message,
    string Hint,
    string? Path)
{
    public static BackendDiagnostic FromDiagnostic(Diagnostic diagnostic) =>
        new(
            diagnostic.Code,
            diagnostic.Severity.ToString().ToLowerInvariant(),
            diagnostic.Message,
            diagnostic.Hint,
            diagnostic.Path);
}

public sealed record InspectTemplatePayload(string TemplatePath);

public sealed record ConvertMarkdownPayload(
    string MarkdownPath,
    string OutputPath,
    string? StyleReferencePath,
    int HeadingOffset,
    bool IncludeToc,
    bool ValidateOutput,
    bool Overwrite);

public sealed record RenderTemplatePayload(
    string TemplatePath,
    string? MarkdownPath,
    string? ModelPath,
    string OutputPath,
    string? AssetsRoot,
    int HeadingOffset,
    bool Strict,
    bool ValidateOutput,
    bool Overwrite);

public sealed record PreflightTemplatePayload(
    string TemplatePath,
    string? MarkdownPath,
    string? ModelPath,
    string? AssetsRoot,
    int HeadingOffset,
    bool Strict);

public sealed record ScaffoldModelPayload(
    string TemplatePath,
    string OutputPath,
    bool Overwrite);

public sealed record ExtractMarkdownPayload(
    string DocumentPath,
    string OutputPath,
    string? AssetsDirectory,
    bool Overwrite);

public sealed record HealthData(
    string BackendVersion,
    string DocxGenVersion,
    string Runtime,
    string OperatingSystem);

public sealed record InspectionData(
    string TemplateHash,
    string? TemplateId,
    string? TemplateVersion,
    IReadOnlyList<PlaceholderData> Placeholders,
    IReadOnlyList<string> RequiredStyles,
    IReadOnlyList<string> UnsupportedForStaticAnalysis);

public sealed record PlaceholderData(
    string Path,
    string Kind,
    string? Formatter,
    string? FormatterArguments,
    bool Required,
    IReadOnlyList<string> Locations)
{
    public static PlaceholderData FromPlaceholder(TemplatePlaceholder placeholder) =>
        new(
            placeholder.Path,
            placeholder.Kind.ToString(),
            placeholder.Formatter,
            placeholder.FormatterArguments,
            placeholder.Required,
            placeholder.Locations);
}

public sealed record ConversionData(
    int Sections,
    int Headings,
    int Tables,
    int Images,
    int CodeBlocks,
    bool Validated);

public sealed record RenderData(
    string TemplateHash,
    IReadOnlyList<string> BoundPaths,
    IReadOnlyList<string> UnboundPaths,
    int Sections,
    int Headings,
    int Tables,
    int Images,
    int CodeBlocks,
    bool Validated);

public sealed record PreflightData(
    string TemplateHash,
    IReadOnlyList<string> BoundPaths,
    IReadOnlyList<string> UnboundPaths);

public sealed record ScaffoldData(
    string TemplateHash);

public sealed record ExtractionData(
    string AssetsDirectory,
    int Paragraphs,
    int Headings,
    int ListItems,
    int Tables,
    int Images);

[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    PropertyNameCaseInsensitive = true,
    WriteIndented = false)]
[JsonSerializable(typeof(BackendEnvelope))]
[JsonSerializable(typeof(BackendResponse))]
[JsonSerializable(typeof(InspectTemplatePayload))]
[JsonSerializable(typeof(ConvertMarkdownPayload))]
[JsonSerializable(typeof(RenderTemplatePayload))]
[JsonSerializable(typeof(PreflightTemplatePayload))]
[JsonSerializable(typeof(ScaffoldModelPayload))]
[JsonSerializable(typeof(ExtractMarkdownPayload))]
[JsonSerializable(typeof(BackendDiagnostic))]
[JsonSerializable(typeof(HealthData))]
[JsonSerializable(typeof(InspectionData))]
[JsonSerializable(typeof(PlaceholderData))]
[JsonSerializable(typeof(ConversionData))]
[JsonSerializable(typeof(RenderData))]
[JsonSerializable(typeof(PreflightData))]
[JsonSerializable(typeof(ScaffoldData))]
[JsonSerializable(typeof(ExtractionData))]
public sealed partial class BackendJsonContext : JsonSerializerContext;
