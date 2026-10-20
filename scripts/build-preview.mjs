import { spawnSync } from "node:child_process";
for (const args of [
  ["node_modules/typescript/bin/tsc", "-b"],
  ["node_modules/vite/bin/vite.js", "build", "--outDir", "dist-preview"],
]) {
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, VITE_PREVIEW_MODE: "true" },
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
