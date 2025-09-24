import { useCallback, useMemo, useRef, useState } from "react";
import {
  ClothingCategory,
  GeneratedImage,
  InputSlot,
  OutfitStatus,
  Shot
} from "@/types";
import { useOutfitStore, toggleCategory } from "@/store/outfitStore";
import { buildShotQueue } from "@/utils/shotBuilder";
import { generateShot } from "@/services/api";
import { mapGeneratedImage } from "@/utils/filename";

const categoryLabels: Record<ClothingCategory, string> = {
  [ClothingCategory.TOP_SHORT_SLEEVE]: "Top maniche corte",
  [ClothingCategory.TOP_LONG_SLEEVE]: "Top maniche lunghe",
  [ClothingCategory.KNIT]: "Maglia",
  [ClothingCategory.HOODIE]: "Felpa",
  [ClothingCategory.JACKET]: "Giacca",
  [ClothingCategory.PANTS]: "Pantalone",
  [ClothingCategory.SKIRT]: "Gonna",
  [ClothingCategory.DRESS]: "Abito"
};

type OutfitManagerProps = {
  outfitId: string;
};

type ShotState = {
  shot: Shot;
  status: "pending" | "generating" | "completed" | "error";
  error?: string;
  image?: GeneratedImage;
};

const OutfitManager = ({ outfitId }: OutfitManagerProps) => {
  const outfit = useOutfitStore((state) =>
    state.outfits.find((item) => item.id === outfitId)
  );
  const updateOutfit = useOutfitStore((state) => state.updateOutfit);
  const enqueueShots = useOutfitStore((state) => state.enqueueShots);
  const addGeneratedImage = useOutfitStore((state) => state.addGeneratedImage);
  const [correctivePrompt, setCorrectivePrompt] = useState("");
  const [localShotState, setLocalShotState] = useState<ShotState[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const pauseRef = useRef(false);

  const confirmedCategories = useMemo(
    () => Array.from(outfit?.confirmedCategories ?? []),
    [outfit?.confirmedCategories]
  );

  const slotImages = outfit?.slots ?? {};

  const handleToggle = useCallback(
    (category: ClothingCategory) => {
      if (!outfit) return;
      const updated = toggleCategory(outfit, category);
      updateOutfit(outfit.id, { confirmedCategories: updated });
    },
    [outfit, updateOutfit]
  );

  const ensureQueue = useCallback(async () => {
    if (!outfit) return;
    if (outfit.shotQueue.length === 0) {
      await enqueueShots(outfit.id);
    }
  }, [enqueueShots, outfit]);

  const refreshLocalShotState = useCallback(() => {
    if (!outfit) return;
    setLocalShotState(
      outfit.shotQueue.map((shot) => ({
        shot,
        status: "pending" as const
      }))
    );
  }, [outfit]);

  const handleBuildQueue = useCallback(async () => {
    if (!outfit) return;
    if (outfit.shotQueue.length === 0) {
      await enqueueShots(outfit.id);
    } else {
      const fallback = buildShotQueue(confirmedCategories);
      useOutfitStore.getState().setShotQueue(outfit.id, fallback);
    }
    refreshLocalShotState();
  }, [confirmedCategories, enqueueShots, outfit, refreshLocalShotState]);

  const updateShotState = (shotId: number, update: Partial<ShotState>) => {
    setLocalShotState((current) =>
      current.map((item) =>
        item.shot.id === shotId
          ? {
              ...item,
              ...update
            }
          : item
      )
    );
  };

  const handleGenerate = useCallback(async () => {
    if (!outfit || outfit.shotQueue.length === 0) {
      await ensureQueue();
    }

    const currentOutfit = useOutfitStore
      .getState()
      .outfits.find((item) => item.id === outfitId);
    if (!currentOutfit || currentOutfit.shotQueue.length === 0) return;

    refreshLocalShotState();
    setIsPaused(false);
    pauseRef.current = false;

    let anchorImage: string | undefined;
    updateOutfit(outfitId, { status: OutfitStatus.GENERATING, errorMessage: null });

    for (const shot of currentOutfit.shotQueue) {
      if (pauseRef.current) break;
      updateShotState(shot.id, { status: "generating" });

      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const response = await generateShot(
          {
            shot,
            slots: slotImages,
            confirmedCategories,
            correctivePrompts: correctivePrompt ? [correctivePrompt] : [],
            anchorImage
          },
          controller.signal
        );
        const generated = mapGeneratedImage({
          outfitIndex: 1,
          shot,
          imageBase64: response.imageBase64,
          products: confirmedCategories,
          variant: "original"
        });
        anchorImage = anchorImage ?? generated.image;
        addGeneratedImage(outfitId, generated);
        updateShotState(shot.id, { status: "completed", image: generated });
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          updateShotState(shot.id, { status: "pending" });
          break;
        }
        updateShotState(shot.id, {
          status: "error",
          error: (error as Error).message
        });
        updateOutfit(outfitId, {
          status: OutfitStatus.ERROR,
          errorMessage: (error as Error).message
        });
        return;
      } finally {
        controllerRef.current = null;
      }
    }

    if (!pauseRef.current) {
      updateOutfit(outfitId, { status: OutfitStatus.COMPLETED });
    }
  }, [
    addGeneratedImage,
    confirmedCategories,
    correctivePrompt,
    ensureQueue,
    outfit,
    outfitId,
    pauseRef,
    refreshLocalShotState,
    slotImages,
    updateOutfit
  ]);

  const handlePause = () => {
    setIsPaused(true);
    pauseRef.current = true;
    controllerRef.current?.abort();
    updateOutfit(outfitId, { status: OutfitStatus.PAUSED });
  };

  const handleResume = () => {
    setIsPaused(false);
    pauseRef.current = false;
    handleGenerate();
  };

  const handleCancel = () => {
    controllerRef.current?.abort();
    setIsPaused(false);
    pauseRef.current = false;
    updateOutfit(outfitId, { status: OutfitStatus.STOPPED });
  };

  if (!outfit) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-inner shadow-black/40">
      <div className="flex flex-col gap-6 md:flex-row">
        {outfit.initialImage ? (
          <img
            src={`data:image/jpeg;base64,${outfit.initialImage}`}
            alt="Outfit"
            className="h-48 w-48 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-48 w-48 items-center justify-center rounded-xl bg-slate-950/60 text-sm text-slate-500">
            Nessuna immagine iniziale
          </div>
        )}

        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-brand-200">Categorie</h3>
            <p className="mt-1 text-xs text-slate-400">
              Conferma o correggi le categorie rilevate per costruire la coda di
              generazione.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.values(ClothingCategory).map((category) => {
                const isActive = outfit.confirmedCategories.has(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleToggle(category)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      isActive
                        ? "bg-brand-500 text-white shadow shadow-brand-500/50"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {categoryLabels[category]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {Object.values(InputSlot).map((slot) => (
              <div
                key={slot}
                className="rounded-xl border border-white/10 bg-slate-950/40 p-3 text-xs"
              >
                <p className="font-semibold uppercase tracking-wide text-brand-300">
                  {slot}
                </p>
                {slotImages[slot] ? (
                  <img
                    src={`data:image/jpeg;base64,${slotImages[slot]}`}
                    alt={slot}
                    className="mt-2 h-24 w-full rounded-md object-cover"
                  />
                ) : (
                  <p className="mt-2 text-slate-500">Nessuna immagine assegnata</p>
                )}
              </div>
            ))}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-200">
              Prompt correttivo (applicato ai prossimi scatti)
            </label>
            <textarea
              value={correctivePrompt}
              onChange={(event) => setCorrectivePrompt(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-100"
              placeholder="Es. enfatizza il tessuto, mantieni la postura naturale"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleBuildQueue}
              className="rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
            >
              Costruisci coda scatti
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400"
            >
              Avvia generazione
            </button>
            <button
              type="button"
              onClick={handlePause}
              className="rounded-full bg-amber-500/80 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400"
            >
              Pausa
            </button>
            <button
              type="button"
              onClick={handleResume}
              className="rounded-full bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
            >
              Riprendi
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full bg-rose-500/80 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400"
            >
              Annulla
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Coda scatti
        </h4>
        <div className="grid gap-3 md:grid-cols-2">
          {(localShotState.length > 0 ? localShotState : outfit.shotQueue.map((shot) => ({
            shot,
            status: "pending" as const
          }))).map(({ shot, status, image, error }) => (
            <div
              key={shot.id}
              className="rounded-2xl border border-white/5 bg-slate-950/40 p-4 text-sm"
            >
              <p className="font-semibold text-brand-200">{shot.description}</p>
              <p className="mt-1 text-xs text-slate-400">
                Richiede: {shot.required_slots.join(", ")}
              </p>
              <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
                Stato: {status}
              </p>
              {image && (
                <img
                  src={`data:image/jpeg;base64,${image.image}`}
                  alt={shot.description}
                  className="mt-2 h-32 w-full rounded-xl object-cover"
                />
              )}
              {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OutfitManager;
