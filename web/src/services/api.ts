import { z } from "zod";
import {
  ClothingCategory,
  ColorVariantRequest,
  GenerationCombination,
  GeneratedImage,
  InputSlot,
  Outfit,
  Shot,
  StorageKeys,
  OutfitStatus
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

type PersistedOutfit = Omit<Outfit, "confirmedCategories"> & {
  confirmedCategories: ClothingCategory[];
};

const isBrowserEnvironment =
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const safeGetItem = (key: StorageKeys): string | null => {
  if (!isBrowserEnvironment) {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn("Unable to read from localStorage", error);
    return null;
  }
};

const safeSetItem = (key: StorageKeys, value: string) => {
  if (!isBrowserEnvironment) {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn("Unable to write to localStorage", error);
  }
};

const safeRemoveItem = (key: StorageKeys) => {
  if (!isBrowserEnvironment) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn("Unable to remove localStorage item", error);
  }
};

const validCategories = new Set(Object.values(ClothingCategory));

const toCategoryArray = (value: unknown): ClothingCategory[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is ClothingCategory =>
    validCategories.has(item as ClothingCategory)
  );
};

const sanitizeSlots = (
  value: unknown
): Partial<Record<InputSlot, string>> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  const slotEntries = Object.entries(value as Record<string, unknown>);
  const slotSet = new Set(Object.values(InputSlot));

  return Object.fromEntries(
    slotEntries.filter(
      ([key, slotValue]) => slotSet.has(key as InputSlot) && typeof slotValue === "string"
    )
  ) as Partial<Record<InputSlot, string>>;
};

const isValidOutfitStatus = (value: unknown): value is OutfitStatus =>
  typeof value === "string" && Object.values(OutfitStatus).includes(value as OutfitStatus);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const validColorVariantSteps = new Set<Outfit["colorVariantStep"]>([
  "idle",
  "configuring",
  "generating",
  "completed",
  "error"
]);

const toColorVariantStep = (value: unknown): Outfit["colorVariantStep"] =>
  typeof value === "string" && validColorVariantSteps.has(value as Outfit["colorVariantStep"])
    ? (value as Outfit["colorVariantStep"])
    : "idle";

const sanitizeGeneratedColorVariants = (
  value: unknown
): Record<string, GeneratedImage[]> => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, images]) => Array.isArray(images))
  ) as Record<string, GeneratedImage[]>;
};

export const persistOutfits = (outfits: Outfit[]) => {
  if (!isBrowserEnvironment) {
    return;
  }

  const serializable: PersistedOutfit[] = outfits.map((outfit) => ({
    ...outfit,
    confirmedCategories: Array.from(outfit.confirmedCategories)
  }));

  safeSetItem(StorageKeys.OUTFITS, JSON.stringify(serializable));
};

export const loadOutfits = (): Outfit[] => {
  if (!isBrowserEnvironment) {
    return [];
  }

  const raw = safeGetItem(StorageKeys.OUTFITS);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is PersistedOutfit => isRecord(item))
      .map((outfit) => ({
        ...outfit,
        status: isValidOutfitStatus(outfit.status) ? outfit.status : OutfitStatus.CONFIGURING,
        detectedCategories: toCategoryArray(outfit.detectedCategories),
        confirmedCategories: new Set(toCategoryArray(outfit.confirmedCategories)),
        slots: sanitizeSlots(outfit.slots),
        shotQueue: Array.isArray(outfit.shotQueue) ? outfit.shotQueue : [],
        currentShotIndex:
          typeof outfit.currentShotIndex === "number" ? outfit.currentShotIndex : 0,
        generatedImages: Array.isArray(outfit.generatedImages) ? outfit.generatedImages : [],
        correctivePrompts: Array.isArray(outfit.correctivePrompts)
          ? outfit.correctivePrompts
          : [],
        errorMessage: typeof outfit.errorMessage === "string" ? outfit.errorMessage : null,
        colorVariantStep: toColorVariantStep(outfit.colorVariantStep),
        colorVariantRequests: Array.isArray(outfit.colorVariantRequests)
          ? outfit.colorVariantRequests
          : [],
        colorVariantCombinations: Array.isArray(outfit.colorVariantCombinations)
          ? outfit.colorVariantCombinations
          : [],
        generatedColorVariants: sanitizeGeneratedColorVariants(outfit.generatedColorVariants),
        colorVariantError:
          typeof outfit.colorVariantError === "string" ? outfit.colorVariantError : null
      }));
  } catch (error) {
    console.warn("Unable to parse persisted outfits", error);
    safeRemoveItem(StorageKeys.OUTFITS);
    return [];
  }
};
