import JSZip from "jszip";
import { saveAs } from "file-saver";
import { useMemo, useState } from "react";
import { useOutfitStore } from "@/store/outfitStore";
import { GeneratedImage, Outfit } from "@/types";

const createZipFromImages = async (images: GeneratedImage[], filename: string) => {
  const zip = new JSZip();
  images.forEach((image) => {
    zip.file(`${image.filename}`, image.image, { base64: true });
  });
  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, filename);
};

const DownloadButtons = () => {
  const outfits = useOutfitStore((state) => state.outfits);
  const [isDownloading, setIsDownloading] = useState(false);

  const groupedProducts = useMemo(() => {
    const map = new Map<string, GeneratedImage[]>();
    outfits.forEach((outfit) => {
      outfit.generatedImages.forEach((image) => {
        image.products.forEach((product) => {
          const key = product;
          const existing = map.get(key) ?? [];
          existing.push(image);
          map.set(key, existing);
        });
      });
    });
    return map;
  }, [outfits]);

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    try {
      const allImages = outfits.flatMap((outfit) => outfit.generatedImages);
      if (allImages.length === 0) return;
      await createZipFromImages(allImages, "AI-Fashion-Studio.zip");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadProduct = async (product: string) => {
    const images = groupedProducts.get(product) ?? [];
    if (images.length === 0) return;
    setIsDownloading(true);
    try {
      await createZipFromImages(images, `${product}-AI-Fashion-Studio.zip`);
    } finally {
      setIsDownloading(false);
    }
  };

  const renderedOutfits = outfits.filter((outfit: Outfit) => outfit.generatedImages.length > 0);

  if (renderedOutfits.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl shadow-brand-500/10">
      <h3 className="text-lg font-semibold text-brand-200">Download immagini</h3>
      <p className="mt-2 text-sm text-slate-300">
        Scarica tutte le immagini generate oppure crea pacchetti per singola
        categoria prodotto.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleDownloadAll}
          disabled={isDownloading}
          className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400 disabled:opacity-50"
        >
          Scarica tutto
        </button>
        {Array.from(groupedProducts.keys()).map((product) => (
          <button
            type="button"
            key={product}
            onClick={() => handleDownloadProduct(product)}
            disabled={isDownloading}
            className="rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
          >
            {product}
          </button>
        ))}
      </div>
    </section>
  );
};

export default DownloadButtons;
