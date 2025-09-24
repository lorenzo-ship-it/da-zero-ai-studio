import { ImageModelAdapter } from "./ImageModelAdapter";
import {
  AnalyzeResponseSchema,
  AssignSlotsResponseSchema,
  ClothingCategory,
  GenerateResponseSchema,
  InputSlot,
  NEGATIVE_PROMPT,
  Shot,
  VariantCombination,
  VariantReferences,
  VariantResponseSchema
} from "../schemas";
import { fetch } from "undici";

const GEMINI_MODEL = "gemini-2.5-flash-image-preview";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const JSON_ATTEMPTS = 2;

const ANALYZE_SCHEMA_SHAPE =
  '{"categories": ClothingCategory[], "confidence": number (0-1), "notes"?: string}';
const ASSIGN_SCHEMA_SHAPE =
  '{"slots": {"front"?: number, "side"?: number, "back"?: number, "detail"?: number}}';

const ANALYZE_SYSTEM_PROMPT = `You are a senior fashion product classifier. Inspect garments precisely and output strict JSON.
Categories available:
- Top maniche corte: short-sleeved tops or t-shirts stopping above elbow.
- Top maniche lunghe: tops or shirts with sleeves covering the forearm.
- Maglia: knitted sweaters or pullovers.
- Felpa: hoodies or sweatshirts with ribbed cuffs or hood.
- Giacca: structured outerwear like blazers, trenches, leather jackets.
- Pantalone: trousers, jeans, leggings covering the legs individually.
- Gonna: skirts covering lower body without separating legs.
- Abito: one-piece dresses joining top and bottom; do not also label as top+bottom.
Rules: choose only what is visible. Dresses supersede tops/skirts. If uncertain use notes and reduce confidence.
Few-shot guidance:
- Example 1 (Felpa vs Giacca): Input shows a soft sweatshirt with ribbed cuffs and kangaroo pocket. Output -> {"categories":["Felpa"],"confidence":0.9,"notes":"Zip hoodie, not a jacket"}.
- Example 2 (Abito vs combinazione top+gonna): Input shows a single-piece dress with continuous fabric from bodice to skirt. Output -> {"categories":["Abito"],"confidence":0.92}.
- Example 3 (Giacca): Input shows a structured blazer layered over a blouse. Output -> {"categories":["Giacca","Top maniche lunghe"],"confidence":0.88,"notes":"Blazer over shirt"}.
Return ONLY JSON matching ${ANALYZE_SCHEMA_SHAPE}.`;

const ASSIGN_SYSTEM_PROMPT = `Assign garment photos to canonical slots. Exactly match JSON schema ${ASSIGN_SCHEMA_SHAPE}.
Guidelines:
- Front shows the outfit from the front.
- Side shows a profile view.
- Back shows the garment from behind.
- Detail shows close-ups of materials or accessories.
Prefer the clearest option when duplicates exist. Leave slots undefined if image missing.`;

const GENERATION_SYSTEM_PROMPT = `You are an expert AI fashion photographer. Produce editorial, high consistency imagery following reference photos, maintaining garment proportions, identity and styling cues.`;

const VARIANT_SYSTEM_PROMPT = `You generate fashion color and print variants. Keep poses, lighting and styling aligned with the anchor while applying requested variant accents precisely.`;

type Part =
  | { text: string }
  | { inlineData: { data: string; mimeType: string } };

type Content = {
  role: "user" | "model" | "system";
  parts: Part[];
};

type GenerationConfig = {
  temperature?: number;
  maxOutputTokens?: number;
  responseModalities?: ("TEXT" | "IMAGE")[];
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Part[];
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
};

const sanitizeJson = (raw: string) =>
  raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

const extractText = (response: GeminiResponse): string => {
  const candidate = response.candidates?.[0];
  if (!candidate?.content?.parts?.length) {
    throw new Error("Gemini response missing text candidate");
  }
  return candidate.content.parts
    .filter((part): part is { text: string } => "text" in part && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
};

const extractInlineImages = (response: GeminiResponse) => {
  const candidate = response.candidates?.[0];
  if (!candidate?.content?.parts) {
    throw new Error("Gemini response missing image candidate");
  }
  return candidate.content.parts
    .filter((part): part is { inlineData: { data: string; mimeType: string } } =>
      "inlineData" in part && !!part.inlineData?.data
    )
    .map((part) => part.inlineData);
};

const detectMimeType = (base64: string): string => {
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return "image/png";
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "variant";

export class GeminiModelAdapter implements ImageModelAdapter {
  private readonly apiKey: string;

  constructor(apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY) {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) environment variable is required");
    }
    this.apiKey = apiKey;
  }

  private async generateContent(
    body: {
      systemInstruction?: Content;
      contents: Content[];
      generationConfig?: GenerationConfig;
    },
    signal?: AbortSignal
  ): Promise<GeminiResponse> {
    const response = await fetch(
      `${BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Gemini API error (${response.status}): ${errorBody.slice(0, 400)}`
      );
    }

    const json = (await response.json()) as GeminiResponse;
    if (json.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked the prompt: ${json.promptFeedback.blockReason}`);
    }
    if (!json.candidates?.length) {
      throw new Error("Gemini returned no candidates");
    }
    return json;
  }

  private buildImageParts(
    header: string,
    images: Array<{ label: string; base64: string }>
  ): Part[] {
    const parts: Part[] = [{ text: header }];
    images.forEach(({ label, base64 }) => {
      parts.push({ text: label });
      parts.push({ inlineData: { data: base64, mimeType: detectMimeType(base64) } });
    });
    return parts;
  }

  private async generateJsonWithRetries<T>(
    params: {
      systemPrompt: string;
      baseParts: Part[];
      schema: { parse: (value: unknown) => T };
      schemaShape: string;
    },
    signal?: AbortSignal
  ): Promise<T> {
    let extraInstruction = "";
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < JSON_ATTEMPTS; attempt += 1) {
      const parts = [...params.baseParts];
      if (extraInstruction) {
        parts.push({ text: extraInstruction });
      }

      const response = await this.generateContent(
        {
          systemInstruction: {
            role: "system",
            parts: [{ text: params.systemPrompt }]
          },
          contents: [
            {
              role: "user",
              parts
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 600,
            responseModalities: ["TEXT"]
          }
        },
        signal
      );

      try {
        const text = sanitizeJson(extractText(response));
        const json = JSON.parse(text);
        return params.schema.parse(json);
      } catch (error) {
        lastError = error as Error;
        extraInstruction = `The previous response was invalid JSON. Respond again with ONLY valid JSON adhering to ${params.schemaShape}.`;
      }
    }

    throw new Error(
      `Unable to parse Gemini JSON response after ${JSON_ATTEMPTS} attempts: ${lastError?.message}`
    );
  }

  async analyze(imageBase64: string, signal?: AbortSignal) {
    const baseParts: Part[] = [
      ...this.buildImageParts(
        "Classify the primary garment categories present in this image.",
        [
          {
            label: "Garment reference image:",
            base64: imageBase64
          }
        ]
      )
    ];

    return this.generateJsonWithRetries(
      {
        systemPrompt: ANALYZE_SYSTEM_PROMPT,
        baseParts,
        schema: AnalyzeResponseSchema,
        schemaShape: ANALYZE_SCHEMA_SHAPE
      },
      signal
    );
  }

  async assignSlots(images: string[], signal?: AbortSignal) {
    const labelled = images.map((base64, index) => ({
      label: `Image ${index + 1}:`,
      base64
    }));

    const parts = this.buildImageParts(
      "Assign each reference to front, side, back or detail.",
      labelled
    );

    return this.generateJsonWithRetries(
      {
        systemPrompt: ASSIGN_SYSTEM_PROMPT,
        baseParts: parts,
        schema: AssignSlotsResponseSchema,
        schemaShape: ASSIGN_SCHEMA_SHAPE
      },
      signal
    );
  }

  async generate(
    params: {
      shot: Shot;
      slots: Partial<Record<InputSlot, string>>;
      confirmedCategories: ClothingCategory[];
      correctivePrompts: string[];
      anchorImage?: string;
    },
    signal?: AbortSignal
  ) {
    const { shot, slots, confirmedCategories, correctivePrompts, anchorImage } = params;

    const parts: Part[] = [
      {
        text: [
          `Create a high fidelity fashion photograph for shot "${shot.description}" (category: ${shot.shot_category}).`,
          `Confirmed garments: ${confirmedCategories.join(", ") || "nessuna"}.`,
          `Prompt template: ${shot.prompt_template}.`,
          correctivePrompts.length
            ? `Incorporate corrective prompts: ${correctivePrompts.join("; ")}.`
            : "No corrective prompts provided.",
          "Maintain consistent identity, pose, lighting and background with references.",
          `Avoid: ${NEGATIVE_PROMPT}.`
        ].join("\n")
      }
    ];

    const referenceImages: Array<{ label: string; base64: string }> = [];
    if (anchorImage) {
      referenceImages.push({
        label: "Anchor shot for identity and styling:",
        base64: anchorImage
      });
    }

    Object.entries(slots).forEach(([slot, base64]) => {
      if (!base64) return;
      referenceImages.push({
        label: `Reference for slot ${slot}:`,
        base64
      });
    });

    if (referenceImages.length) {
      parts.push(...this.buildImageParts("Reference imagery:", referenceImages));
    }

    const response = await this.generateContent(
      {
        systemInstruction: {
          role: "system",
          parts: [{ text: GENERATION_SYSTEM_PROMPT }]
        },
        contents: [
          {
            role: "user",
            parts
          }
        ],
        generationConfig: {
          temperature: 0.35,
          responseModalities: ["IMAGE"],
          maxOutputTokens: 1024
        }
      },
      signal
    );

    const [image] = extractInlineImages(response);
    if (!image) {
      throw new Error("Gemini did not return an image for generation request");
    }

    return GenerateResponseSchema.parse({ imageBase64: image.data });
  }

  async generateVariant(
    params: {
      combination: VariantCombination;
      anchorImage: string;
      references: VariantReferences;
    },
    signal?: AbortSignal
  ) {
    const productList = Object.keys(params.references ?? {}) as ClothingCategory[];
    const variantName = params.combination.name || "Variant";

    const description = [
      `Create a color/print variant for ${variantName}.`,
      productList.length
        ? `Products to adjust: ${productList.join(", ")}.`
        : "Adjust garments consistently using creative judgement.",
      "Retain fit, proportions, lighting and background continuity from the anchor image.",
      `Avoid: ${NEGATIVE_PROMPT}.`
    ].join("\n");

    const parts: Part[] = [
      { text: description },
      ...this.buildImageParts("Anchor image:", [
        {
          label: "Anchor reference:",
          base64: params.anchorImage
        }
      ])
    ];

    const referenceEntries = Object.entries(params.references ?? {}) as Array<[
      ClothingCategory,
      string
    ]>;

    if (referenceEntries.length) {
      parts.push(
        ...this.buildImageParts(
          "Color and print references per garment:",
          referenceEntries.map(([category, base64]) => ({
            label: `${category} reference:`,
            base64
          }))
        )
      );
    }

    const response = await this.generateContent(
      {
        systemInstruction: {
          role: "system",
          parts: [{ text: VARIANT_SYSTEM_PROMPT }]
        },
        contents: [
          {
            role: "user",
            parts
          }
        ],
        generationConfig: {
          temperature: 0.4,
          responseModalities: ["IMAGE"],
          maxOutputTokens: 1024
        }
      },
      signal
    );

    const [image] = extractInlineImages(response);
    if (!image) {
      throw new Error("Gemini did not return an image for variant request");
    }

    const filename = `OUTFIT-${slugify(params.combination.id)}_${slugify(
      variantName
    )}_${productList.map((product) => slugify(product)).join("-") || "look"}.jpg`;

    return VariantResponseSchema.parse([
      {
        imageBase64: image.data,
        filename,
        products: productList.length ? productList : ["Outfit"],
        variantName
      }
    ]);
  }
}
