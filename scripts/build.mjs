import { cp, mkdir, rm } from "node:fs/promises";
const files = ["index.html", "app.js", "styles.css", "supabase-lite.js", "config.js", "sw.js", "manifest.webmanifest", "icon.svg", "data"];
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
for (const file of files) await cp(file, `dist/${file}`, { recursive: true });
console.log("Build estático generado en dist/");
