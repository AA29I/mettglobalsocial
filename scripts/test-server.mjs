import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.DATA_DIR = await mkdtemp(join(tmpdir(), "mett-browser-"));
await import("../server/index.mjs");
