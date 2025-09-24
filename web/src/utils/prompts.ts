export const NEGATIVE_PROMPT =
  "text watermark, distorted anatomy, duplicated limbs, asymmetric hands, incorrect brand logos, motion blur, over-smoothing, misaligned buttons, unrealistic textures";

export const composePrompt = (base: string, extras?: string[]) => {
  const segments = [base, "Studio, soft directional lighting", "Neutral gradient background"];
  if (extras && extras.length > 0) {
    segments.push(...extras);
  }
  segments.push(`Negative prompt: ${NEGATIVE_PROMPT}`);
  return segments.join(", ");
};
