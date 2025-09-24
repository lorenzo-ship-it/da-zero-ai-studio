import crypto from "node:crypto";
import {
  AnalyzeResponseSchema,
  AssignSlotsResponseSchema,
  ClothingCategory,
  GenerateResponseSchema,
  InputSlot,
  Shot,
  VariantCombination,
  VariantReferences,
  VariantResponseSchema
} from "../schemas";
import { ImageModelAdapter } from "./ImageModelAdapter";

const pickCategories = (imageBase64: string): ClothingCategory[] => {
  const hash = crypto.createHash("sha256").update(imageBase64).digest();
  const categories = Object.values(ClothingCategory);
  const first = hash[0] % categories.length;
  const second = hash[1] % categories.length;
  const result = new Set<ClothingCategory>([categories[first], categories[second]]);
  return Array.from(result);
};

const mapSlots = (images: string[]) => {
  const keys = [InputSlot.FRONT, InputSlot.SIDE, InputSlot.BACK, InputSlot.DETAIL];
  const entries = keys
    .map((slot, index) => [slot, index] as const)
    .filter(([, index]) => index < images.length);
  return Object.fromEntries(entries) as Partial<Record<InputSlot, number>>;
};

const fakeBase64 = (seed: string) => Buffer.from(`Generated:${seed}`).toString("base64");

export class MockModelAdapter implements ImageModelAdapter {
  async analyze(imageBase64: string) {
    const categories = pickCategories(imageBase64);
    return AnalyzeResponseSchema.parse({
      categories,
      confidence: 0.9,
      notes: "Mock classification"
    });
  }

  async assignSlots(images: string[]) {
    const slots = mapSlots(images);
    return AssignSlotsResponseSchema.parse({ slots });
  }

  async generate(
    params: {
      shot: Shot;
      slots: Partial<Record<InputSlot, string>>;
      confirmedCategories: ClothingCategory[];
      correctivePrompts: string[];
      anchorImage?: string;
    },
    _signal?: AbortSignal
  ) {
    const payload = `${params.shot.description}:${params.confirmedCategories.join(",")}:${params.correctivePrompts.join(",")}`;
    return GenerateResponseSchema.parse({ imageBase64: fakeBase64(payload) });
  }

  async generateVariant(
    params: {
      combination: VariantCombination;
      anchorImage: string;
      references: VariantReferences;
    },
    _signal?: AbortSignal
  ) {
    const imageBase64 = fakeBase64(
      `${params.combination.name}:${Object.keys(params.references).join("-")}`
    );
    return VariantResponseSchema.parse([
      {
        imageBase64,
        filename: `${params.combination.name.replace(/\s+/g, "_")}.jpg`,
        products: Object.keys(params.references),
        variantName: params.combination.name
      }
    ]);
  }
}
