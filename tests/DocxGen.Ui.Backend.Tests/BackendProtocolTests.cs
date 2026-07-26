using System.Text.Json;
using Akode.DocxGen.Ui.Backend.Contracts;
using Shouldly;
using Xunit;

namespace Akode.DocxGen.Ui.Backend.Tests;

public sealed class BackendProtocolTests
{
    [Fact]
    public void EveryResponseDataTypeCanBeSerializedThroughTheProtocolContext()
    {
        object[] values =
        [
            new HealthData("0.1.0", "2.1.1", ".NET 10", "Test OS"),
            new InspectionData("hash", null, null, [], [], []),
            new ConversionData(1, 2, 3, 4, 5, true),
            new RenderData("hash", [], [], 1, 2, 3, 4, 5, true),
            new PreflightData("hash", [], []),
            new ScaffoldData("hash"),
            new ExtractionData("assets", 1, 2, 3, 4, 5),
        ];

        foreach (var value in values)
        {
            var response = BackendResponse.Success(
                "test",
                "Ready",
                0,
                data: value);

            var json = JsonSerializer.Serialize(
                response,
                BackendJsonContext.Default.BackendResponse);

            json.ShouldContain("\"ok\":true");
            json.ShouldContain("\"data\":");
        }
    }
}
