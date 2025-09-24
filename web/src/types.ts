export enum ClothingCategory {
  TOP_SHORT_SLEEVE = "Top maniche corte",
  TOP_LONG_SLEEVE = "Top maniche lunghe",
  KNIT = "Maglia",
  HOODIE = "Felpa",
  JACKET = "Giacca",
  PANTS = "Pantalone",
  SKIRT = "Gonna",
  DRESS = "Abito"
}

export const TOP_CATEGORIES = [
  ClothingCategory.TOP_SHORT_SLEEVE,
  ClothingCategory.TOP_LONG_SLEEVE,
  ClothingCategory.KNIT,
  ClothingCategory.HOODIE
] as const;

export const JACKET_CATEGORIES = [ClothingCategory.JACKET] as const;

export const LOWER_BODY_CATEGORIES = [
  ClothingCategory.PANTS,
  ClothingCategory.SKIRT
] as const;

export const DRESS_CATEGORIES = [ClothingCategory.DRESS] as const;

export const isTopCategory = (
  category: ClothingCategory
): category is (typeof TOP_CATEGORIES)[number] =>
  (TOP_CATEGORIES as readonly ClothingCategory[]).includes(category);

export const isJacketCategory = (
  category: ClothingCategory
): category is (typeof JACKET_CATEGORIES)[number] =>
  (JACKET_CATEGORIES as readonly ClothingCategory[]).includes(category);

export const isLowerBodyCategory = (
  category: ClothingCategory
): category is (typeof LOWER_BODY_CATEGORIES)[number] =>
  (LOWER_BODY_CATEGORIES as readonly ClothingCategory[]).includes(category);

export const isDressCategory = (
  category: ClothingCategory
): category is (typeof DRESS_CATEGORIES)[number] =>
  (DRESS_CATEGORIES as readonly ClothingCategory[]).includes(category);

export enum InputSlot {
  FRONT = "front",
  SIDE = "side",
  BACK = "back",
  DETAIL = "detail"
}

export enum ShotCategory {
  FULL_BODY = "FULL_BODY",
  UPPER_BODY_TOP = "UPPER_BODY_TOP",
  UPPER_BODY_JACKET = "UPPER_BODY_JACKET",
  LOWER_BODY = "LOWER_BODY",
  DRESS = "DRESS",
  DETAIL = "DETAIL"
}

type ProductGroup = "TOP" | "JACKET" | "LOWER_BODY" | "DRESS";

export type Shot = {
  id: number;
  description: string;
  shot_category: ShotCategory;
  required_slots: InputSlot[];
  prompt_template: string;
  relevant_categories?: ProductGroup[];
};

export type GeneratedImage = {
  id_prompt: number;
  image: string;
  filename: string;
  products: string[];
  variantName?: string;
};

export type ColorVariantRequest = {
  id: string;
  name: string;
  references: Partial<Record<ClothingCategory, string>>;
};

export type GenerationCombination = {
  id: string;
  name: string;
  selection: Partial<Record<ProductGroup, string>>;
};

export enum OutfitStatus {
  CONFIGURING = "CONFIGURING",
  ANALYZING = "ANALYZING",
  COMPLETING_OUTFIT = "COMPLETING_OUTFIT",
  CATEGORIES_DETECTED = "CATEGORIES_DETECTED",
  QUEUED = "QUEUED",
  GENERATING = "GENERATING",
  PAUSED = "PAUSED",
  COMPLETED = "COMPLETED",
  STOPPED = "STOPPED",
  ERROR = "ERROR"
}

export type Outfit = {
  id: string;
  name: string;
  status: OutfitStatus;
  initialImage: string | null;
  detectedCategories: ClothingCategory[];
  confirmedCategories: Set<ClothingCategory>;
  slots: Partial<Record<InputSlot, string>>;
  shotQueue: Shot[];
  currentShotIndex: number;
  generatedImages: GeneratedImage[];
  correctivePrompts: string[];
  errorMessage: string | null;
  colorVariantStep: "idle" | "configuring" | "generating" | "completed" | "error";
  colorVariantRequests: ColorVariantRequest[];
  colorVariantCombinations: GenerationCombination[];
  generatedColorVariants: Record<string, GeneratedImage[]>;
  colorVariantError: string | null;
};

export const enum StorageKeys {
  OUTFITS = "ai-fashion-studio:outfits:v1"
}

export type HealthResponse = {
  status: "ok";
};
