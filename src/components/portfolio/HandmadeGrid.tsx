import React, { useState, useEffect, useCallback } from "react";
import { FaSyncAlt, FaArrowRight } from "react-icons/fa";

type HandmadeProject = {
  title: string;
  description: string;
  image?: { src: string } | string;
  blogUrl?: string;
  category?: string;
};

interface Props {
  projects: HandmadeProject[];
}

const getCategoryIcon = (category: string | undefined) => {
  switch (category) {
    case "Holzwerken":
      return "🪵";
    case "Epoxidharz":
      return "💎";
    case "Laser":
      return "⚡";
    case "3D-Druck":
      return "🖨️";
    default:
      return "🛠️";
  }
};

const HandmadeGrid: React.FC<Props> = ({ projects }) => {
  const [selectedProjects, setSelectedProjects] = useState<HandmadeProject[]>(
    []
  );
  const [isAnimating, setIsAnimating] = useState(false);

  const shuffleProjects = useCallback(() => {
    if (projects.length === 0) return;
    setIsAnimating(true);

    setTimeout(() => {
      // Fisher-Yates Shuffle
      const shuffled = [...projects];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      setSelectedProjects(shuffled.slice(0, 4));
      setIsAnimating(false);
    }, 300);
  }, [projects]);

  useEffect(() => {
    shuffleProjects();
  }, [projects, shuffleProjects]);

  if (!projects || projects.length === 0) return null;

  return (
    <div className="space-y-8">
      <div
        className={`grid grid-cols-1 gap-6 transition-all duration-300 md:grid-cols-2 lg:grid-cols-4 ${
          isAnimating ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        {selectedProjects.map((project, index) => {
          const imageUrl =
            typeof project.image === "string"
              ? project.image
              : project.image?.src || "";

          return (
            <a
              key={`${project.title}-${index}-${Math.random()}`}
              href={project.blogUrl || "#"}
              className="group block no-underline"
            >
              <div className="glass-t h-full overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.03] hover:shadow-xl">
                {/* Image */}
                <div className="aspect-video overflow-hidden">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={project.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                      <span className="text-4xl">
                        {getCategoryIcon(project.category)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  {/* Category Badge */}
                  <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-3 py-1 text-xs font-medium text-black dark:text-amber-300">
                    {getCategoryIcon(project.category)} {project.category}
                  </span>

                  {/* Title */}
                  <h4 className="text-txt-h dark:text-darkmode-txt-h mb-2 line-clamp-1 text-base font-bold transition-colors group-hover:text-amber-500">
                    {project.title}
                  </h4>

                  {/* Description */}
                  <p className="line-clamp-2 text-sm text-txt-p opacity-80 dark:text-darkmode-txt-p">
                    {project.description}
                  </p>
                </div>
              </div>
            </a>
          );
        })}
      </div>

      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <button
          onClick={shuffleProjects}
          disabled={isAnimating}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-white/5 px-6 py-3 font-medium text-txt-p transition-all duration-300 hover:bg-amber-500 hover:text-white hover:shadow-lg disabled:opacity-50 dark:text-darkmode-txt-p"
        >
          <FaSyncAlt
            className={`text-sm ${isAnimating ? "animate-spin" : ""}`}
          />
          Neue Auswahl zeigen
        </button>

        <a
          href="/blog/categories/diy"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-medium text-white transition-all duration-300 hover:scale-105 hover:from-amber-600 hover:to-orange-600 hover:shadow-lg"
        >
          Alle DIY-Projekte ansehen
          <FaArrowRight className="text-sm" />
        </a>
      </div>
    </div>
  );
};

export default HandmadeGrid;
