using System.Text.Json;
using Akode.DocxGen.Ui.Backend.Contracts;
using Akode.DocxGen.Ui.Backend.Services;

using var cancellation = new CancellationTokenSource();
Console.CancelKeyPress += (_, eventArgs) =>
{
    eventArgs.Cancel = true;
    cancellation.Cancel();
};

var response = args is ["--request", var encodedRequest]
    ? await new BackendDispatcher(new DocumentConversionService())
        .DispatchEncodedAsync(encodedRequest, cancellation.Token)
        .ConfigureAwait(false)
    : BackendResponse.Failure(
        "protocol",
        "E-UI-PROTOCOL",
        "Expected '--request <base64url-json>'.",
        "Start this backend through the DocxGen UI desktop application.",
        0);

Console.WriteLine(
    JsonSerializer.Serialize(
        response,
        BackendJsonContext.Default.BackendResponse));
return response.ErrorCode == "E-UI-PROTOCOL" ? 2 : 0;
