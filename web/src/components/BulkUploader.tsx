import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { nanoid } from "nanoid";
import { analyzeOutfit, assignSlots } from "@/services/api";
import {
  ClothingCategory,
  InputSlot,
  OutfitStatus
} from "@/types";
import { createEmptyOutfit, useOutfitStore } from "@/store/outfitStore";

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result.split(",")[1] ?? result);
      } else {
        reject(new Error("Invalid file result"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const useFileQueue = () => {
  const [queue, setQueue] = useState<{ file: File; base64: string }[]>([]);

  const enqueue = useCallback(async (files: File[]) => {
    const conversions = await Promise.all(
      files.map(async (file) => ({
        file,
        base64: await toBase64(file)
      }))
    );
    setQueue((current) => [...current, ...conversions]);
    return conversions;
  }, []);

  const clear = useCallback(() => setQueue([]), []);

  return { queue, enqueue, clear };
};

const BulkUploader = () => {
  const { queue, enqueue, clear } = useFileQueue();
  const addOutfit = useOutfitStore((state) => state.addOutfit);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setIsProcessing(true);
      setStatusMessage("Analisi delle immagini in corso…");
      try {
        const converted = await enqueue(acceptedFiles);
        if (converted.length === 0) {
          setStatusMessage("Nessun file valido");
          return;
        }

        const primary = converted[0];
        const analysis = await analyzeOutfit(primary.base64);
        const autoConfirmed = analysis.confidence >= 0.85;
        const categories = analysis.categories as ClothingCategory[];
        const outfitId = nanoid();
        const outfit = createEmptyOutfit({
          id: outfitId,
          name: `Outfit ${new Date().toLocaleTimeString()}`,
          initialImage: primary.base64,
          detectedCategories: categories,
          confirmedCategories: autoConfirmed ? categories : undefined
        });

        addOutfit(outfit);

        if (converted.length > 1) {
          const slotAssignment = await assignSlots(
            converted.map((item) => item.base64)
          );

          const slotEntries = Object.entries(slotAssignment.slots ?? {}) as [
            InputSlot,
            number
          ][];
          const slotImages: Partial<Record<InputSlot, string>> = {};
          slotEntries.forEach(([slot, index]) => {
            const candidate = converted[index];
            if (candidate) {
              slotImages[slot] = candidate.base64;
            }
          });

          useOutfitStore.getState().updateSlots(outfitId, slotImages);
        }

        useOutfitStore
          .getState()
          .updateOutfit(outfitId, {
            status: autoConfirmed
              ? OutfitStatus.CATEGORIES_DETECTED
              : OutfitStatus.COMPLETING_OUTFIT,
            errorMessage: null
          });

        setStatusMessage(
          autoConfirmed
            ? "Categorie confermate automaticamente"
            : "Verifica le categorie prima di procedere"
        );
      } catch (error) {
        console.error("Upload error", error);
        setStatusMessage("Impossibile analizzare le immagini. Riprova.");
      } finally {
        setIsProcessing(false);
        clear();
      }
    },
    [addOutfit, clear, enqueue]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpeg", ".jpg"],
      "image/png": [".png"],
      "image/webp": [".webp"]
    }
  });

  const queuedFiles = useMemo(
    () => queue.map((item) => item.file.name).join(", "),
    [queue]
  );

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-brand-400/40 bg-slate-950/60 p-6 text-center transition ${
          isDragActive ? "border-brand-300 bg-brand-500/10" : "hover:border-brand-300/70"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-lg font-semibold text-brand-200">
          Trascina qui le immagini dell'outfit
        </p>
        <p className="mt-2 max-w-md text-sm text-slate-300">
          Supportiamo scatti multipli: fronte, retro, laterale e dettagli. Il
          sistema assegnerà automaticamente gli slot necessari.
        </p>
        {isProcessing && <p className="mt-4 animate-pulse">Analisi in corso…</p>}
      </div>
      {queuedFiles && (
        <p className="text-xs text-slate-400">File in coda: {queuedFiles}</p>
      )}
      {statusMessage && (
        <p className="text-sm text-brand-200">{statusMessage}</p>
      )}
    </div>
  );
};

export default BulkUploader;
