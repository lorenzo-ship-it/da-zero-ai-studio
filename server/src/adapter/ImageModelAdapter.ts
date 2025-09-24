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

type AnalyzeResult = ReturnType<typeof AnalyzeResponseSchema.parse>;
type AssignSlotsResult = ReturnType<typeof AssignSlotsResponseSchema.parse>;
type GenerateResult = ReturnType<typeof GenerateResponseSchema.parse>;
type VariantResult = ReturnType<typeof VariantResponseSchema.parse>;

export interface ImageModelAdapter {
  analyze(imageBase64: string, signal?: AbortSignal): Promise<AnalyzeResult>;
  assignSlots(images: string[], signal?: AbortSignal): Promise<AssignSlotsResult>;
  generate(params: {
    shot: Shot;
    slots: Partial<Record<InputSlot, string>>;
    confirmedCategories: ClothingCategory[];
    correctivePrompts: string[];
    anchorImage?: string;
  }, signal?: AbortSignal): Promise<GenerateResult>;
  generateVariant(params: {
    combination: VariantCombination;
    anchorImage: string;
    references: VariantReferences;
  }, signal?: AbortSignal): Promise<VariantResult>;
}
