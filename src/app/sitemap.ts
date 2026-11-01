import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { seedSchemes } from "@/lib/schemes/seed";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = env().baseUrl;
  const now = new Date();

  const schemes = seedSchemes().map((scheme) => ({
    url: `${baseUrl}/schemes/${scheme.id}`,
    lastModified: scheme.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/try`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/resources/official-sources`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    ...schemes,
  ];
}
