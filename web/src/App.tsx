import { Suspense, useEffect } from "react";
import BulkUploader from "@/components/BulkUploader";
import OutfitManager from "@/components/OutfitManager";
import ColorVariantManager from "@/components/ColorVariantManager";
import DownloadButtons from "@/components/DownloadButtons";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useOutfitStore } from "@/store/outfitStore";
import { HealthResponse } from "@/types";

const App = () => {
  const outfits = useOutfitStore((state) => state.outfits);
  const setBackendStatus = useOutfitStore((state) => state.setBackendStatus);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/health", { signal: controller.signal })
      .then((response) => response.json() as Promise<HealthResponse>)
      .then((data) => {
        if (data.status === "ok") {
          setBackendStatus("online");
        } else {
          setBackendStatus("degraded");
        }
      })
      .catch(() => setBackendStatus("offline"));

    return () => {
      controller.abort();
    };
  }, [setBackendStatus]);

  return (
    <div className="min-h-screen text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-brand-400">
              AI Fashion Studio
            </p>
            <h1 className="text-2xl font-semibold md:text-3xl">
              Precisione, coerenza e varianti cromatiche per i tuoi outfit
            </h1>
          </div>
          <div className="text-sm text-slate-300">
            <p>Frontend React + Vite + Tailwind</p>
            <p>Backend Node + Express</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10">
        <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl shadow-brand-500/10">
          <h2 className="text-xl font-semibold text-brand-200">
            Inizia caricando le immagini dell'outfit
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Carica una o più immagini e lascia che il backend analizza categorie e
            angolazioni. Puoi confermare o correggere rapidamente i risultati.
          </p>
          <div className="mt-6">
            <ErrorBoundary>
              <BulkUploader />
            </ErrorBoundary>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          {outfits.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/20 bg-slate-900/40 p-10 text-center text-slate-400">
              <p className="text-lg font-medium">
                Nessun outfit ancora. Carica immagini per iniziare a generare la
                tua campagna.
              </p>
            </div>
          ) : (
            outfits.map((outfit) => (
              <ErrorBoundary key={outfit.id}>
                <Suspense fallback={<p>Caricamento gestione outfit…</p>}>
                  <OutfitManager outfitId={outfit.id} />
                </Suspense>
              </ErrorBoundary>
            ))
          )}
        </section>

        <ErrorBoundary>
          <ColorVariantManager />
        </ErrorBoundary>

        <ErrorBoundary>
          <DownloadButtons />
        </ErrorBoundary>
      </main>
    </div>
  );
};

export default App;
