import {
  ClothingCategory,
  InputSlot,
  Shot,
  ShotCategory,
  isDressCategory,
  isJacketCategory,
  isLowerBodyCategory,
  isTopCategory
} from "@/types";

let shotIdCounter = 1;

const promptBase =
  "Studio, soft directional light, neutral seamless background, premium editorial aesthetic.";
const referenceHint =
  "Preserve the model identity, garment proportions, and background mood to match the anchor shot.";
const negativePrompt =
  "NEGATIVE_PROMPT: text watermark, disfigured limbs, extra arms, missing fingers, distorted fabric, incorrect logos, motion blur, deformed feet, duplicated garments";

const nextShotId = () => shotIdCounter++;

const createShot = (params: Omit<Shot, "id">): Shot => ({
  id: nextShotId(),
  ...params
});

export const resetShotCounter = () => {
  shotIdCounter = 1;
};

export const buildShotQueue = (confirmed: ClothingCategory[]): Shot[] => {
  resetShotCounter();
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
        prompt_template: `${promptBase} {model_style}, ${referenceHint}. {reference_hint}. {negative_prompt}`,
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
        prompt_template: `${promptBase} Tight composition highlighting upper garment. {reference_hint}. {negative_prompt}`,
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
        prompt_template: `${promptBase} Showcase jacket structure and detailing. {reference_hint}. {negative_prompt}`,
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
        prompt_template: `${promptBase} Focus on lower garment drape and fit. {reference_hint}. {negative_prompt}`,
        relevant_categories: hasDress ? ["DRESS"] : ["LOWER_BODY"]
      })
    );
  }

  const detailShotsCount = hasJacket ? 3 : 2;
  for (let index = 0; index < detailShotsCount; index += 1) {
    queue.push(
      createShot({
        description: `Detail shot ${index + 1}`,
        shot_category: ShotCategory.DETAIL,
        required_slots: [InputSlot.DETAIL],
        prompt_template: `${promptBase} Macro detail of fabric and finishing. {reference_hint}. {negative_prompt}`,
        relevant_categories: ["TOP", "JACKET", "LOWER_BODY", "DRESS"]
      })
    );
  }

  return queue.map((shot, shotIndex) => ({
    ...shot,
    prompt_template: shot.prompt_template
      .replace("{reference_hint}", referenceHint)
      .replace("{negative_prompt}", negativePrompt)
      .replace("{model_style}", "Premium editorial model, confident pose")
      .replace("{lighting}", "Soft studio lighting")
      .replace("{background_style}", "Neutral gradient backdrop")
      .replace("{shotIndex}", String(shotIndex + 1))
  }));
};
