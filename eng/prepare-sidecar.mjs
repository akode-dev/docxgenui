import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const argumentsList = process.argv.slice(2);

function option(name, fallback) {
  const index = argumentsList.indexOf(name);
  return index >= 0 && argumentsList[index + 1]
    ? argumentsList[index + 1]
    : fallback;
}

function rustHostTriple() {
  const result = spawnSync("rustc", ["-vV"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error("Rust is required to resolve the target triple.");
  }

  const match = /^host:\s+(.+)$/mu.exec(result.stdout);
  if (!match) {
    throw new Error("Could not resolve the Rust host triple.");
  }

  return match[1].trim();
}

const target = option("--target", process.env.TAURI_ENV_TARGET_TRIPLE ?? rustHostTriple());
const configuration = option("--configuration", "Debug");
const targets = new Map([
  ["x86_64-pc-windows-msvc", { rid: "win-x64", extension: ".exe" }],
  ["aarch64-pc-windows-msvc", { rid: "win-arm64", extension: ".exe" }],
  ["x86_64-apple-darwin", { rid: "osx-x64", extension: "" }],
  ["aarch64-apple-darwin", { rid: "osx-arm64", extension: "" }],
  ["x86_64-unknown-linux-gnu", { rid: "linux-x64", extension: "" }],
  ["aarch64-unknown-linux-gnu", { rid: "linux-arm64", extension: "" }],
]);
const platform = targets.get(target);

if (!platform) {
  throw new Error(`Unsupported Rust target '${target}'.`);
}

const outputDirectory = join(root, "artifacts", "sidecar", platform.rid);
rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

const project = join(
  root,
  "backend",
  "DocxGen.Ui.Backend",
  "DocxGen.Ui.Backend.csproj",
);
const publishArguments = [
  "publish",
  project,
  "--configuration",
  configuration,
  "--runtime",
  platform.rid,
  "--self-contained",
  "true",
  "-p:PublishSingleFile=true",
  "-p:PublishTrimmed=false",
  "-p:DebugSymbols=false",
  "-p:DebugType=None",
  "--output",
  outputDirectory,
];
const publish = spawnSync("dotnet", publishArguments, {
  cwd: root,
  stdio: "inherit",
});
if (publish.status !== 0) {
  process.exit(publish.status ?? 1);
}

const source = join(outputDirectory, `docxgen-ui-backend${platform.extension}`);
const destination = join(
  root,
  "src-tauri",
  "binaries",
  `docxgen-ui-backend-${target}${platform.extension}`,
);
mkdirSync(resolve(destination, ".."), { recursive: true });
copyFileSync(source, destination);
process.stdout.write(
  `Prepared ${basename(destination)} from ${platform.rid} (${configuration}).\n`,
);
