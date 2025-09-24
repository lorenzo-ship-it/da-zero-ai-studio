import { create } from "zustand";
import {
  ClothingCategory,
  ColorVariantRequest,
  GenerationCombination,
  GeneratedImage,
  InputSlot,
  Outfit,
  OutfitStatus,
  Shot
} from "@/types";
import { queueShots, loadOutfits, persistOutfits } from "@/services/api";
import { buildShotQueue } from "@/utils/shotBuilder";

export type BackendStatus = "unknown" | "online" | "degraded" | "offline";

export type OutfitStore = {
  outfits: Outfit[];
  backendStatus: BackendStatus;
  addOutfit: (outfit: Outfit) => void;
  updateOutfit: (id: string, update: Partial<Outfit>) => void;
  setBackendStatus: (status: BackendStatus) => void;
  enqueueShots: (id: string) => Promise<void>;
  updateSlots: (id: string, slots: Partial<Record<InputSlot, string>>) => void;
  addGeneratedImage: (id: string, image: GeneratedImage) => void;
  setColorVariants: (
    id: string,
    data: {
      requests: ColorVariantRequest[];
      combinations: GenerationCombination[];
    }
  ) => void;
  setShotQueue: (id: string, shots: Shot[]) => void;
};

const createOutfitUpdater = (
  setWithPersist: (updater: (state: OutfitStore) => OutfitStore) => void
) =>
  (id: string, update: Partial<Outfit>) => {
    setWithPersist((state) => ({
      ...state,
      outfits: state.outfits.map((outfit) =>
        outfit.id === id
          ? {
              ...outfit,
              ...update,
              confirmedCategories: update.confirmedCategories
                ? new Set(update.confirmedCategories)
                : outfit.confirmedCategories
            }
          : outfit
      )
    }));
  };

export const useOutfitStore = create<OutfitStore>((set, get) => {
  const setWithPersist = (updater: (state: OutfitStore) => OutfitStore) => {
    set((state) => {
      const nextState = updater(state);
      persistOutfits(nextState.outfits);
      return nextState;
    });
  };

  return {
    outfits: loadOutfits(),
    backendStatus: "unknown",
    addOutfit: (outfit) =>
      setWithPersist((state) => ({
        ...state,
        outfits: [...state.outfits, outfit]
      })),
    updateOutfit: createOutfitUpdater(setWithPersist),
    setBackendStatus: (status) => set((state) => ({ ...state, backendStatus: status })),
    enqueueShots: async (id: string) => {
      const outfit = get().outfits.find((item) => item.id === id);
      if (!outfit) return;

      const confirmed = Array.from(outfit.confirmedCategories);
      let shots = buildShotQueue(confirmed);

      try {
        const serverShots = await queueShots(confirmed);
        shots = serverShots.length > 0 ? serverShots : shots;
      } catch (error) {
        console.warn("Falling back to client shot queue", error);
      }

      setWithPersist((state) => ({
        ...state,
        outfits: state.outfits.map((item) =>
          item.id === id
            ? {
                ...item,
                shotQueue: shots,
                status: OutfitStatus.QUEUED
              }
            : item
        )
      }));
    },
    updateSlots: (id, slots) =>
      setWithPersist((state) => ({
        ...state,
        outfits: state.outfits.map((outfit) =>
          outfit.id === id
            ? {
                ...outfit,
                slots: {
                  ...outfit.slots,
                  ...slots
                }
              }
            : outfit
        )
      })),
    addGeneratedImage: (id, image) =>
      setWithPersist((state) => ({
        ...state,
        outfits: state.outfits.map((outfit) =>
          outfit.id === id
            ? {
                ...outfit,
                generatedImages: [...outfit.generatedImages, image]
              }
            : outfit
        )
      })),
    setColorVariants: (id, data) =>
      setWithPersist((state) => ({
        ...state,
        outfits: state.outfits.map((outfit) =>
          outfit.id === id
            ? {
                ...outfit,
                colorVariantRequests: data.requests,
                colorVariantCombinations: data.combinations
              }
            : outfit
        )
      })),
    setShotQueue: (id, shots) =>
      setWithPersist((state) => ({
        ...state,
        outfits: state.outfits.map((outfit) =>
          outfit.id === id
            ? {
                ...outfit,
                shotQueue: shots
              }
            : outfit
        )
      }))
  };
});

export const createEmptyOutfit = (params: {
  id: string;
  name: string;
  initialImage: string | null;
  detectedCategories: ClothingCategory[];
  confirmedCategories?: Iterable<ClothingCategory>;
}): Outfit => ({
  id: params.id,
  name: params.name,
  status: OutfitStatus.CONFIGURING,
  initialImage: params.initialImage,
  detectedCategories: params.detectedCategories,
  confirmedCategories: new Set(params.confirmedCategories ?? params.detectedCategories),
  slots: {},
  shotQueue: [],
  currentShotIndex: 0,
  generatedImages: [],
  correctivePrompts: [],
  errorMessage: null,
  colorVariantStep: "idle",
  colorVariantRequests: [],
  colorVariantCombinations: [],
  generatedColorVariants: {},
  colorVariantError: null
});

export const toggleCategory = (outfit: Outfit, category: ClothingCategory) => {
  const set = new Set(outfit.confirmedCategories);
  if (set.has(category)) {
    set.delete(category);
  } else {
    set.add(category);
  }
  return set;
};
