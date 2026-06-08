import React, { useRef } from "react";
import {
  FaChevronLeft,
  FaChevronRight,
  FaRegCalendarAlt,
} from "react-icons/fa";

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
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!news || news.length === 0) {
    return null;
  }

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.offsetWidth;
    el.scrollLeft = el.scrollLeft + (direction === "left" ? -amount : amount);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => scroll("left")}
        className="glass flex-none cursor-pointer rounded-full p-3 transition-transform hover:scale-110"
        aria-label="Vorherige News"
      >
        <FaChevronLeft className="text-lg" />
      </button>

      <div
        ref={scrollRef}
        className="flex flex-1 gap-6 overflow-x-auto pb-4"
        style={{ scrollbarWidth: "none" }}
      >
        {news.map((item, index) => (
          <article
            key={`news-${item.date}-${index}`}
            className="glass w-[calc(100%-1rem)] flex-none overflow-hidden rounded-lg transition-transform hover:scale-105 sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1rem)] xl:w-[calc(25%-1rem)]"
          >
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
        ))}
      </div>

      <button
        type="button"
        onClick={() => scroll("right")}
        className="glass flex-none cursor-pointer rounded-full p-3 transition-transform hover:scale-110"
        aria-label="Nächste News"
      >
        <FaChevronRight className="text-lg" />
      </button>
    </div>
  );
};

export default NewsCarousel;
