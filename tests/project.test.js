import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("la demo ofrece acceso explícito y accesible", async () => {
  const html = await readFile("index.html", "utf8");
  assert.match(html, /id="demoLoginBtn"/);
  assert.match(html, />Ingresar a la demo</);
});

test("la PWA precachea el shell y los datos base", async () => {
  const sw = await readFile("sw.js", "utf8");
  for (const asset of ["index.html", "app.js", "manifest.webmanifest", "data/initial-data.json"]) assert.ok(sw.includes(asset));
});

test("la migración habilita RLS y evita duplicados de sincronización", async () => {
  const sql = await readFile("supabase/migrations/202608020001_core.sql", "utf8");
  assert.match(sql, /enable row level security/gi);
  assert.match(sql, /unique \(organization_id, sync_id\)/i);
  assert.match(sql, /auth\.uid\(\)/);
});
