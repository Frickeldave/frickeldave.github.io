import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { FaChevronLeft, FaChevronRight, FaBook } from "react-icons/fa";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

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

const PublicationsCarousel: React.FC<Props> = ({ publications }) => {
  if (!publications || publications.length === 0) {
    return (
      <div className="glass rounded-lg p-8 text-center">
        <p className="text-txt-p dark:text-darkmode-txt-p">
          Keine Veröffentlichungen verfügbar.
        </p>
      </div>
    );
  }

  return (
    <div className="publications-carousel relative px-8">
      <Swiper
        modules={[Autoplay, Navigation, Pagination]}
        spaceBetween={24}
        slidesPerView={1}
        navigation={{
          prevEl: ".swiper-btn-prev-publications",
          nextEl: ".swiper-btn-next-publications",
        }}
        pagination={{
          clickable: true,
          el: ".swiper-pagination-publications",
        }}
        autoplay={{
          delay: 6000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        breakpoints={{
          640: { slidesPerView: 2 },
          1024: { slidesPerView: 3 },
        }}
        className="pb-12"
      >
        {publications.map((pub, index) => (
          <SwiperSlide key={index}>
            <div className="glass group h-full overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl">
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
              <div className="p-5">
                {/* Year & Publisher */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {pub.year && (
                    <span className="rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-3 py-1 text-xs font-bold text-black">
                      {pub.year}
                    </span>
                  )}
                  {pub.publisher && (
                    <span className="rounded-full bg-gray-500/20 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                      {pub.publisher}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h4 className="text-txt-h dark:text-darkmode-txt-h mb-2 text-lg font-bold">
                  {pub.title}
                </h4>

                {/* Description */}
                <p className="mb-4 line-clamp-3 text-sm text-txt-p opacity-80 dark:text-darkmode-txt-p">
                  {pub.description}
                </p>

                {/* Links */}
                <div className="flex flex-wrap gap-2">
                  <a
                    href={pub.publicationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:from-amber-600 hover:to-orange-600 hover:shadow-lg"
                  >
                    <FaBook className="text-xs" />
                    Zur Veröffentlichung
                  </a>
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Custom Navigation */}
      <button
        className="swiper-btn-prev-publications glass absolute left-0 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-full p-3 transition-all duration-300 hover:scale-110 hover:bg-white/20"
        aria-label="Vorherige Veröffentlichung"
      >
        <FaChevronLeft className="text-txt-h dark:text-darkmode-txt-h text-lg" />
      </button>
      <button
        className="swiper-btn-next-publications glass absolute right-0 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-full p-3 transition-all duration-300 hover:scale-110 hover:bg-white/20"
        aria-label="Nächste Veröffentlichung"
      >
        <FaChevronRight className="text-txt-h dark:text-darkmode-txt-h text-lg" />
      </button>

      {/* Custom Pagination */}
      <div className="swiper-pagination-publications mt-6 flex justify-center gap-2" />
    </div>
  );
};

export default PublicationsCarousel;
