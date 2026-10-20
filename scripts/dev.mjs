import { spawn } from "node:child_process";
const children = [
  spawn(
    process.execPath,
    ["--env-file-if-exists=.env", "--watch", "server/index.mjs"],
    { stdio: "inherit" },
  ),
  spawn("npm", ["run", "dev:client"], { stdio: "inherit" }),
];
function close() {
  children.forEach((p) => p.kill("SIGTERM"));
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
children.forEach((p) =>
  p.on("exit", (code) => {
    close();
    process.exitCode = code || 0;
  }),
);
