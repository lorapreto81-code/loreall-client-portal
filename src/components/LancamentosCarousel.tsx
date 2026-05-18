import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

type Lancamento = {
  title: string;
  gradient: string;
  imageUrl?: string;
};

const LANCAMENTOS: Lancamento[] = [
  {
    title: "Mortal Kombat 2",
    gradient: "from-red-900 via-orange-900 to-black",
  },
  {
    title: "Obsessão",
    gradient: "from-slate-900 via-purple-950 to-slate-800",
  },
  {
    title: "Duna: Parte Dois",
    gradient: "from-amber-900 via-orange-800 to-yellow-900",
  },
  {
    title: "The Last of Us",
    gradient: "from-emerald-950 via-slate-900 to-stone-900",
  },
  {
    title: "Round 6 — Temporada 3",
    gradient: "from-rose-900 via-pink-900 to-fuchsia-950",
  },
  {
    title: "Wandinha 2",
    gradient: "from-violet-950 via-slate-900 to-indigo-950",
  },
];

interface Props {
  href?: string;
}

export default function LancamentosCarousel({ href = "https://loreallplay.com" }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 3500, stopOnInteraction: false }),
  ]);
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="relative block overflow-hidden rounded-2xl shadow-xl shadow-blue-900/20"
    >
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {LANCAMENTOS.map((item, idx) => (
            <div
              key={idx}
              className={`relative flex-[0_0_100%] h-44 bg-gradient-to-br ${item.gradient}`}
            >
              {/* film grain / vignette */}
              <div
                className="absolute inset-0 opacity-50 mix-blend-overlay"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(circle at 80% 90%, rgba(0,0,0,0.6), transparent 60%)",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Lançamento badge */}
              <div className="absolute top-3 left-3 z-10">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-md">
                  Lançamento
                </span>
              </div>

              {/* Title */}
              <div className="absolute bottom-9 left-4 right-4 z-10">
                <h3 className="text-white font-extrabold text-xl leading-tight drop-shadow-lg">
                  {item.title}
                </h3>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dots */}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
        {LANCAMENTOS.map((_, idx) => (
          <span
            key={idx}
            className={`h-1.5 rounded-full transition-all ${
              idx === selected ? "w-5 bg-white" : "w-1.5 bg-white/40"
            }`}
          />
        ))}
      </div>
    </a>
  );
}
