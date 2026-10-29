// Runs after `next build`: the standalone server needs static assets and
// public/ copied next to it (Next.js leaves this to the deployer).
import { cpSync, existsSync } from "node:fs";

if (existsSync(".next/standalone")) {
  cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
  if (existsSync("public")) cpSync("public", ".next/standalone/public", { recursive: true });
  console.log("Standalone server ready: npm start");
}
