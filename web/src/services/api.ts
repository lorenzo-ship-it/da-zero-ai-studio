import { z } from "zod";
import {
  ClothingCategory,
  ColorVariantRequest,
  GenerationCombination,
  GeneratedImage,
  InputSlot,
  Outfit,
  Shot
} from "@/types";

const AnalyzeResponseSchema = z.object({
  categories: z.nativeEnum(ClothingCategory).array(),
  confidence: z.number().min(0).max(1),
  notes: z.string().optional()
});

export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

const AssignSlotsResponseSchema = z.object({
  slots: z.record(z.nativeEnum(InputSlot), z.number().int().nonnegative()).partial()
});

export type AssignSlotsResponse = z.infer<typeof AssignSlotsResponseSchema>;

const QueueShotsResponseSchema = z.object({
  shots: z
    .object({
      id: z.number().int(),
      description: z.string(),
      shot_category: z.string(),
      required_slots: z.nativeEnum(InputSlot).array(),
      prompt_template: z.string(),
      relevant_categories: z.array(z.string()).optional()
    })
    .array()
});

export type QueueShotsResponse = z.infer<typeof QueueShotsResponseSchema>;

const GenerateResponseSchema = z.object({
  imageBase64: z.string().min(10)
});

export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;

const VariantResponseSchema = z.array(
  z.object({
    imageBase64: z.string().min(10),
    filename: z.string().min(3),
    products: z.array(z.string()),
    variantName: z.string().optional()
  })
);

export type VariantResponse = z.infer<typeof VariantResponseSchema>;

const jsonHeaders = {
  "Content-Type": "application/json"
};

export const analyzeOutfit = async (imageBase64: string) => {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ imageBase64 })
  });

  const json = await response.json();
  return AnalyzeResponseSchema.parse(json);
};

export const assignSlots = async (images: string[]) => {
  const response = await fetch("/api/assign-slots", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ images })
  });
  const json = await response.json();
  return AssignSlotsResponseSchema.parse(json);
};

export const queueShots = async (confirmed: ClothingCategory[]) => {
  const response = await fetch("/api/queue-shots", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ confirmed })
  });
  const json = await response.json();
  return QueueShotsResponseSchema.parse(json).shots as Shot[];
};

export const generateShot = async (
  payload: {
    shot: Shot;
    slots: Partial<Record<InputSlot, string>>;
    confirmedCategories: ClothingCategory[];
    correctivePrompts: string[];
    anchorImage?: string;
  },
  signal?: AbortSignal
) => {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: jsonHeaders,
    signal,
    body: JSON.stringify(payload)
  });
  const json = await response.json();
  return GenerateResponseSchema.parse(json);
};

export const generateVariants = async (
  payload: {
    combination: GenerationCombination;
    anchorImage: string;
    references: ColorVariantRequest["references"];
  },
  signal?: AbortSignal
) => {
  const response = await fetch("/api/variants", {
    method: "POST",
    headers: jsonHeaders,
    signal,
    body: JSON.stringify(payload)
  });
  const json = await response.json();
  return VariantResponseSchema.parse(json) as GeneratedImage[];
};

export const persistOutfits = (outfits: Outfit[]) => {
  localStorage.setItem("ai-fashion-studio:outfits:v1", JSON.stringify(outfits));
};

export const loadOutfits = (): Outfit[] => {
  const raw = localStorage.getItem("ai-fashion-studio:outfits:v1");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Outfit[];
    return parsed.map((outfit) => ({
      ...outfit,
      confirmedCategories: new Set(outfit.confirmedCategories)
    }));
  } catch (error) {
    console.warn("Unable to parse persisted outfits", error);
    return [];
  }
};
