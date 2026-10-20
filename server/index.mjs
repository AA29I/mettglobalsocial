import { createApp } from "./app.mjs";
const { app, close } = await createApp();
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, host, () =>
  console.log(`Mett Social listening on ${host}:${port}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(async () => {
      await close();
      process.exit(0);
    }),
  );
