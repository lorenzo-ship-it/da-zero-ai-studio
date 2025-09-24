import { useMemo, useState } from "react";
import { nanoid } from "nanoid";
import {
  ClothingCategory,
  ColorVariantRequest,
  GenerationCombination,
  Outfit
} from "@/types";
import { useOutfitStore } from "@/store/outfitStore";

const ColorVariantManager = () => {
  const outfits = useOutfitStore((state) => state.outfits);
  const setColorVariants = useOutfitStore((state) => state.setColorVariants);
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null);
  const [variantName, setVariantName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ClothingCategory | "">("");
  const [referenceImage, setReferenceImage] = useState<string>("");
  const [combinations, setCombinations] = useState<GenerationCombination[]>([]);

  const selectedOutfit = useMemo<Outfit | undefined>(
    () => outfits.find((outfit) => outfit.id === (selectedOutfitId ?? "")),
    [outfits, selectedOutfitId]
  );

  const requests = selectedOutfit?.colorVariantRequests ?? [];

  const handleAddVariant = () => {
    if (!variantName || !selectedOutfitId || !selectedCategory || !referenceImage) {
      return;
    }

    const next: ColorVariantRequest = {
      id: nanoid(),
      name: variantName,
      references: {
        [selectedCategory]: referenceImage
      }
    };

    const updated = [...requests, next];
    setColorVariants(selectedOutfitId, {
      requests: updated,
      combinations: combinations.length > 0 ? combinations : selectedOutfit?.colorVariantCombinations ?? []
    });
    setVariantName("");
    setSelectedCategory("");
    setReferenceImage("");
  };

  const handleAddCombination = () => {
    if (!selectedOutfitId) return;
    const combination: GenerationCombination = {
      id: nanoid(),
      name: `Batch ${combinations.length + 1}`,
      selection: {}
    };
    const next = [...combinations, combination];
    setCombinations(next);
    setColorVariants(selectedOutfitId, {
      requests,
      combinations: next
    });
  };

  const convertFile = (file: File) =>
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

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 shadow-xl shadow-brand-500/10">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="md:w-1/3">
          <h3 className="text-lg font-semibold text-brand-200">Varianti colore</h3>
          <p className="mt-2 text-sm text-slate-300">
            Definisci richieste colore partendo da riferimenti per ciascuna
            categoria. Puoi poi combinare le varianti per creare batch di
            generazione consistenti.
          </p>
          <select
            value={selectedOutfitId ?? ""}
            onChange={(event) => setSelectedOutfitId(event.target.value || null)}
            className="mt-4 w-full rounded-xl border border-white/10 bg-slate-950/70 p-3 text-sm"
          >
            <option value="">Seleziona outfit</option>
            {outfits.map((outfit) => (
              <option value={outfit.id} key={outfit.id}>
                {outfit.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 space-y-6">
          <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Nuova variante colore
            </h4>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <input
                value={variantName}
                onChange={(event) => setVariantName(event.target.value)}
                placeholder="Nome variante"
                className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-100"
              />
              <select
                value={selectedCategory}
                onChange={(event) =>
                  setSelectedCategory(event.target.value as ClothingCategory | "")
                }
                className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm"
              >
                <option value="">Categoria</option>
                {Object.values(ClothingCategory).map((category) => (
                  <option value={category} key={category}>
                    {category}
                  </option>
                ))}
              </select>
              <input
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const base64 = await convertFile(file);
                  setReferenceImage(base64);
                }}
                className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleAddVariant}
              className="mt-4 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400"
            >
              Aggiungi variante
            </button>
          </div>

          <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Batch di generazione
            </h4>
            <button
              type="button"
              onClick={handleAddCombination}
              className="rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
            >
              Aggiungi batch
            </button>
            <div className="mt-4 space-y-3">
              {(combinations.length > 0 ? combinations : selectedOutfit?.colorVariantCombinations ?? []).map(
                (combination) => (
                  <div
                    key={combination.id}
                    className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-sm"
                  >
                    <p className="font-semibold text-brand-200">{combination.name}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {Object.entries(combination.selection).length > 0
                        ? Object.entries(combination.selection)
                            .map(([slot, value]) => `${slot}: ${value}`)
                            .join(", ")
                        : "Nessuna variante selezionata"}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          {requests.length > 0 && (
            <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Varianti configurate
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {requests.map((request) => (
                  <li key={request.id}>
                    {request.name} — {Object.keys(request.references).join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default ColorVariantManager;
