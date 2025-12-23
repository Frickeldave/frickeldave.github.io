import React, { useState } from "react";
import { FaRegFolder, FaRegClock, FaRegCalendarAlt } from "react-icons/fa";

type BlogPostData = {
  id: string;
  title: string;
  description?: string;
  date?: string;
  categories?: string[];
  readingTime?: string;
};

type TabConfig = {
  id: string;
  label: string;
  posts: BlogPostData[];
};

interface Props {
  tabs: TabConfig[];
  title?: string;
}

const TabPostsList: React.FC<Props> = ({ tabs, title }) => {
  const [activeTab, setActiveTab] = useState(0);

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ): void => {
    if (event.key === "ArrowRight") {
      setActiveTab((index + 1) % tabs.length);
    } else if (event.key === "ArrowLeft") {
      setActiveTab((index - 1 + tabs.length) % tabs.length);
    }
  };

  return (
    <div className="tab-posts-list">
      {/* Tab Navigation */}
      <div className="glass mb-6 overflow-hidden rounded-lg">
        {title && (
          <h2 className="border-b border-border px-6 py-4 text-center text-3xl font-bold dark:border-darkmode-border">
            {title}
          </h2>
        )}
        <div className="flex flex-wrap border-b border-border dark:border-darkmode-border">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === index}
              tabIndex={activeTab === index ? 0 : -1}
              className={`cursor-pointer px-6 py-3 text-lg font-medium transition-colors
                ${
                  activeTab === index
                    ? "border-b-2 border-txt-p text-txt-p dark:border-darkmode-txt-p dark:text-darkmode-txt-p"
                    : "text-txt-s hover:text-txt-p dark:text-darkmode-txt-s dark:hover:text-darkmode-txt-p"
                }`}
              onClick={() => setActiveTab(index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tabs.map((tab, tabIndex) => (
        <div
          key={tab.id}
          role="tabpanel"
          className={activeTab === tabIndex ? "block" : "hidden"}
        >
          {tab.posts.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tab.posts.map((post) => (
                <a
                  key={post.id}
                  href={`/blog/${post.id}`}
                  className="group block h-full no-underline"
                >
                  <div className="glass h-full rounded-lg p-4 transition-transform group-hover:scale-105">
                    <h4 className="mb-2 group-hover:text-txt-p dark:group-hover:text-darkmode-txt-p">
                      {post.title}
                    </h4>
                    <ul className="mb-2 list-none p-0 text-sm">
                      {post.categories && post.categories.length > 0 && (
                        <li className="mr-2 inline-block">
                          <FaRegFolder className="-mt-1 mr-1 inline-block" />
                          {post.categories[0]}
                        </li>
                      )}
                      {post.date && (
                        <li className="mr-2 inline-block">
                          <FaRegCalendarAlt className="-mt-1 mr-1 inline-block" />
                          {post.date}
                        </li>
                      )}
                      {post.readingTime && (
                        <li className="inline-block">
                          <FaRegClock className="-mt-1 mr-1 inline-block" />
                          {post.readingTime}
                        </li>
                      )}
                    </ul>
                    {post.description && (
                      <p className="line-clamp-3 text-sm opacity-80">
                        {post.description}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="glass rounded-lg p-8 text-center">
              <p className="text-txt-s dark:text-darkmode-txt-s">
                Noch keine Beiträge in dieser Kategorie.
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default TabPostsList;
