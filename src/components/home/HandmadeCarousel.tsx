import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

type ProductWithImage = {
  articleNumber: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  price: number;
  size?: string;
  visible: boolean;
  customizable: boolean;
  imageUrl: string;
};

interface Props {
  products: ProductWithImage[];
}

const HandmadeCarousel: React.FC<Props> = ({ products }) => {
  if (!products || products.length === 0) {
    return (
      <div className="glass rounded-lg p-8 text-center">
        <p>Keine Produkte verfügbar.</p>
      </div>
    );
  }

  return (
    <div className="handmade-carousel relative">
      <Swiper
        modules={[Autoplay, Navigation, Pagination]}
        spaceBetween={24}
        slidesPerView={1}
        navigation={{
          prevEl: ".swiper-button-prev-custom",
          nextEl: ".swiper-button-next-custom",
        }}
        pagination={{
          clickable: true,
          el: ".swiper-pagination-custom",
        }}
        autoplay={{
          delay: 4000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        breakpoints={{
          640: { slidesPerView: 2 },
          1024: { slidesPerView: 3 },
          1280: { slidesPerView: 4 },
        }}
        className="pb-12"
      >
        {products.map((product) => (
          <SwiperSlide key={product.articleNumber}>
            <a
              href={`/handmade/${product.articleNumber}`}
              className="group block h-full no-underline"
            >
              <div className="glass h-full overflow-hidden rounded-lg transition-transform group-hover:scale-105">
                <div className="aspect-square overflow-hidden">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform group-hover:scale-110"
                    loading="lazy"
                  />
                </div>
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="glass-t rounded px-2 py-1 font-mono text-xs">
                      {product.articleNumber}
                    </span>
                    <span className="glass-t rounded px-2 py-1 text-xs">
                      {product.category}
                    </span>
                  </div>
                  <h4 className="mb-1 text-lg font-bold">{product.name}</h4>
                  <p className="mb-2 line-clamp-2 text-sm opacity-80">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">
                      {product.price.toFixed(2)} €
                    </span>
                    {product.customizable && (
                      <span className="text-sm" title="Personalisierbar">
                        ✨
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </a>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Custom Navigation */}
      <button
        className="swiper-button-prev-custom glass absolute left-0 top-1/2 z-10 -ml-4 -translate-y-1/2 cursor-pointer rounded-full p-3 transition-transform hover:scale-110"
        aria-label="Vorheriges Produkt"
      >
        <FaChevronLeft className="text-lg" />
      </button>
      <button
        className="swiper-button-next-custom glass absolute right-0 top-1/2 z-10 -mr-4 -translate-y-1/2 cursor-pointer rounded-full p-3 transition-transform hover:scale-110"
        aria-label="Nächstes Produkt"
      >
        <FaChevronRight className="text-lg" />
      </button>

      {/* Custom Pagination */}
      <div className="swiper-pagination-custom mt-4 flex justify-center gap-2" />
    </div>
  );
};

export default HandmadeCarousel;
