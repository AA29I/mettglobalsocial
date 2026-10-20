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
const result = spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  env: { ...process.env, VITE_PREVIEW_MODE: production ? "false" : "true" },
});
process.exit(result.status || 0);
