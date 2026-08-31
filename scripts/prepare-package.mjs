import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
fs.mkdirSync(path.join(repositoryRoot, "dist"), { recursive: true });
