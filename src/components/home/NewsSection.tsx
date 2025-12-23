import React, { useState, useEffect } from "react";
import { FaRegCalendarAlt } from "react-icons/fa";

type NewsItem = {
  visible: boolean;
  date: string;
  text: string;
  imageUrl?: string;
};

type NewsData = {
  news: NewsItem[];
};

interface Props {
  maxItems?: number;
}

const formatNewsDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("de-DE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const NewsSection: React.FC<Props> = ({ maxItems = 5 }) => {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasVisibleNews, setHasVisibleNews] = useState(false);

  useEffect(() => {
    fetch("/data/news.json")
      .then((res) => res.json())
      .then((data: NewsData) => {
        const visibleNews = data.news
          .filter((item) => item.visible)
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          )
          .slice(0, maxItems);

        setNewsItems(visibleNews);
        setHasVisibleNews(visibleNews.length > 0);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load news:", err);
        setLoading(false);
      });
  }, [maxItems]);

  // Don't render anything if loading or no visible news
  if (loading || !hasVisibleNews) {
    return null;
  }

  return (
    <div className="news-section">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {newsItems.map((item, index) => (
          <article
            key={`news-${item.date}-${index}`}
            className="glass overflow-hidden rounded-lg"
          >
            {item.imageUrl && (
              <div className="aspect-video overflow-hidden">
                <img
                  src={item.imageUrl}
                  alt=""
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
              <p className="text-base">{item.text}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default NewsSection;
