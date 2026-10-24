import { spawnSync } from "node:child_process";
const production = process.env.APP_MODE === "production";
if (production) {
  const missing = [
    "DATABASE_URL",
    "APP_ORIGIN",
    "SETUP_TOKEN",
    "TOKEN_ENCRYPTION_KEY",
  ].filter((name) => !process.env[name]);
  if (missing.length)
    throw new Error("Production deployment requires: " + missing.join(", "));
}
console.log(
  production
    ? "Building server-backed deployment."
    : "Building clearly marked browser-only interface preview. No database or social access.",
);
for (const args of [
  ["node_modules/typescript/bin/tsc", "-b"],
  ["node_modules/vite/bin/vite.js", "build"],
]) {
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, VITE_PREVIEW_MODE: production ? "false" : "true" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
