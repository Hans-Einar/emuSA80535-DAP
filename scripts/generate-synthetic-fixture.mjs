import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const outputPath = path.join(
  repositoryRoot,
  "test-fixtures",
  "firmware",
  "synthetic-loop.bin",
);
const expectedSha256 =
  "1550101bc337eba836f6fc6a3012b80677b9dfe6a0c658fcf615194be54e5b88";

const image = Buffer.alloc(65_536, 0x00);
image.set(
  [
    0x74, 0x01, // 0000: MOV A,#01h
    0x04, // 0002: INC A
    0x80, 0xfd, // 0003: SJMP 0002h
  ],
  0,
);

const actualSha256 = createHash("sha256").update(image).digest("hex");
if (actualSha256 !== expectedSha256) {
  throw new Error(
    `synthetic fixture hash changed: expected ${expectedSha256}, received ${actualSha256}`,
  );
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, image);
process.stdout.write(`${outputPath}\n${actualSha256}\n`);
