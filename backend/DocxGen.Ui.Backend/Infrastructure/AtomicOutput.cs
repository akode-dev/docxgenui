namespace Akode.DocxGen.Ui.Backend.Infrastructure;

public static class AtomicOutput
{
    public static async Task WriteStreamAsync(
        Stream source,
        string destinationPath,
        bool overwrite,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(source);
        var destination = NormalizeDestination(destinationPath);
        EnsureCanWrite(destination, overwrite);

        var temporary = CreateTemporaryPath(destination);
        try
        {
            await using (var output = new FileStream(
                             temporary,
                             FileMode.CreateNew,
                             FileAccess.Write,
                             FileShare.None,
                             131_072,
                             FileOptions.Asynchronous | FileOptions.SequentialScan))
            {
                if (source.CanSeek)
                {
                    source.Position = 0;
                }

                await source.CopyToAsync(output, cancellationToken)
                    .ConfigureAwait(false);
                await output.FlushAsync(cancellationToken).ConfigureAwait(false);
            }

            File.Move(temporary, destination, overwrite);
        }
        finally
        {
            TryDelete(temporary);
        }
    }

    public static async Task WriteBytesAsync(
        ReadOnlyMemory<byte> content,
        string destinationPath,
        bool overwrite,
        CancellationToken cancellationToken)
    {
        await using var source = new MemoryStream(content.ToArray(), writable: false);
        await WriteStreamAsync(
                source,
                destinationPath,
                overwrite,
                cancellationToken)
            .ConfigureAwait(false);
    }

    public static async Task WriteTextAsync(
        string content,
        string destinationPath,
        bool overwrite,
        CancellationToken cancellationToken)
    {
        await using var source = new MemoryStream(
            System.Text.Encoding.UTF8.GetBytes(content),
            writable: false);
        await WriteStreamAsync(
                source,
                destinationPath,
                overwrite,
                cancellationToken)
            .ConfigureAwait(false);
    }

    public static string NormalizeDestination(string path)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        var fullPath = Path.GetFullPath(path);
        var directory = Path.GetDirectoryName(fullPath)
            ?? throw new IOException("The output path has no parent directory.");
        Directory.CreateDirectory(directory);
        return fullPath;
    }

    public static void EnsureCanWrite(string path, bool overwrite)
    {
        if (File.Exists(path) && !overwrite)
        {
            throw new IOException(
                $"The output already exists: '{path}'. Enable overwrite or choose another path.");
        }
    }

    private static string CreateTemporaryPath(string destination) =>
        Path.Combine(
            Path.GetDirectoryName(destination)!,
            $".{Path.GetFileName(destination)}.{Guid.NewGuid():N}.tmp");

    private static void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
        catch (IOException)
        {
            // Best-effort cleanup. The destination was never replaced.
        }
        catch (UnauthorizedAccessException)
        {
            // Best-effort cleanup. The destination was never replaced.
        }
    }
}
