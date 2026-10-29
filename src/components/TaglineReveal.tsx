"use client";

import { useEffect, useRef } from "react";

/**
 * Large tagline whose words move from muted to full colour, one at a time, as
 * each crosses a trigger line in the viewport. Each word has its own observer.
 */
export default function TaglineReveal({ lines }: { lines: string[] }) {
  const root = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const words = root.current?.querySelectorAll<HTMLSpanElement>("[data-word]");
    if (!words?.length) return;
    // Trigger line sits 35% up from the bottom of the viewport.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          (e.target as HTMLElement).dataset.on = String(e.isIntersecting || e.boundingClientRect.top < 0);
        }
      },
      { rootMargin: "0px 0px -35% 0px", threshold: 1 },
    );
    words.forEach((w) => io.observe(w));
    return () => io.disconnect();
  }, []);

  return (
    <h2 className="tagline" ref={root}>
      {lines.map((line, li) => (
        <span key={li} className="tagline-line">
          {line.split(" ").map((w, wi) => (
            // --w staggers words on the same line so they light up in reading order.
            <span key={wi} data-word style={{ "--w": wi } as React.CSSProperties}>
              {w}{" "}
            </span>
          ))}
        </span>
      ))}
    </h2>
  );
}
