import { marked } from "marked";
import React, { useEffect, useRef, useState } from "react";

marked.use({
  mangle: false,
  headerIds: false,
});

const Tabs = ({ children }: { children: React.ReactElement }) => {
  const [active, setActive] = useState<number>(0);
  const [defaultFocus, setDefaultFocus] = useState<boolean>(false);

  const tabRefs: React.RefObject<HTMLElement[]> = useRef([]);
  useEffect(() => {
    if (defaultFocus) {
      // @ts-expect-error - tabRefs array access needs proper typing
      tabRefs.current[active]?.focus();
    } else {
      setDefaultFocus(true);
    }
  }, [active]);

  const tabLinks = Array.from(
    children.props.value.matchAll(
      /<div\s+data-name="([^"]+)"[^>]*>(.*?)<\/div>/gs
    ),
    (match: RegExpMatchArray) => ({ name: match[1], children: match[0] })
  );

  const handleKeyDown = (
    event: React.KeyboardEvent<EventTarget>,
    index: number
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      setActive(index);
    } else if (event.key === "ArrowRight") {
      setActive((active + 1) % tabLinks.length);
    } else if (event.key === "ArrowLeft") {
      setActive((active - 1 + tabLinks.length) % tabLinks.length);
    }
  };

  return (
    <div className="border-border dark:border-darkmode-border overflow-hidden rounded-lg border">
      <ul className="glass-t-borderless border-border dark:border-darkmode-border m-0 flex list-none border-b">
        {tabLinks.map(
          (item: { name: string; children: string }, index: number) => (
            <li
              key={index}
              className={`border-border text-txt-s dark:border-darkmode-border dark:text-darkmode-txt-s my-0 cursor-pointer border-b-[3px] px-8 pt-2 pb-1 text-lg ${index === active && "border-txt-p text-txt-p dark:border-darkmode-txt-p dark:text-darkmode-txt-p border-b-[3px]"} `}
              role="tab"
              tabIndex={index === active ? 0 : -1}
              onKeyDown={(event) => handleKeyDown(event, index)}
              onClick={() => setActive(index)}
              // @ts-expect-error - ref assignment to array needs proper typing
              ref={(ref) => (tabRefs.current[index] = ref)}
            >
              {item.name}
            </li>
          )
        )}
      </ul>
      {tabLinks.map((item: { name: string; children: string }, i: number) => (
        <div
          className={active === i ? "tab-content block px-5" : "hidden"}
          key={i}
          dangerouslySetInnerHTML={{
            __html: marked.parse(item.children),
          }}
        />
      ))}
    </div>
  );
};

export default Tabs;
