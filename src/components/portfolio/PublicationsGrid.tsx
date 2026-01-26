import React, { useState, useEffect, useCallback } from "react";
import { FaSyncAlt, FaArrowRight, FaBook } from "react-icons/fa";

type Publication = {
  title: string;
  description: string;
  imageUrl: string;
  publicationUrl: string;
  year?: string;
  publisher?: string;
};

interface Props {
  publications: Publication[];
}

const PublicationsGrid: React.FC<Props> = ({ publications }) => {
  const [selectedItems, setSelectedItems] = useState<Publication[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  const shuffleItems = useCallback(() => {
    if (publications.length === 0) return;
    setIsAnimating(true);

    setTimeout(() => {
      // Fisher-Yates Shuffle
      const shuffled = [...publications];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      setSelectedItems(shuffled.slice(0, 4));
      setIsAnimating(false);
    }, 300);
  }, [publications]);

  useEffect(() => {
    shuffleItems();
  }, [publications, shuffleItems]);

  if (!publications || publications.length === 0) return null;

  return (
    <div className="space-y-8">
      <div
        className={`grid grid-cols-1 gap-6 transition-all duration-300 md:grid-cols-2 lg:grid-cols-4 ${
          isAnimating ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        {selectedItems.map((pub, index) => (
          <div
            key={`${pub.title}-${index}-${Math.random()}`}
            className="glass-t group flex h-full flex-col overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.03] hover:shadow-xl"
          >
            {/* Image */}
            <div className="aspect-video overflow-hidden bg-gradient-to-br from-amber-500/10 to-orange-500/10">
              <img
                src={pub.imageUrl}
                alt={pub.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
            </div>

            {/* Content */}
            <div className="flex flex-grow flex-col p-4">
              {/* Year & Publisher */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {pub.year && (
                  <span className="rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black dark:text-amber-300">
                    {pub.year}
                  </span>
                )}
                {pub.publisher && (
                  <span className="rounded-full bg-gray-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                    {pub.publisher}
                  </span>
                )}
              </div>

              {/* Title */}
              <h4 className="text-txt-h dark:text-darkmode-txt-h mb-2 line-clamp-2 text-base font-bold">
                {pub.title}
              </h4>

              {/* Description */}
              <p className="mb-4 line-clamp-2 text-xs text-txt-p opacity-80 dark:text-darkmode-txt-p">
                {pub.description}
              </p>

              {/* Links */}
              <div className="mt-auto flex flex-col gap-2">
                <a
                  href={pub.publicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-bold text-white transition-all duration-300 hover:from-amber-600 hover:to-orange-600 hover:shadow-lg"
                >
                  <FaBook className="text-xs" />
                  Zur Veröffentlichung
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <button
          onClick={shuffleItems}
          disabled={isAnimating}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-white/5 px-6 py-3 font-medium text-txt-p transition-all duration-300 hover:bg-amber-500 hover:text-white hover:shadow-lg disabled:opacity-50 dark:text-darkmode-txt-p"
        >
          <FaSyncAlt
            className={`text-sm ${isAnimating ? "animate-spin" : ""}`}
          />
          Neue Auswahl zeigen
        </button>

        <a
          href="/aboutme/publications"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-medium text-white transition-all duration-300 hover:scale-105 hover:from-amber-600 hover:to-orange-600 hover:shadow-lg"
        >
          Alle Veröffentlichungen ansehen
          <FaArrowRight className="text-sm" />
        </a>
      </div>
    </div>
  );
};

export default PublicationsGrid;
