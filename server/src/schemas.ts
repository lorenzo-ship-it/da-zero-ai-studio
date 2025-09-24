import { z } from "zod";

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
export const LOWER_BODY_CATEGORIES = [ClothingCategory.PANTS, ClothingCategory.SKIRT] as const;
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

const ProductGroupSchema = z.union([
  z.literal("TOP"),
  z.literal("JACKET"),
  z.literal("LOWER_BODY"),
  z.literal("DRESS")
]);

export const ShotSchema = z.object({
  id: z.number().int(),
  description: z.string(),
  shot_category: z.nativeEnum(ShotCategory),
  required_slots: z.array(z.nativeEnum(InputSlot)),
  prompt_template: z.string(),
  relevant_categories: z.array(ProductGroupSchema).optional()
});

export type Shot = z.infer<typeof ShotSchema>;

export const AnalyzeBodySchema = z.object({
  imageBase64: z.string().min(10)
});

export const AnalyzeResponseSchema = z.object({
  categories: z.array(z.nativeEnum(ClothingCategory)),
  confidence: z.number().min(0).max(1),
  notes: z.string().optional()
});

export const AssignSlotsBodySchema = z.object({
  images: z.array(z.string().min(10))
});

export const AssignSlotsResponseSchema = z.object({
  slots: z
    .record(z.nativeEnum(InputSlot), z.number().int().nonnegative())
    .partial()
});

export const QueueShotsBodySchema = z.object({
  confirmed: z.array(z.nativeEnum(ClothingCategory))
});

export const QueueShotsResponseSchema = z.object({
  shots: z.array(ShotSchema)
});

export const GenerateBodySchema = z.object({
  shot: ShotSchema,
  slots: z.record(z.nativeEnum(InputSlot), z.string().min(10)).partial(),
  confirmedCategories: z.array(z.nativeEnum(ClothingCategory)),
  correctivePrompts: z.array(z.string()),
  anchorImage: z.string().min(10).optional()
});

export const GenerateResponseSchema = z.object({
  imageBase64: z.string().min(10)
});

export const VariantCombinationSchema = z.object({
  id: z.string(),
  name: z.string(),
  selection: z.record(ProductGroupSchema, z.string()).partial()
});

export type VariantCombination = z.infer<typeof VariantCombinationSchema>;

export const VariantReferencesSchema = z
  .record(z.nativeEnum(ClothingCategory), z.string().min(10))
  .partial();

export type VariantReferences = z.infer<typeof VariantReferencesSchema>;

export const VariantsBodySchema = z.object({
  combination: VariantCombinationSchema,
  anchorImage: z.string().min(10),
  references: VariantReferencesSchema
});

export const VariantResponseSchema = z.array(
  z.object({
    imageBase64: z.string().min(10),
    filename: z.string(),
    products: z.array(z.string()),
    variantName: z.string().optional()
  })
);

export const NEGATIVE_PROMPT =
  "text watermark, distorted anatomy, duplicated limbs, asymmetric hands, incorrect brand logos, motion blur, over-smoothing, misaligned buttons, unrealistic textures";

export const buildShotQueue = (confirmed: ClothingCategory[]): Shot[] => {
  let shotId = 1;
  const createShot = (shot: Omit<Shot, "id">): Shot => ({ id: shotId++, ...shot });

  const queue: Shot[] = [];
  const hasTop = confirmed.some((category) => isTopCategory(category));
  const hasJacket = confirmed.some((category) => isJacketCategory(category));
  const hasLowerBody = confirmed.some((category) => isLowerBodyCategory(category));
  const hasDress = confirmed.some((category) => isDressCategory(category));

  if ((hasTop && hasLowerBody) || hasDress) {
    queue.push(
      createShot({
        description: "Full body front shot",
        shot_category: ShotCategory.FULL_BODY,
        required_slots: [InputSlot.FRONT],
        prompt_template:
          "Studio, soft directional light, neutral seamless background, premium editorial aesthetic. {reference_hint}. Negative prompt: {negative_prompt}",
        relevant_categories: hasDress ? ["DRESS"] : ["TOP", "LOWER_BODY"]
      })
    );
  }

  if (hasTop || hasDress) {
    queue.push(
      createShot({
        description: "Upper body focus",
        shot_category: ShotCategory.UPPER_BODY_TOP,
        required_slots: [InputSlot.FRONT],
        prompt_template:
          "Studio, soft directional light, neutral seamless background, premium editorial aesthetic. {reference_hint}. Negative prompt: {negative_prompt}",
        relevant_categories: hasDress ? ["DRESS"] : ["TOP"]
      })
    );
  }

  if (hasJacket) {
    queue.push(
      createShot({
        description: "Upper body jacket emphasis",
        shot_category: ShotCategory.UPPER_BODY_JACKET,
        required_slots: [InputSlot.FRONT, InputSlot.SIDE],
        prompt_template:
          "Studio, soft directional light, neutral seamless background, premium editorial aesthetic. {reference_hint}. Negative prompt: {negative_prompt}",
        relevant_categories: ["JACKET"]
      })
    );
  }

  if (hasLowerBody || hasDress) {
    queue.push(
      createShot({
        description: "Lower body detail",
        shot_category: ShotCategory.LOWER_BODY,
        required_slots: [InputSlot.FRONT, InputSlot.SIDE],
        prompt_template:
          "Studio, soft directional light, neutral seamless background, premium editorial aesthetic. {reference_hint}. Negative prompt: {negative_prompt}",
        relevant_categories: hasDress ? ["DRESS"] : ["LOWER_BODY"]
      })
    );
  }

  const detailCount = hasJacket ? 3 : 2;
  for (let index = 0; index < detailCount; index += 1) {
    queue.push(
      createShot({
        description: `Detail shot ${index + 1}`,
        shot_category: ShotCategory.DETAIL,
        required_slots: [InputSlot.DETAIL],
        prompt_template:
          "Studio, soft directional light, neutral seamless background, premium editorial aesthetic. {reference_hint}. Negative prompt: {negative_prompt}",
        relevant_categories: ["TOP", "JACKET", "LOWER_BODY", "DRESS"]
      })
    );
  }

  return queue.map((shot, index) => ({
    ...shot,
    prompt_template: shot.prompt_template
      .replace("{reference_hint}", "Preserve the model identity, garment proportions, and background mood to match the anchor shot.")
      .replace("{negative_prompt}", NEGATIVE_PROMPT)
      .concat(` // Shot ${index + 1}`)
  }));
};
