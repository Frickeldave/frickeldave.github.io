import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import {
  FaChevronLeft,
  FaChevronRight,
  FaExternalLinkAlt,
} from "react-icons/fa";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

type HandmadeProject = {
  title: string;
  description: string;
  imageUrl: string;
  blogUrl?: string;
  category?: string;
};

interface Props {
  projects: HandmadeProject[];
}

const HandmadePortfolioCarousel: React.FC<Props> = ({ projects }) => {
  if (!projects || projects.length === 0) {
    return (
      <div className="glass rounded-lg p-8 text-center">
        <p className="text-txt-p dark:text-darkmode-txt-p">
          Keine Handmade-Projekte verfügbar.
        </p>
      </div>
    );
  }

  return (
    <div className="handmade-portfolio-carousel relative px-8">
      <Swiper
        modules={[Autoplay, Navigation, Pagination]}
        spaceBetween={24}
        slidesPerView={1}
        navigation={{
          prevEl: ".swiper-btn-prev-handmade",
          nextEl: ".swiper-btn-next-handmade",
        }}
        pagination={{
          clickable: true,
          el: ".swiper-pagination-handmade",
        }}
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        breakpoints={{
          640: { slidesPerView: 2 },
          1024: { slidesPerView: 3 },
        }}
        className="pb-12"
      >
        {projects.map((project, index) => (
          <SwiperSlide key={index}>
            <div className="glass group h-full overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl">
              {/* Image */}
              <div className="aspect-video overflow-hidden">
                <img
                  src={project.imageUrl}
                  alt={project.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
              </div>

              {/* Content */}
              <div className="p-5">
                {/* Category Badge */}
                {project.category && (
                  <span className="mb-3 inline-block rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                    {project.category}
                  </span>
                )}

                {/* Title */}
                <h4 className="text-txt-h dark:text-darkmode-txt-h mb-2 text-lg font-bold">
                  {project.title}
                </h4>

                {/* Description */}
                <p className="mb-4 line-clamp-3 text-sm text-txt-p opacity-80 dark:text-darkmode-txt-p">
                  {project.description}
                </p>

                {/* Blog Link */}
                {project.blogUrl && (
                  <a
                    href={project.blogUrl}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:from-amber-600 hover:to-orange-600 hover:shadow-lg"
                  >
                    Zum Blog-Artikel
                    <FaExternalLinkAlt className="text-xs" />
                  </a>
                )}
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Custom Navigation */}
      <button
        className="swiper-btn-prev-handmade glass absolute left-0 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-full p-3 transition-all duration-300 hover:scale-110 hover:bg-white/20"
        aria-label="Vorheriges Projekt"
      >
        <FaChevronLeft className="text-txt-h dark:text-darkmode-txt-h text-lg" />
      </button>
      <button
        className="swiper-btn-next-handmade glass absolute right-0 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-full p-3 transition-all duration-300 hover:scale-110 hover:bg-white/20"
        aria-label="Nächstes Projekt"
      >
        <FaChevronRight className="text-txt-h dark:text-darkmode-txt-h text-lg" />
      </button>

      {/* Custom Pagination */}
      <div className="swiper-pagination-handmade mt-6 flex justify-center gap-2" />
    </div>
  );
};

export default HandmadePortfolioCarousel;
