"use client";

import { ArrowUpRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

export interface SchemeCard {
  id: string;
  name: string;
  benefit: string;
  ministry: string;
  level: "central" | "state";
  url: string;
  tags: string[];
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "farmers", label: "Farmers" },
  { id: "students", label: "Students & youth" },
  { id: "women", label: "Women & girls" },
  { id: "seniors", label: "Seniors" },
  { id: "workers", label: "Workers & business" },
  { id: "health", label: "Health & disability" },
  { id: "kerala", label: "Kerala" },
];

export default function SchemeExplorer({ schemes }: { schemes: SchemeCard[] }) {
  const [filter, setFilter] = useState("all");
  const list = filter === "all" ? schemes : schemes.filter((s) => s.tags.includes(filter));

  return (
    <div>
      <div className="filters" role="toolbar" aria-label="Filter schemes">
        {FILTERS.map((f) => {
          const count = f.id === "all" ? schemes.length : schemes.filter((s) => s.tags.includes(f.id)).length;
          return (
            <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
              <span className="count">{count}</span>
            </button>
          );
        })}
      </div>
      <ul className="scheme-grid" key={filter}>
        {list.map((s, i) => (
          <li key={s.id} className="scheme-card" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
            <div className="scheme-top">
              <span className={`level ${s.level}`}>{s.level === "central" ? "Central" : "Kerala"}</span>
              <a href={s.url} target="_blank" rel="noreferrer" aria-label={`Official site for ${s.name}`}>
                <ArrowUpRight size={18} weight="bold" />
              </a>
            </div>
            <h3>
              <Link href={`/schemes/${s.id}`}>{s.name}</Link>
            </h3>
            <p>{s.benefit}</p>
            <span className="ministry">{s.ministry}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
