using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Akode.DocxGen.Ui.Backend.Contracts;

namespace Akode.DocxGen.Ui.Backend.Services;

public sealed class BackendDispatcher(DocumentConversionService service)
{
    public async Task<BackendResponse> DispatchEncodedAsync(
        string encodedRequest,
        CancellationToken cancellationToken)
    {
        var timer = Stopwatch.StartNew();
        try
        {
            var json = DecodeBase64Url(encodedRequest);
            var envelope = JsonSerializer.Deserialize(
                    json,
                    BackendJsonContext.Default.BackendEnvelope)
                ?? throw new InvalidDataException("The request body is empty.");

            return envelope.Operation switch
            {
                "health" => DocumentConversionService.Health(),
                "inspect" => await service.InspectAsync(
                    Deserialize(
                        envelope.Payload,
                        BackendJsonContext.Default.InspectTemplatePayload),
                    cancellationToken).ConfigureAwait(false),
                "convert" => await service.ConvertAsync(
                    Deserialize(
                        envelope.Payload,
                        BackendJsonContext.Default.ConvertMarkdownPayload),
                    cancellationToken).ConfigureAwait(false),
                "render" => await service.RenderAsync(
                    Deserialize(
                        envelope.Payload,
                        BackendJsonContext.Default.RenderTemplatePayload),
                    cancellationToken).ConfigureAwait(false),
                "preflight" => await service.PreflightAsync(
                    Deserialize(
                        envelope.Payload,
                        BackendJsonContext.Default.PreflightTemplatePayload),
                    cancellationToken).ConfigureAwait(false),
                "scaffold" => await service.ScaffoldAsync(
                    Deserialize(
                        envelope.Payload,
                        BackendJsonContext.Default.ScaffoldModelPayload),
                    cancellationToken).ConfigureAwait(false),
                "extract" => await service.ExtractAsync(
                    Deserialize(
                        envelope.Payload,
                        BackendJsonContext.Default.ExtractMarkdownPayload),
                    cancellationToken).ConfigureAwait(false),
                _ => throw new ArgumentException(
                    $"Unsupported operation '{envelope.Operation}'."),
            };
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            timer.Stop();
            return BackendResponse.Failure(
                "unknown",
                "E-UI-CANCELLED",
                "The operation was cancelled.",
                "Run the operation again when ready.",
                timer.ElapsedMilliseconds);
        }
        catch (Exception exception) when (
            exception is ArgumentException
            or FileNotFoundException
            or InvalidDataException
            or IOException
            or UnauthorizedAccessException
            or JsonException
            or FormatException)
        {
            timer.Stop();
            var (code, hint) = exception switch
            {
                UnauthorizedAccessException => (
                    "E-UI-ACCESS",
                    "Choose files and folders that the current user can read and write."),
                IOException => (
                    "E-UI-IO",
                    "Close applications locking the file, check free space, and try again."),
                _ => (
                    "E-UI-INPUT",
                    "Check the selected files and options, then try again."),
            };
            return BackendResponse.Failure(
                "unknown",
                code,
                exception.Message,
                hint,
                timer.ElapsedMilliseconds);
        }
        catch (Exception exception)
        {
            timer.Stop();
            return BackendResponse.Failure(
                "unknown",
                "E-UI-UNEXPECTED",
                "DocxGen UI encountered an unexpected error.",
                "Retry the operation. If it happens again, report the issue with the application version.",
                timer.ElapsedMilliseconds,
                diagnostics:
                [
                    new Akode.DocxGen.Core.Diagnostics.Diagnostic(
                        "E-UI-UNEXPECTED",
                        Akode.DocxGen.Core.Diagnostics.DiagnosticSeverity.Error,
                        exception.GetType().Name,
                        "Do not include confidential document contents in the issue report.")
                ]);
        }
    }

    private static T Deserialize<T>(
        JsonElement element,
        System.Text.Json.Serialization.Metadata.JsonTypeInfo<T> typeInfo) =>
        element.Deserialize(typeInfo)
        ?? throw new InvalidDataException("The operation payload is empty.");

    private static string DecodeBase64Url(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        var normalized = value.Replace('-', '+').Replace('_', '/');
        normalized += (normalized.Length % 4) switch
        {
            0 => string.Empty,
            2 => "==",
            3 => "=",
            _ => throw new FormatException("The request is not valid Base64URL."),
        };
        return Encoding.UTF8.GetString(Convert.FromBase64String(normalized));
    }
}
