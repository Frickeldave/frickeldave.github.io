import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import {
  FaChevronLeft,
  FaChevronRight,
  FaRegCalendarAlt,
} from "react-icons/fa";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

type NewsItemWithImage = {
  visible: boolean;
  date: string;
  title: string;
  text: string;
  imageUrl: string;
};

interface Props {
  news: NewsItemWithImage[];
}

const formatNewsDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("de-DE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const NewsCarousel: React.FC<Props> = ({ news }) => {
  if (!news || news.length === 0) {
    return null;
  }

  return (
    <div className="news-carousel relative">
      <Swiper
        modules={[Autoplay, Navigation, Pagination]}
        spaceBetween={24}
        slidesPerView={1}
        navigation={{
          prevEl: ".swiper-button-prev-news",
          nextEl: ".swiper-button-next-news",
        }}
        pagination={{
          clickable: true,
          el: ".swiper-pagination-news",
        }}
        autoplay={{
          delay: 5000,
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
        {news.map((item, index) => (
          <SwiperSlide key={`news-${item.date}-${index}`}>
            <article className="glass h-full overflow-hidden rounded-lg transition-transform hover:scale-105">
              {item.imageUrl && (
                <div className="aspect-video overflow-hidden">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="mb-2 flex items-center gap-2 text-sm opacity-70">
                  <FaRegCalendarAlt className="inline-block" />
                  <time dateTime={item.date}>{formatNewsDate(item.date)}</time>
                </div>
                <h4 className="mb-2 text-lg font-bold">{item.title}</h4>
                <p className="line-clamp-3 text-sm opacity-80">{item.text}</p>
              </div>
            </article>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Custom Navigation */}
      <button
        className="swiper-button-prev-news glass absolute left-0 top-1/2 z-10 -ml-4 -translate-y-1/2 cursor-pointer rounded-full p-3 transition-transform hover:scale-110"
        aria-label="Vorherige News"
      >
        <FaChevronLeft className="text-lg" />
      </button>
      <button
        className="swiper-button-next-news glass absolute right-0 top-1/2 z-10 -mr-4 -translate-y-1/2 cursor-pointer rounded-full p-3 transition-transform hover:scale-110"
        aria-label="Nächste News"
      >
        <FaChevronRight className="text-lg" />
      </button>

      {/* Custom Pagination */}
      <div className="swiper-pagination-news mt-4 flex justify-center gap-2" />
    </div>
  );
};

export default NewsCarousel;
