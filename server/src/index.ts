import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { createApiRouter } from "./routes/api";
import { GeminiModelAdapter } from "./adapter/GeminiModelAdapter";

const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

const adapter = new GeminiModelAdapter();
app.use("/api", createApiRouter(adapter));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("API error", error);
  res.status(500).json({ error: (error as Error).message ?? "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`AI Fashion Studio API listening on port ${PORT}`);
});
