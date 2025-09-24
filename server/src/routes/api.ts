import express from "express";
import { ImageModelAdapter } from "../adapter/ImageModelAdapter";
import {
  AnalyzeBodySchema,
  AnalyzeResponseSchema,
  AssignSlotsBodySchema,
  AssignSlotsResponseSchema,
  GenerateBodySchema,
  GenerateResponseSchema,
  QueueShotsBodySchema,
  QueueShotsResponseSchema,
  VariantsBodySchema,
  VariantResponseSchema,
  buildShotQueue
} from "../schemas";
import { generationQueue } from "../services/queue";
import { retryWithBackoff } from "../services/retry";

export const createApiRouter = (adapter: ImageModelAdapter) => {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  router.post("/analyze", async (req, res, next) => {
    const parse = AnalyzeBodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.flatten() });
      return;
    }

    const controller = new AbortController();
    req.on("close", () => controller.abort());

    try {
      const response = await retryWithBackoff(() =>
        adapter.analyze(parse.data.imageBase64, controller.signal)
      );
      res.json(AnalyzeResponseSchema.parse(response));
    } catch (error) {
      next(error);
    }
  });

  router.post("/assign-slots", async (req, res, next) => {
    const parse = AssignSlotsBodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.flatten() });
      return;
    }

    const controller = new AbortController();
    req.on("close", () => controller.abort());

    try {
      const response = await retryWithBackoff(() =>
        adapter.assignSlots(parse.data.images, controller.signal)
      );
      res.json(AssignSlotsResponseSchema.parse(response));
    } catch (error) {
      next(error);
    }
  });

  router.post("/queue-shots", async (req, res) => {
    const parse = QueueShotsBodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.flatten() });
      return;
    }

    const shots = buildShotQueue(parse.data.confirmed);
    res.json(QueueShotsResponseSchema.parse({ shots }));
  });

  router.post("/generate", async (req, res, next) => {
    const parse = GenerateBodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.flatten() });
      return;
    }

    const controller = new AbortController();
    req.on("close", () => controller.abort());

    try {
      const result = await generationQueue.add(
        () =>
          retryWithBackoff(() =>
            adapter.generate(
              {
                shot: parse.data.shot,
                slots: parse.data.slots ?? {},
                confirmedCategories: parse.data.confirmedCategories,
                correctivePrompts: parse.data.correctivePrompts,
                anchorImage: parse.data.anchorImage
              },
              controller.signal
            )
          ),
        { signal: controller.signal }
      );

      res.json(GenerateResponseSchema.parse(result));
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        res.status(499).json({ error: "Request aborted" });
        return;
      }
      next(error);
    }
  });

  router.post("/variants", async (req, res, next) => {
    const parse = VariantsBodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.flatten() });
      return;
    }

    const controller = new AbortController();
    req.on("close", () => controller.abort());

    try {
      const response = await generationQueue.add(
        () =>
          retryWithBackoff(() =>
            adapter.generateVariant(
              {
                combination: parse.data.combination,
                anchorImage: parse.data.anchorImage,
                references: parse.data.references ?? {}
              },
              controller.signal
            )
          ),
        { signal: controller.signal }
      );
      res.json(VariantResponseSchema.parse(response));
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        res.status(499).json({ error: "Request aborted" });
        return;
      }
      next(error);
    }
  });

  return router;
};
