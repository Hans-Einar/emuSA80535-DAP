import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const fixtureDirectory = path.join(repositoryRoot, "test-fixtures", "firmware");
const metadata = JSON.parse(
  fs.readFileSync(path.join(fixtureDirectory, "synthetic-loop.json"), "utf8"),
);
const image = fs.readFileSync(path.join(fixtureDirectory, "synthetic-loop.bin"));
const sha256 = createHash("sha256").update(image).digest("hex");

if (image.length !== metadata.size) {
  throw new Error(`fixture size ${image.length} does not match ${metadata.size}`);
}
if (sha256 !== metadata.sha256) {
  throw new Error(`fixture SHA-256 ${sha256} does not match ${metadata.sha256}`);
}
process.stdout.write(`synthetic-loop.bin ${image.length} ${sha256}\n`);
