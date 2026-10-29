"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/** Fades content up as it enters the viewport (IntersectionObserver, runs once). */
export default function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className = "",
  ...rest
}: {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
  [key: string]: unknown;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      data-visible={visible}
      style={{ "--delay": `${delay}ms` } as React.CSSProperties}
      {...rest}
    >
      {children}
    </Tag>
  );
}
