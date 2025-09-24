import { GeneratedImage, Shot } from "@/types";

const pad = (value: number) => value.toString().padStart(2, "0");

export const buildFilename = (params: {
  outfitIndex: number;
  shot: Shot;
  products: string[];
  variant?: string;
}): string => {
  const slug = params.shot.description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  const variant = params.variant ?? "original";
  const productsSlug = params.products
    .map((product) => product.replace(/\s+/g, "-"))
    .join("-")
    .toLowerCase();

  return `OUTFIT-${pad(params.outfitIndex)}_${pad(params.shot.id)}-${slug}_${productsSlug}_${variant}.jpg`;
};

export const mapGeneratedImage = (params: {
  outfitIndex: number;
  shot: Shot;
  imageBase64: string;
  products: string[];
  variant?: string;
}): GeneratedImage => ({
  id_prompt: params.shot.id,
  image: params.imageBase64,
  filename: buildFilename(params),
  products: params.products,
  variantName: params.variant
});
