import "dotenv/config";
import express from "express";
import cors from "cors";
import { createApiRouter } from "./routes/api";
import { GeminiModelAdapter } from "./adapter/GeminiModelAdapter";
import { MockModelAdapter } from "./adapter/MockModelAdapter";
import { ImageModelAdapter } from "./adapter/ImageModelAdapter";

const PORT = Number(process.env.PORT ?? 3001);

const createAdapter = (): ImageModelAdapter => {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn(
      "GEMINI_API_KEY missing. Falling back to mock adapter; no external calls will be made."
    );
    return new MockModelAdapter();
  }

  try {
    return new GeminiModelAdapter(apiKey);
  } catch (error) {
    console.error(
      "Failed to initialize GeminiModelAdapter. Falling back to mock adapter.",
      error
    );
    return new MockModelAdapter();
  }
};

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

const adapter = createAdapter();
app.use("/api", createApiRouter(adapter));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("API error", error);
  res.status(500).json({ error: (error as Error).message ?? "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`AI Fashion Studio API listening on port ${PORT}`);
});
