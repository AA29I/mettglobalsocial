import { createApp } from "../server/app.mjs";
let instance;
export default async function handler(req, res) {
  try {
    instance ||= createApp();
    const { app } = await instance;
    return app(req, res);
  } catch (error) {
    instance = undefined;
    console.error("Application initialization failed:", error.name);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error:
          "Application storage is unavailable. Configure DATABASE_URL and retry.",
      }),
    );
  }
}
