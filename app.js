const DB_NAME = "campo-hoy-integral-v8-3-vercel-paginado";
const DB_VERSION = 1;
const STORES = ["animals", "births", "health", "movements", "profiles", "heifers", "tasks", "meta"];
const PAGE_SIZE = 60;
const DAY = 86400000;

let db;
let supabase = null;
let session = null;
let deferredPrompt = null;
let activeEditor = null;
let offlineAccess = false;
let offlineUser = null;
let syncInProgress = false;
let sourceFiles = [];
let demoMode = false;

const state = {
  dairyPage: 1,
  heiferPage: 1,
  animalPage: 1,
  birthPage: 1,
  movementPage: 1,
  healthPage: 1,
  traceAnimal: "",
  drill: {
    task: null,
    dairy: null,
    heifer: null,
    animal: null,
    birth: null,
    movement: null,
    health: null,
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const uuid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const number = (value) => new Intl.NumberFormat("es-AR").format(Number(value || 0));
const percent = (value, total) => total ? `${(value * 100 / total).toFixed(1).replace(".", ",")}%` : "—";
const average = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

const EXTERNAL_SCRIPTS = {
  xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
};
const scriptPromises = new Map();
function loadExternalScript(name, src) {
  if (scriptPromises.has(name)) return scriptPromises.get(name);
  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-campo-lib="${name}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve(true);
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => reject(new Error(`No se pudo cargar ${name}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.campoLib = name;
    script.addEventListener("load", () => { script.dataset.loaded = "true"; resolve(true); }, { once: true });
    script.addEventListener("error", () => reject(new Error(`No se pudo cargar ${name}`)), { once: true });
    document.head.appendChild(script);
  }).catch((error) => { scriptPromises.delete(name); throw error; });
  scriptPromises.set(name, promise);
  return promise;
}
async function ensureSupabaseSdk() {
  return Boolean(window.supabase?.createClient);
}
async function ensureXlsxSdk() {
  if (window.XLSX?.read) return true;
  try {
    await loadExternalScript("xlsx", EXTERNAL_SCRIPTS.xlsx);
    return Boolean(window.XLSX?.read);
  } catch (error) {
    console.warn(error);
    return false;
  }
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function isoDate(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const d = new Date(Date.UTC(1899, 11, 30) + value * DAY);
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
function addDays(value, days) {
  const d = parseDate(value);
  if (!d) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysFromToday(value) {
  const d = parseDate(value);
  const t = parseDate(today());
  return d && t ? Math.round((d - t) / DAY) : null;
}
function fmtDate(value) {
  const d = parseDate(value);
  return d ? new Intl.DateTimeFormat("es-AR").format(d) : "—";
}
function fmtMonth(value) {
  const d = parseDate(`${value}-01`);
  return d ? new Intl.DateTimeFormat("es-AR", { month: "short" }).format(d).replace(".", "") : value;
}
function canonicalCaravana(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^0\.\d+$/.test(raw)) return raw.replace(".", "").padStart(4, "0");
  const digits = raw.replace(/\D/g, "");
  return digits || normalize(raw);
}
function canonicalFarm(value) {
  const v = normalize(value);
  if (v === "ino" || v === "ino 1" || v === "ino1" || v === "soto" || v.includes("recria")) return "Ino";
  if (v.includes("ino 2") || v === "ino2") return "Ino 2";
  if (v.includes("3 hnos") || v.includes("tres hnos") || v.includes("los 3")) return "Los 3 Hnos.";
  return String(value ?? "").trim();
}
function classifyRepro(value) {
  const v = normalize(value);
  if (["p", "prenada", "preñada", "positivo", "+"].includes(v) || v.startsWith("pre")) return "p";
  if (["v", "vacia", "vacía", "negativo", "-"].includes(v) || v.startsWith("vac")) return "v";
  if (v.includes("dud")) return "d";
  return "";
}
function movementQuantity(row) {
  const outgoing = Number(row.egreso_machos || 0) + Number(row.egreso_hembras || 0);
  const incoming = Number(row.ingreso_machos || 0) + Number(row.ingreso_hembras || 0);
  return Math.max(outgoing, incoming);
}
function movementKind(row) {
  const dest = normalize(row.establecimiento_destino);
  const obs = normalize(row.observacion);
  if (dest === "muerte") return "death";
  if (dest === "venta") return "sale";
  if (obs.includes("nacimiento") || normalize(row.lote_origen) === "nacidos" && !dest) return "birth";
  return "internal";
}
function dayText(days) {
  if (days === null) return "Sin fecha";
  if (days < 0) return `${Math.abs(days)} días vencido`;
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `En ${days} días`;
}
function dayClass(days) {
  if (days === null) return "";
  if (days < 0) return "day-overdue";
  if (days <= 7) return "day-soon";
  return "";
}
function toneForDays(days) {
  if (days === null) return "neutral";
  if (days < 0) return "danger";
  if (days <= 7) return "warn";
  return "info";
}
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}

function drillCode(...parts) {
  return parts.map((part) => encodeURIComponent(String(part ?? ""))).join("|");
}
function drillParts(code = "") {
  return String(code).split("|").map((part) => decodeURIComponent(part));
}
function drillAttrs(code, label = "Ver detalle") {
  return code ? ` data-drill="${esc(code)}" aria-label="${esc(label)}" title="${esc(label)}"` : "";
}
function kpi(label, value, hint = "", tone = "", drill = "") {
  const content = `<span class="label">${esc(label)}</span><span class="value">${esc(value)}</span><span class="hint">${esc(hint)}</span>${drill ? '<span class="drill-hint">Ver detalle →</span>' : ""}`;
  return drill
    ? `<button type="button" class="kpi ${tone} drillable"${drillAttrs(drill, `${label}: ver detalle`)}>${content}</button>`
    : `<div class="kpi ${tone}">${content}</div>`;
}
function badge(text, tone = "") {
  return `<span class="badge ${tone}">${esc(text)}</span>`;
}
function progress(label, value, total, tone = "", drill = "") {
  const width = total ? Math.min(100, value * 100 / total) : 0;
  const content = `<span class="progress-label"><span>${esc(label)}</span><b>${number(value)} · ${percent(value, total)}</b></span><span class="progress ${tone}"><span style="width:${width}%"></span></span>${drill ? '<span class="drill-inline">Ver animales →</span>' : ""}`;
  return drill
    ? `<button type="button" class="progress-row drillable-row"${drillAttrs(drill, `${label}: ver animales`)}>${content}</button>`
    : `<div class="progress-row">${content}</div>`;
}
function metricRow(label, valueHtml, drill = "", detail = "") {
  const content = `<span><b class="metric-title">${esc(label)}</b>${detail ? `<small>${esc(detail)}</small>` : ""}</span><span class="metric-value">${valueHtml}</span>${drill ? '<span class="drill-arrow">›</span>' : ""}`;
  return drill
    ? `<button type="button" class="metric-row drillable-row"${drillAttrs(drill, `${label}: ver detalle`)}>${content}</button>`
    : `<div class="metric-row">${content}</div>`;
}
function categoryRow(label, value, drill = "") {
  const content = `<span>${esc(label)}</span><b>${number(value)}</b>${drill ? '<span class="drill-arrow">›</span>' : ""}`;
  return drill
    ? `<button type="button" class="category-row drillable-row"${drillAttrs(drill, `${label}: ver animales`)}>${content}</button>`
    : `<div class="category-row">${content}</div>`;
}
function flowStep(title, value, detail = "", drill = "") {
  const content = `<span><b>${esc(title)}</b><small>${esc(detail)}</small></span><strong>${number(value)}</strong>${drill ? '<span class="drill-arrow">›</span>' : ""}`;
  return drill
    ? `<button type="button" class="flow-step drillable-row"${drillAttrs(drill, `${title}: ver detalle`)}>${content}</button>`
    : `<div class="flow-step">${content}</div>`;
}
function traceButton(value, farm = "") {
  const id = String(value ?? "").trim();
  if (!id) return "—";
  return `<button type="button" class="trace-link" data-open-trace="${esc(id)}" data-trace-farm="${esc(farm)}" title="Abrir historia del animal">${esc(id)}</button>`;
}
function resultsBar(total, label = "", viewKey = "", note = "") {
  return `<div class="results-bar"><div><b>${number(total)} resultados</b>${label ? `<span> · ${esc(label)}</span>` : ""}${note ? `<small>${esc(note)}</small>` : ""}</div>${viewKey ? `<button type="button" class="mini-button" data-clear-view="${esc(viewKey)}">Limpiar filtros</button>` : ""}</div>`;
}
function sourceCard(title, detail, source, drill = "") {
  const content = `<b>${esc(title)}</b><p>${esc(detail)} · ${esc(source)}</p>${drill ? '<span class="drill-hint">Abrir datos →</span>' : ""}`;
  return drill ? `<button type="button" class="source-card drillable"${drillAttrs(drill, `${title}: abrir datos`)}>${content}</button>` : `<div class="source-card">${content}</div>`;
}
function auditCard(issue) {
  const tone = issue.severity === "warning" ? "warn" : issue.severity === "error" ? "danger" : "info";
  const icon = issue.severity === "warning" ? "⚠" : issue.severity === "error" ? "!" : "i";
  return `<button type="button" class="alert ${tone} drillable audit-card"${drillAttrs(drillCode("audit", issue.id), `${issue.title}: ver detalle`)}><span class="alert-icon">${icon}</span><span><strong>${esc(issue.area ? `${issue.area} · ${issue.title}` : issue.title)}</strong><p>${esc(issue.detail)}</p><span class="drill-hint">Ver detalle →</span></span></button>`;
}
function table(headers, rows, empty = "No hay registros para este filtro") {
  if (!rows.length) return `<div class="empty">${esc(empty)}</div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}
function paginate(items, key) {
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  state[key] = Math.max(1, Math.min(state[key], pages));
  return { items: items.slice((state[key] - 1) * PAGE_SIZE, state[key] * PAGE_SIZE), page: state[key], pages, total: items.length, key };
}
function pager(p) {
  if (p.pages <= 1) return "";
  return `<div class="pager"><span>${number(p.total)} registros · página ${p.page} de ${p.pages}</span><div class="pager-buttons"><button class="mini-button" data-page="${p.key}" data-delta="-1" ${p.page === 1 ? "disabled" : ""}>Anterior</button><button class="mini-button" data-page="${p.key}" data-delta="1" ${p.page === p.pages ? "disabled" : ""}>Siguiente</button></div></div>`;
}
function alertBox(tone, title, detail, icon = "•") {
  return `<div class="alert ${tone}"><div class="alert-icon">${icon}</div><div><strong>${esc(title)}</strong><p>${esc(detail)}</p></div></div>`;
}
function simpleBars(series, labels) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  return `<div class="chart-bars">${labels.map((label, i) => `<div class="chart-group" title="${esc(label)}">${series.map((s) => `<div class="chart-bar ${s.className || ""}" style="height:${Math.max(2, (s.values[i] || 0) * 100 / max)}%" title="${esc(s.name)}: ${number(s.values[i] || 0)}"></div>`).join("")}</div>`).join("")}</div><div class="chart-labels">${labels.map((l) => `<span>${esc(l)}</span>`).join("")}</div><div class="legend">${series.map((s) => `<span><i class="${s.className || ""}"></i>${esc(s.name)}</span>`).join("")}</div>`;
}

async function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const database = req.result;
      for (const name of STORES) if (!database.objectStoreNames.contains(name)) database.createObjectStore(name, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function objectStore(name, mode = "readonly") {
  return db.transaction(name, mode).objectStore(name);
}
function all(name) {
  return new Promise((resolve, reject) => {
    const req = objectStore(name).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
function getOne(name, id) {
  return new Promise((resolve, reject) => {
    const req = objectStore(name).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
function put(name, value) {
  return new Promise((resolve, reject) => {
    const req = objectStore(name, "readwrite").put(value);
    req.onsuccess = () => resolve(value);
    req.onerror = () => reject(req.error);
  });
}
function remove(name, id) {
  return new Promise((resolve, reject) => {
    const req = objectStore(name, "readwrite").delete(id);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
}
function bulkPut(name, values) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, "readwrite");
    const store = tx.objectStore(name);
    values.forEach((v) => store.put(v));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
function clear(name) {
  return new Promise((resolve, reject) => {
    const req = objectStore(name, "readwrite").clear();
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
}
async function replaceWhere(name, predicate, values) {
  const existing = await all(name);
  await clear(name);
  await bulkPut(name, [...existing.filter((x) => !predicate(x)), ...values]);
}
async function getMeta(id) { return getOne("meta", id); }
async function setMeta(id, payload) { return put("meta", { id, ...payload, updated_at: now() }); }

async function loadOfflineAccess() {
  const marker = (await getMeta("offline-access"))?.value;
  offlineAccess = Boolean(marker?.enabled && marker?.user_id);
  offlineUser = offlineAccess ? marker : null;
}
async function rememberOfflineAccess(user) {
  if (!user?.id) return;
  offlineAccess = true;
  offlineUser = { enabled: true, user_id: user.id, email: user.email || "", last_online_auth: now() };
  await setMeta("offline-access", { value: offlineUser });
}
async function forgetOfflineAccess() {
  offlineAccess = false;
  offlineUser = null;
  await remove("meta", "offline-access");
}
async function queueRemoteDeletion(type, id) {
  const current = (await getMeta("pending-remote-deletions"))?.value || [];
  const key = `${type}:${id}`;
  const next = current.filter((item) => `${item.type}:${item.id}` !== key);
  next.push({ type, id, queued_at: now() });
  await setMeta("pending-remote-deletions", { value: next });
}
async function flushPendingRemoteDeletions() {
  if (!supabase || !session || !navigator.onLine) return false;
  const pending = (await getMeta("pending-remote-deletions"))?.value || [];
  for (const item of pending) {
    const result = await supabase.from("campo_records").delete()
      .eq("owner_id", session.user.id)
      .eq("entity_type", item.type)
      .eq("record_id", item.id);
    if (result.error) throw result.error;
  }
  if (pending.length) await setMeta("pending-remote-deletions", { value: [] });
  return true;
}

async function seed() {
  const seedMarker = await getMeta("seed-v8-2");
  const existing = await Promise.all(["animals", "births", "health", "movements", "profiles", "heifers"].map((name) => all(name)));
  if (seedMarker && existing.some((rows) => rows.length)) return;
  const fetchJson = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Falta el archivo ${url}`);
    return response.json();
  };
  const [initial, profilePayload, heiferPayload, auditPayload] = await Promise.all([
    fetchJson("data/initial-data.json"),
    fetchJson("data/profiles.json"),
    fetchJson("data/heifers.json"),
    fetchJson("data/audit.json"),
  ]);
  await bulkPut("animals", initial.animals || []);
  await bulkPut("births", initial.births || []);
  await bulkPut("health", initial.health || []);
  await bulkPut("movements", initial.movements || []);
  await bulkPut("profiles", profilePayload.records || []);
  await bulkPut("heifers", heiferPayload.records || []);
  await setMeta("stock", { value: initial.stock_summary || { total: 0, establecimientos: [] } });
  await setMeta("sources", {
    value: {
      profiles: profilePayload.metadata,
      profile_summaries: profilePayload.summaries,
      heifers: heiferPayload.metadata,
      heifer_summary: heiferPayload.summary,
      base: initial.metadata,
    },
  });
  await setMeta("audit", { value: auditPayload });
  await setMeta("seed-v8-2", { value: true });
}
async function stockSummary() { return (await getMeta("stock"))?.value || { total: 0, establecimientos: [] }; }
async function sourceMeta() { return (await getMeta("sources"))?.value || {}; }
async function auditMeta() { return (await getMeta("audit"))?.value || { issues: [] }; }

function birthMatchesAnimal(birth, farm, caravana, earliest) {
  const mother = canonicalCaravana(birth.madre);
  const id = canonicalCaravana(caravana);
  if (!mother || !id || mother !== id) return false;
  if (farm && canonicalFarm(birth.establecimiento) !== canonicalFarm(farm)) return false;
  return !earliest || (birth.fecha && birth.fecha >= earliest);
}
function activeDairyRows(rows) {
  return rows.filter((x) => Boolean(x.activo || x.categoria_activa));
}
function activeHeiferRows(rows) {
  return rows.filter((x) => x.activo_entorada);
}
function hasBirthAfterFpp(row, births, farm) {
  if (!row.fecha_probable_parto && !row.fpp) return false;
  const fpp = row.fecha_probable_parto || row.fpp;
  const earliest = addDays(fpp, -45);
  if (farm === "Ino") {
    return births.some((b) => ["Ino 2", "Los 3 Hnos."].includes(canonicalFarm(b.establecimiento)) && birthMatchesAnimal(b, "", row.caravana || row.numero, earliest));
  }
  return births.some((b) => birthMatchesAnimal(b, farm, row.caravana || row.numero, earliest));
}
function buildCalvings(profiles, heifers, births) {
  const dairy = activeDairyRows(profiles)
    .filter((x) => classifyRepro(x.resultado_tacto) === "p" && x.fecha_probable_parto)
    .map((x) => ({
      id: `calving-profile-${x.id}`,
      source_id: x.id,
      source_store: "profiles",
      animal: x.caravana,
      farm: canonicalFarm(x.establecimiento),
      category: x.categoria,
      fpp: x.fecha_probable_parto,
      last_service: x.fecha_ultimo_servicio,
      source: "Perfil de Rodeo",
      days: daysFromToday(x.fecha_probable_parto),
      closed_by_birth: hasBirthAfterFpp(x, births, canonicalFarm(x.establecimiento)),
    }));
  const young = activeHeiferRows(heifers)
    .filter((x) => classifyRepro(x.resultado) === "p" && x.fpp)
    .map((x) => ({
      id: `calving-heifer-${x.id}`,
      source_id: x.id,
      source_store: "heifers",
      animal: x.caravana || x.numero,
      farm: "Ino",
      origin: canonicalFarm(x.origen),
      category: "Vaquillona con toro",
      fpp: x.fpp,
      last_service: x.fecha_entore,
      source: "Vaquillas con toro",
      days: daysFromToday(x.fpp),
      closed_by_birth: hasBirthAfterFpp(x, births, "Ino"),
    }));
  return [...dairy, ...young].filter((x) => !x.closed_by_birth && x.days !== null && x.days >= -90 && x.days <= 365);
}
function calvingBand(days) {
  if (days < -45) return "stale";
  if (days < 0) return "overdue";
  if (days <= 30) return "0_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return "later";
}
function dairyRowHasActiveCalving(row, births) {
  if (classifyRepro(row.resultado_tacto) !== "p" || !row.fecha_probable_parto) return false;
  return !hasBirthAfterFpp(row, births, canonicalFarm(row.establecimiento));
}
function matchesDairyDrill(row, drill, births) {
  if (!drill?.type || drill.type === "active") return true;
  const type = drill.type;
  const repro = classifyRepro(row.resultado_tacto);
  const fppDays = daysFromToday(row.fecha_probable_parto);
  const activeCalving = dairyRowHasActiveCalving(row, births);
  if (type === "milking") return normalize(row.categoria) === "ordene";
  if (type === "dry") return normalize(row.categoria) === "seca";
  if (type === "pregnant") return repro === "p";
  if (type === "not-pregnant") return repro !== "p";
  if (type === "calving-overdue") return activeCalving && fppDays !== null && fppDays >= -45 && fppDays < 0;
  if (type === "calving-0-30") return activeCalving && fppDays !== null && fppDays >= 0 && fppDays <= 30;
  if (type === "calving-31-60") return activeCalving && fppDays > 30 && fppDays <= 60;
  if (type === "calving-61-90") return activeCalving && fppDays > 60 && fppDays <= 90;
  if (type === "calving-later") return activeCalving && fppDays > 90;
  if (type === "to-dry") {
    const d = row.fecha_probable_parto ? daysFromToday(addDays(row.fecha_probable_parto, -60)) : null;
    return Boolean(row.secado_pendiente) || (normalize(row.categoria) === "ordene" && d !== null && d >= -45 && d <= 30);
  }
  if (type === "service35") return repro !== "p" && row.fecha_ultimo_servicio && daysFromToday(row.fecha_ultimo_servicio) <= -35;
  if (type === "reject") return Boolean(row.rechazo_pendiente) || ["venta", "rechaz", "cesion", "cesión"].some((term) => normalize(row.indicacion_baja).includes(normalize(term)));
  if (type === "aborts") return Boolean(row.aborto_ultimo_anio || row.fecha_ultimo_aborto);
  if (type === "sales") return Boolean(row.venta_ultimo_anio || normalize(row.indicacion_baja).includes("venta"));
  if (type === "deaths") return Boolean(row.muerte_ultimo_anio || normalize(row.indicacion_baja).includes("muerte"));
  return true;
}
function matchesHeiferDrill(row, drill) {
  if (!drill?.type || drill.type === "all") return true;
  const type = drill.type;
  const active = Boolean(row.activo_entorada);
  const result = classifyRepro(row.resultado);
  const fppDays = daysFromToday(row.fpp);
  const tactoDays = row.fecha_entore ? daysFromToday(addDays(row.fecha_entore, 35)) : null;
  if (type === "active") return active;
  if (type === "pregnant") return active && result === "p";
  if (type === "empty") return active && result === "v";
  if (type === "pending") return active && !result;
  if (type === "due") return active && !result && tactoDays !== null && tactoDays <= 0;
  if (type === "calving-overdue") return active && result === "p" && fppDays !== null && fppDays < 0;
  if (type === "calving-0-30") return active && result === "p" && fppDays !== null && fppDays >= 0 && fppDays <= 30;
  if (type === "calving-31-60") return active && result === "p" && fppDays > 30 && fppDays <= 60;
  if (type === "calving-61-90") return active && result === "p" && fppDays > 60 && fppDays <= 90;
  return true;
}
function matchesAnimalDrill(row, drill) {
  if (!drill) return true;
  if (drill.categories?.length && !drill.categories.includes(row.categoria)) return false;
  return true;
}
function matchesMovementDrill(row, drill) {
  if (!drill?.type) return true;
  const type = drill.type;
  if (type === "calves-to-ino") return canonicalFarm(row.establecimiento_destino) === "Ino" && normalize(row.lote_origen) === "nacidos";
  if (type === "heifers-to-dairy") return canonicalFarm(row.establecimiento_origen) === "Ino" && ["Ino 2", "Los 3 Hnos."].includes(canonicalFarm(row.establecimiento_destino)) && normalize(row.lote_origen).includes("vaq c/toro");
  if (type === "route") return String(row.establecimiento_origen || "—") === drill.origin && String(row.establecimiento_destino || row.lote_destino || "Stock") === drill.destination;
  return true;
}
function matchesHealthDrill(row, drill) {
  if (!drill?.type) return true;
  const d = daysFromToday(row.vencimiento);
  if (drill.type === "due30") return d !== null && d >= 0 && d <= 30;
  if (drill.type === "due90") return d !== null && d >= 0 && d <= 90;
  if (drill.type === "overdue") return d !== null && d < 0;
  return true;
}
function defaultTask(base) {
  return {
    status: "pending",
    priority: "medium",
    removed: false,
    updated_at: now(),
    ...base,
  };
}
function deriveTasks(profiles, heifers, health, births) {
  const tasks = [];
  const calvings = buildCalvings(profiles, heifers, births);
  for (const c of calvings) {
    if (c.days < -45 || c.days > 90) continue;
    tasks.push(defaultTask({
      id: `task-${c.id}`,
      source_kind: "derived",
      source_store: c.source_store,
      source_id: c.source_id,
      type: "parto",
      farm: c.farm,
      animal_id: c.animal,
      due_date: c.fpp,
      title: c.days < 0 ? `Registrar parto o corregir FPP · ${c.animal}` : `Parto esperado · ${c.animal}`,
      detail: `${c.source}${c.origin ? ` · origen ${c.origin}` : ""} · ${c.category || ""}`,
      priority: c.days < 0 || c.days <= 7 ? "high" : "medium",
      action_kind: "birth",
    }));
  }
  for (const row of activeDairyRows(profiles)) {
    const farm = canonicalFarm(row.establecimiento);
    if (classifyRepro(row.resultado_tacto) === "p" && normalize(row.categoria) === "ordene" && row.fecha_probable_parto) {
      const due = addDays(row.fecha_probable_parto, -60);
      const days = daysFromToday(due);
      if (days !== null && days >= -45 && days <= 90) tasks.push(defaultTask({
        id: `task-dry-${row.id}`,
        source_kind: "derived",
        source_store: "profiles",
        source_id: row.id,
        type: "secado",
        farm,
        animal_id: row.caravana,
        due_date: due,
        title: `Revisar secado · ${row.caravana}`,
        detail: `FPP ${fmtDate(row.fecha_probable_parto)} · ${row.dias_lactancia ?? "—"} días en lactancia`,
        priority: days < 0 ? "high" : "medium",
        action_kind: "profile",
      }));
    }
    if (row.rechazo_pendiente || normalize(row.indicacion_baja).includes("rechaz") || normalize(row.indicacion_baja).includes("venta") || normalize(row.indicacion_baja).includes("cesion")) {
      tasks.push(defaultTask({
        id: `task-reject-${row.id}`,
        source_kind: "derived",
        source_store: "profiles",
        source_id: row.id,
        type: "rechazo",
        farm,
        animal_id: row.caravana,
        due_date: row.fecha_perfil || today(),
        title: `Revisar rechazo o baja · ${row.caravana}`,
        detail: row.indicacion_baja || row.rechazo_total || "Indicación en Perfil de Rodeo",
        priority: "medium",
        action_kind: "profile",
      }));
    }
  }
  for (const row of activeHeiferRows(heifers)) {
    const result = classifyRepro(row.resultado);
    if (!result && row.fecha_entore) {
      const due = addDays(row.fecha_entore, 35);
      const days = daysFromToday(due);
      if (days !== null && days <= 120) tasks.push(defaultTask({
        id: `task-tacto-${row.id}`,
        source_kind: "derived",
        source_store: "heifers",
        source_id: row.id,
        type: "tacto",
        farm: "Ino",
        animal_id: row.caravana || row.numero,
        due_date: due,
        title: `Tactar vaquillona · ${row.caravana || row.numero}`,
        detail: `Entorada ${fmtDate(row.fecha_entore)} · toro ${row.toro || "—"} · origen ${row.origen || "—"}`,
        priority: days < 0 ? "high" : "medium",
        action_kind: "heifer",
      }));
    }
    if (result === "p" && row.fpp && normalize(row.en_tambo) !== "si" && normalize(row.en_tambo) !== "sí") {
      const due = addDays(row.fpp, -45);
      const days = daysFromToday(due);
      if (days !== null && days >= -30 && days <= 120) tasks.push(defaultTask({
        id: `task-transfer-${row.id}`,
        source_kind: "derived",
        source_store: "heifers",
        source_id: row.id,
        type: "movimiento",
        farm: "Ino",
        animal_id: row.caravana || row.numero,
        due_date: due,
        title: `Definir traslado de vaquillona · ${row.caravana || row.numero}`,
        detail: `FPP ${fmtDate(row.fpp)} · origen ${row.origen || "—"} · destino todavía sin definir`,
        priority: days < 0 ? "high" : "medium",
        action_kind: "heifer",
      }));
    }
  }
  const latestHealth = new Map();
  for (const row of health) {
    const key = `${canonicalFarm(row.establecimiento)}|${normalize(row.tratamiento)}`;
    const previous = latestHealth.get(key);
    if (!previous || String(row.fecha || "") > String(previous.fecha || "")) latestHealth.set(key, row);
  }
  for (const row of latestHealth.values()) {
    if (!row.vencimiento) continue;
    const days = daysFromToday(row.vencimiento);
    if (days === null || days < -365 || days > 180) continue;
    tasks.push(defaultTask({
      id: `task-health-${row.id}`,
      source_kind: "derived",
      source_store: "health",
      source_id: row.id,
      type: "sanidad",
      farm: canonicalFarm(row.establecimiento),
      due_date: row.vencimiento,
      title: row.tratamiento,
      detail: `${row.categoria || "Todo el rodeo"}${row.observacion ? ` · ${row.observacion}` : ""}`,
      priority: days < 0 || days <= 7 ? "high" : "medium",
      action_kind: "health",
    }));
  }
  return tasks;
}
async function mergedTasks() {
  const [profiles, heifers, health, births, saved] = await Promise.all([all("profiles"), all("heifers"), all("health"), all("births"), all("tasks")]);
  const derived = deriveTasks(profiles, heifers, health, births);
  const overrides = new Map(saved.map((x) => [x.id, x]));
  const result = derived.map((base) => ({ ...base, ...(overrides.get(base.id) || {}), derived_base: base }));
  const derivedIds = new Set(derived.map((x) => x.id));
  for (const task of saved) if (!derivedIds.has(task.id) && task.source_kind !== "derived") result.push(task);
  return result.filter((x) => !x.removed);
}

function taskStatusLabel(status) {
  return ({ pending: "Pendiente", in_progress: "En curso", done: "Realizada", dismissed: "Oculta" })[status] || status;
}
function taskTypeLabel(type) {
  return ({ parto: "Parto", tacto: "Tacto", secado: "Secado", sanidad: "Sanidad", movimiento: "Movimiento", rechazo: "Rechazo / baja", general: "General" })[type] || type;
}
function taskCard(task) {
  const days = daysFromToday(task.due_date);
  const status = task.status || "pending";
  const rowClass = `${days !== null && days < 0 && status !== "done" ? "overdue" : days === 0 ? "today" : ""} ${status === "done" ? "done" : ""}`;
  const checkText = status === "done" ? "✓" : status === "in_progress" ? "▶" : "";
  const stateAction = status === "pending" ? "Iniciar" : status === "in_progress" ? "Completar" : status === "done" ? "Reabrir" : "Activar";
  return `<div class="task-card ${rowClass}">
    <button class="task-check ${status}" data-task-cycle="${task.id}" title="${stateAction}">${checkText}</button>
    <div class="task-main"><h3>${esc(task.title)}</h3><p>${esc(task.detail || "")}</p><div class="task-meta">${badge(taskStatusLabel(status), status === "done" ? "" : status === "in_progress" ? "info" : status === "dismissed" ? "neutral" : "warn")}${badge(taskTypeLabel(task.type), "neutral")}${task.farm ? badge(task.farm, "info") : ""}${task.animal_id ? `<button class="badge neutral badge-button" data-open-trace="${esc(task.animal_id)}" data-trace-farm="${esc(task.farm || "")}">Animal ${esc(task.animal_id)} · ver ficha</button>` : ""}<span class="badge ${toneForDays(days)}">${esc(fmtDate(task.due_date))} · ${esc(dayText(days))}</span></div></div>
    <div class="task-actions"><button class="mini-button" data-task-cycle="${task.id}">${stateAction}</button>${task.action_kind === "birth" ? `<button class="mini-button" data-task-action="birth" data-task-id="${task.id}">Registrar parto</button>` : ""}${task.action_kind === "heifer" ? `<button class="mini-button" data-task-action="heifer" data-task-id="${task.id}">Cargar dato</button>` : ""}<button class="mini-button" data-edit-task="${task.id}">Editar</button>${status === "dismissed" ? `<button class="mini-button" data-reactivate-task="${task.id}">Reactivar</button>` : `<button class="mini-button" data-dismiss-task="${task.id}">Ocultar</button>`}<button class="mini-button" data-delete-task="${task.id}">Eliminar</button></div>
  </div>`;
}

async function renderControl() {
  const [profiles, heifers, births, movements, stock, tasks, audit] = await Promise.all([all("profiles"), all("heifers"), all("births"), all("movements"), stockSummary(), mergedTasks(), auditMeta()]);
  const farm = $("#controlFarm").value;
  const horizon = Number($("#controlHorizon").value || 90);
  const calvings = buildCalvings(profiles, heifers, births).filter((x) => (!farm || x.farm === farm) && x.days >= -45 && x.days <= horizon);
  const overdue = calvings.filter((x) => x.days < 0);
  const future = calvings.filter((x) => x.days >= 0);
  const openTasks = tasks.filter((x) => ["pending", "in_progress"].includes(x.status) && (!farm || x.farm === farm));
  const dueTasks = openTasks.filter((x) => { const d = daysFromToday(x.due_date); return d !== null && d <= horizon; });
  const year = today().slice(0, 4);
  const yearBirths = births.filter((x) => x.fecha?.startsWith(year) && (!farm || canonicalFarm(x.establecimiento) === farm));
  $("#controlKpis").innerHTML = [
    kpi("Stock declarado", number(farm ? stock.establecimientos.find((x) => x.nombre === farm)?.total || 0 : stock.total), farm || "Toda la explotación", "good", drillCode("control-stock")),
    kpi(`Partos próximos · ${horizon} días`, number(future.length), `${number(overdue.length)} fechas vencidas activas`, future.length ? "warn" : "good", drillCode("control-calvings")),
    kpi("Tareas abiertas", number(dueTasks.length), `${number(dueTasks.filter((x) => daysFromToday(x.due_date) < 0).length)} vencidas`, dueTasks.some((x) => daysFromToday(x.due_date) < 0) ? "danger" : "", drillCode("control-tasks")),
    kpi(`Nacimientos ${year}`, number(yearBirths.length), `${number(yearBirths.filter((x) => x.parto_vivo).length)} vivos · ${number(yearBirths.filter((x) => x.parto_muerto).length)} muertos`, "good", drillCode("control-births")),
  ].join("");
  const priority = dueTasks.sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999") || (a.priority === "high" ? -1 : 1)).slice(0, 8);
  $("#controlAgenda").innerHTML = priority.length ? priority.map(taskCard).join("") : `<div class="empty">No hay tareas abiertas para este filtro.</div>`;
  const cRows = [...overdue, ...future].sort((a, b) => a.days - b.days).slice(0, 12);
  $("#controlCalving").innerHTML = cRows.length ? cRows.map((x) => metricRow(`${x.animal} · ${x.farm}`, `${badge(fmtDate(x.fpp), toneForDays(x.days))}<small class="${dayClass(x.days)}">${esc(dayText(x.days))}</small>`, drillCode("trace", x.animal, x.farm), x.source)).join("") : `<div class="empty">No hay partos activos en el horizonte elegido.</div>`;
  let farms = stock.establecimientos;
  if (farm) farms = farms.filter((x) => x.nombre === farm);
  $("#controlStock").innerHTML = farms.map((f) => `<div class="farm-card"><h3>${esc(f.nombre)}</h3><button type="button" class="farm-total-link" data-drill="${esc(drillCode("animal-farm", f.nombre))}"><span class="farm-total">${number(f.total)}</span><small>animales declarados · ver detalle</small></button>${f.categorias.map((c) => categoryRow(c.categoria, c.cantidad, drillCode("animal-category", f.nombre, c.categoria))).join("")}</div>`).join("");
  const yearMov = movements.filter((x) => x.fecha?.startsWith(year) && (!farm || canonicalFarm(x.establecimiento_origen) === farm || canonicalFarm(x.establecimiento_destino) === farm));
  const movedCalves = yearMov.filter((x) => canonicalFarm(x.establecimiento_destino) === "Ino" && normalize(x.lote_origen) === "nacidos").reduce((s, x) => s + movementQuantity(x), 0);
  const heifersToDairy = yearMov.filter((x) => canonicalFarm(x.establecimiento_origen) === "Ino" && ["Ino 2", "Los 3 Hnos."].includes(canonicalFarm(x.establecimiento_destino)) && normalize(x.lote_origen).includes("vaq c/toro")).reduce((s, x) => s + movementQuantity(x), 0);
  const sales = yearMov.filter((x) => movementKind(x) === "sale").reduce((s, x) => s + movementQuantity(x), 0);
  const deaths = yearMov.filter((x) => movementKind(x) === "death").reduce((s, x) => s + movementQuantity(x), 0);
  $("#controlFlow").innerHTML = [
    flowStep("Terneros trasladados a Ino", movedCalves, "Nacimiento → recría", drillCode("movement-custom", "calves-to-ino", farm)),
    flowStep("Vaquillonas pasadas a tambos", heifersToDairy, "Ino → vacas", drillCode("movement-custom", "heifers-to-dairy", farm)),
    flowStep("Ventas", sales, "Salidas registradas", drillCode("movement", "sale", farm)),
    flowStep("Muertes", deaths, "Salidas registradas", drillCode("movement", "death", farm)),
  ].join("");
  const staleFpp = buildCalvings(profiles, heifers, births).filter((x) => x.days < -45).length;
  const issues = [...(audit.issues || [])];
  if (staleFpp) issues.unshift({ id: "stale-fpp", severity: "warning", area: "Reproducción", title: `${staleFpp} FPP antiguas archivadas`, detail: "No generan partos atrasados; quedan visibles para corregir la fuente." });
  $("#controlAudit").innerHTML = issues.slice(0, 5).map(auditCard).join("");
}

async function renderAgenda() {
  let tasks = await mergedTasks();
  const q = normalize($("#taskSearch").value);
  const farm = $("#taskFarm").value;
  const type = $("#taskType").value;
  const status = $("#taskStatus").value;
  const horizon = $("#taskHorizon").value;
  tasks = tasks.filter((x) => {
    if (q && !normalize([x.title, x.detail, x.animal_id, x.farm].join(" ")).includes(q)) return false;
    if (farm && x.farm !== farm) return false;
    if (type && x.type !== type) return false;
    if (status === "open" && !["pending", "in_progress"].includes(x.status)) return false;
    if (["pending", "in_progress", "done", "dismissed"].includes(status) && x.status !== status) return false;
    const days = daysFromToday(x.due_date);
    if (horizon === "overdue" && !(days !== null && days < 0)) return false;
    if (!["all", "overdue"].includes(horizon) && !(days !== null && days <= Number(horizon))) return false;
    return true;
  }).sort((a, b) => (a.status === "done") - (b.status === "done") || (a.due_date || "9999").localeCompare(b.due_date || "9999"));
  const allTasks = await mergedTasks();
  const open = allTasks.filter((x) => ["pending", "in_progress"].includes(x.status));
  $("#taskKpis").innerHTML = [
    kpi("Pendientes", number(allTasks.filter((x) => x.status === "pending").length), "Sin iniciar", "", drillCode("task-status", "pending")),
    kpi("En curso", number(allTasks.filter((x) => x.status === "in_progress").length), "Trabajo iniciado", "good", drillCode("task-status", "in_progress")),
    kpi("Vencidas", number(open.filter((x) => daysFromToday(x.due_date) < 0).length), "Requieren decisión", open.some((x) => daysFromToday(x.due_date) < 0) ? "danger" : "good", drillCode("task-horizon", "overdue")),
    kpi("Próximos 7 días", number(open.filter((x) => { const d = daysFromToday(x.due_date); return d !== null && d >= 0 && d <= 7; }).length), "Agenda inmediata", "warn", drillCode("task-horizon", "7")),
    kpi("Realizadas", number(allTasks.filter((x) => x.status === "done").length), "Conservan historial", "good", drillCode("task-status", "done")),
  ].join("");
  const label = state.drill.task?.label || [farm, type ? taskTypeLabel(type) : "", status !== "all" ? taskStatusLabel(status === "open" ? "Pendientes + en curso" : status) : "", horizon !== "all" ? `${horizon === "overdue" ? "Vencidas" : `${horizon} días`}` : ""].filter(Boolean).join(" · ");
  $("#taskList").innerHTML = resultsBar(tasks.length, label, "task") + (tasks.length ? tasks.map(taskCard).join("") : `<div class="empty">No hay tareas para estos filtros.</div>`);
}

async function renderDairies() {
  const [profiles, births] = await Promise.all([all("profiles"), all("births")]);
  const farm = $("#dairyFarm").value;
  const category = $("#dairyCategory").value;
  const repro = $("#dairyRepro").value;
  const q = normalize($("#dairySearch").value);
  let active = activeDairyRows(profiles).filter((x) => !farm || canonicalFarm(x.establecimiento) === farm);
  const calvings = buildCalvings(active, [], births).filter((x) => x.days >= -45 && x.days <= 365);
  const pregnant = active.filter((x) => classifyRepro(x.resultado_tacto) === "p");
  const empty = active.filter((x) => classifyRepro(x.resultado_tacto) !== "p");
  const milking = active.filter((x) => normalize(x.categoria) === "ordene");
  const dry = active.filter((x) => normalize(x.categoria) === "seca");
  const toDry = active.filter((x) => matchesDairyDrill(x, { type: "to-dry" }, births));
  const rejects = active.filter((x) => matchesDairyDrill(x, { type: "reject" }, births));
  const services35 = active.filter((x) => matchesDairyDrill(x, { type: "service35" }, births));
  $("#dairyKpis").innerHTML = [
    kpi("Rodeo activo", number(active.length), farm || "Dos tambos", "good", drillCode("dairy", "active", "Rodeo activo")),
    kpi("En ordeñe", number(milking.length), percent(milking.length, active.length), "", drillCode("dairy", "milking", "Vacas en ordeñe")),
    kpi("Secas", number(dry.length), percent(dry.length, active.length), "", drillCode("dairy", "dry", "Vacas secas")),
    kpi("Preñadas", number(pregnant.length), percent(pregnant.length, active.length), "good", drillCode("dairy", "pregnant", "Vacas preñadas")),
    kpi("Vacías / sin preñez", number(empty.length), percent(empty.length, active.length), empty.length ? "warn" : "good", drillCode("dairy", "not-pregnant", "Vacías o sin preñez confirmada")),
    kpi("Partos 30 días", number(calvings.filter((x) => x.days >= 0 && x.days <= 30).length), "Fecha probable", "warn", drillCode("dairy", "calving-0-30", "Partos dentro de 30 días")),
    kpi("Secados a revisar", number(toDry.length), "Ventana ±30 días", "", drillCode("dairy", "to-dry", "Secados a revisar")),
    kpi("Rechazos / bajas", number(rejects.length), "Según Perfil de Rodeo", rejects.length ? "warn" : "good", drillCode("dairy", "reject", "Rechazos o bajas")),
  ].join("");
  const bands = [
    ["Vencidos activos", calvings.filter((x) => x.days < 0).length, "danger", "calving-overdue"],
    ["0–30 días", calvings.filter((x) => x.days >= 0 && x.days <= 30).length, "warn", "calving-0-30"],
    ["31–60 días", calvings.filter((x) => x.days > 30 && x.days <= 60).length, "info", "calving-31-60"],
    ["61–90 días", calvings.filter((x) => x.days > 60 && x.days <= 90).length, "neutral", "calving-61-90"],
    ["Más de 90 días", calvings.filter((x) => x.days > 90).length, "neutral", "calving-later"],
  ];
  $("#dairyCalvingBands").innerHTML = bands.map((x) => metricRow(x[0], badge(number(x[1]), x[2]), drillCode("dairy", x[3], `Partos ${x[0]}`))).join("");
  $("#dairyActions").innerHTML = [
    flowStep("Registrar o corregir partos vencidos", calvings.filter((x) => x.days < 0).length, "Se cruza contra nacimientos antes de alertar.", drillCode("dairy", "calving-overdue", "Partos vencidos")),
    flowStep("Preparar lote preparto", calvings.filter((x) => x.days >= 0 && x.days <= 30).length, "Partos esperados dentro de 30 días.", drillCode("dairy", "calving-0-30", "Lote preparto")),
    flowStep("Revisar secado", toDry.length, "Vacas en ordeñe próximas a la fecha de secado.", drillCode("dairy", "to-dry", "Secados a revisar")),
    flowStep("Revisar servicio / tacto", services35.length, "Más de 35 días desde el último servicio sin preñez confirmada.", drillCode("dairy", "service35", "Servicio o tacto pendiente")),
    flowStep("Resolver rechazo o baja", rejects.length, "Indicaciones activas del perfil.", drillCode("dairy", "reject", "Rechazo o baja")),
  ].join("");
  $("#dairyReproChart").innerHTML = progress("Preñadas", pregnant.length, active.length, "", drillCode("dairy", "pregnant", "Vacas preñadas")) + progress("Vacías / sin preñez", empty.length, active.length, "danger", drillCode("dairy", "not-pregnant", "Vacías o sin preñez")) + progress("En ordeñe", milking.length, active.length, "", drillCode("dairy", "milking", "Vacas en ordeñe")) + progress("Secas", dry.length, active.length, "warn", drillCode("dairy", "dry", "Vacas secas"));
  const lact = milking.map((x) => Number(x.dias_lactancia)).filter(Number.isFinite);
  const services = pregnant.map((x) => Number(x.numero_servicios)).filter(Number.isFinite);
  const partos = active.map((x) => Number(x.numero_partos)).filter(Number.isFinite);
  const ipc = active.map((x) => Number(x.ipc_total)).filter((x) => Number.isFinite(x) && x > 0);
  $("#dairyIndicators").innerHTML = [
    metricRow("Promedio días en lactancia", `<b>${average(lact)?.toFixed(0) || "—"}</b>`),
    metricRow("Servicios por preñez", `<b>${average(services)?.toFixed(2).replace(".", ",") || "—"}</b>`),
    metricRow("Promedio de partos", `<b>${average(partos)?.toFixed(2).replace(".", ",") || "—"}</b>`),
    metricRow("Intervalo parto–concepción", `<b>${average(ipc)?.toFixed(0) || "—"}</b>`),
    metricRow("Abortos registrados", `<b>${number(active.filter((x) => x.aborto_ultimo_anio || x.fecha_ultimo_aborto).length)}</b>`, drillCode("dairy", "aborts", "Vacas con aborto registrado")),
    metricRow("Ventas / indicación de venta", `<b>${number(active.filter((x) => x.venta_ultimo_anio || normalize(x.indicacion_baja).includes("venta")).length)}</b>`, drillCode("dairy", "sales", "Vacas con venta registrada")),
    metricRow("Muertes registradas", `<b>${number(active.filter((x) => x.muerte_ultimo_anio || normalize(x.indicacion_baja).includes("muerte")).length)}</b>`, drillCode("dairy", "deaths", "Vacas con muerte registrada")),
  ].join("");
  let filtered = active.filter((x) => {
    if (category && normalize(x.categoria) !== category) return false;
    if (repro === "p" && classifyRepro(x.resultado_tacto) !== "p") return false;
    if (repro === "v" && classifyRepro(x.resultado_tacto) === "p") return false;
    if (q && !normalize([x.caravana, x.categoria, x.observaciones, x.indicacion_baja].join(" ")).includes(q)) return false;
    if (!matchesDairyDrill(x, state.drill.dairy, births)) return false;
    return true;
  });
  filtered.sort((a, b) => {
    const da = daysFromToday(a.fecha_probable_parto); const dbb = daysFromToday(b.fecha_probable_parto);
    return (da ?? 9999) - (dbb ?? 9999) || String(a.caravana).localeCompare(String(b.caravana));
  });
  const p = paginate(filtered, "dairyPage");
  const rows = p.items.map((x) => {
    const days = daysFromToday(x.fecha_probable_parto);
    return `<tr><td><b>${traceButton(x.caravana, x.establecimiento)}</b></td><td>${esc(x.establecimiento)}</td><td>${esc(x.categoria || "—")}</td><td>${classifyRepro(x.resultado_tacto) === "p" ? badge("Preñada") : badge("Vacía / sin preñez", "danger")}</td><td>${fmtDate(x.fecha_ultimo_parto)}</td><td>${fmtDate(x.fecha_ultimo_servicio)}</td><td>${fmtDate(x.fecha_probable_parto)}</td><td class="${dayClass(days)}">${x.fecha_probable_parto ? dayText(days) : "—"}</td><td>${x.dias_lactancia ?? "—"}</td><td>${esc(x.indicacion_baja || "")}</td><td><div class="row-actions">${classifyRepro(x.resultado_tacto) === "p" ? `<button class="mini-button" data-new-birth-profile="${x.id}">Parto</button>` : ""}<button class="mini-button" data-edit-profile="${x.id}">Editar</button></div></td></tr>`;
  });
  const label = state.drill.dairy?.label || [farm, category, repro === "p" ? "Preñadas" : repro === "v" ? "Vacías / sin preñez" : "", q ? `Búsqueda: ${$("#dairySearch").value}` : ""].filter(Boolean).join(" · ");
  $("#dairyTable").innerHTML = resultsBar(p.total, label, "dairy") + table(["Caravana", "Campo", "Categoría", "Reproducción", "Último parto", "Último servicio", "FPP", "Situación", "DEL", "Baja", "Acciones"], rows) + pager(p);
}

async function renderIno() {
  const [heifers, movements, stock] = await Promise.all([all("heifers"), all("movements"), stockSummary()]);
  const active = activeHeiferRows(heifers);
  const preg = active.filter((x) => classifyRepro(x.resultado) === "p");
  const empty = active.filter((x) => classifyRepro(x.resultado) === "v");
  const pending = active.filter((x) => !classifyRepro(x.resultado));
  const due = pending.filter((x) => x.fecha_entore && daysFromToday(addDays(x.fecha_entore, 35)) <= 0);
  const ino = stock.establecimientos.find((x) => x.nombre === "Ino") || { total: 0, categorias: [] };
  const cat = Object.fromEntries(ino.categorias.map((x) => [x.categoria, x.cantidad]));
  const beefCategories = ["Terneritos", "Terneros medianos", "Novillos de engorde", "Novillos medianos", "Novillos grandes", "Vacas de engorde", "Toros"];
  const beefTotal = ino.categorias.filter((x) => beefCategories.includes(x.categoria)).reduce((sum, x) => sum + Number(x.cantidad || 0), 0);
  $("#inoStock").innerHTML = [
    kpi("Stock Ino", number(ino.total), "Recría + ganadería", "good", drillCode("animal-farm", "Ino")),
    kpi("Vaquillas con toro", number(cat["Vaquillas con toro"] || active.length), `${number(preg.length)} preñadas`, "", drillCode("heifer", "active", "Vaquillas con toro activas")),
    kpi("Para tactar ahora", number(due.length), `${number(pending.length)} sin resultado`, due.length ? "warn" : "good", drillCode("heifer", "due", "Vaquillonas para tactar ahora")),
    kpi("Ganadería y engorde", number(beefTotal), "Terneros, novillos y toros", "", drillCode("animal-beef", "Ino")),
  ].join("");
  const calvings = preg.filter((x) => x.fpp).map((x) => daysFromToday(x.fpp));
  $("#heiferSummary").innerHTML = progress("Preñadas", preg.length, active.length, "", drillCode("heifer", "pregnant", "Vaquillonas preñadas")) + progress("Vacías", empty.length, active.length, "danger", drillCode("heifer", "empty", "Vaquillonas vacías")) + progress("Pendientes de tacto", pending.length, active.length, "warn", drillCode("heifer", "pending", "Vaquillonas pendientes de tacto")) + [
    ["Para tactar ahora", due.length, "due"],
    ["Partos vencidos", calvings.filter((d) => d < 0).length, "calving-overdue"],
    ["Partos 0–30 días", calvings.filter((d) => d >= 0 && d <= 30).length, "calving-0-30"],
    ["Partos 31–60 días", calvings.filter((d) => d > 30 && d <= 60).length, "calving-31-60"],
    ["Partos 61–90 días", calvings.filter((d) => d > 60 && d <= 90).length, "calving-61-90"],
  ].map((x) => metricRow(x[0], `<b>${number(x[1])}</b>`, drillCode("heifer", x[2], x[0]))).join("");
  const year = today().slice(0, 4);
  const inoMov = movements.filter((x) => x.fecha?.startsWith(year) && (canonicalFarm(x.establecimiento_origen) === "Ino" || canonicalFarm(x.establecimiento_destino) === "Ino"));
  const soldBeef = inoMov.filter((x) => movementKind(x) === "sale" && !normalize(x.lote_origen).includes("vaq")).reduce((s, x) => s + movementQuantity(x), 0);
  const deadBeef = inoMov.filter((x) => movementKind(x) === "death" && !normalize(x.lote_origen).includes("vaq")).reduce((s, x) => s + movementQuantity(x), 0);
  $("#beefSummary").innerHTML = ino.categorias.map((x) => categoryRow(x.categoria, x.cantidad, drillCode("animal-category", "Ino", x.categoria))).join("") + `<div class="button-row"><button type="button" class="button ghost compact" data-drill="${esc(drillCode("movement", "sale", "Ino"))}">Ver ${number(soldBeef)} vendidos</button><button type="button" class="button ghost compact" data-drill="${esc(drillCode("movement", "death", "Ino"))}">Ver ${number(deadBeef)} muertes</button></div>`;
  let filtered = heifers;
  const status = $("#heiferStatus").value;
  const origin = $("#heiferOrigin").value;
  const q = normalize($("#heiferSearch").value);
  if (status === "active") filtered = active;
  if (status === "pregnant") filtered = active.filter((x) => classifyRepro(x.resultado) === "p");
  if (status === "empty") filtered = active.filter((x) => classifyRepro(x.resultado) === "v");
  if (status === "pending") filtered = active.filter((x) => !classifyRepro(x.resultado));
  if (status === "due") filtered = due;
  filtered = filtered.filter((x) => (!origin || canonicalFarm(x.origen) === origin) && (!q || normalize([x.numero, x.caravana, x.madre, x.padre, x.toro, x.origen, x.observacion].join(" ")).includes(q)) && matchesHeiferDrill(x, state.drill.heifer));
  filtered.sort((a, b) => (daysFromToday(a.fpp) ?? daysFromToday(addDays(a.fecha_entore, 35)) ?? 9999) - (daysFromToday(b.fpp) ?? daysFromToday(addDays(b.fecha_entore, 35)) ?? 9999));
  const p = paginate(filtered, "heiferPage");
  const rows = p.items.map((x) => {
    const tactoDue = !classifyRepro(x.resultado) && x.fecha_entore ? addDays(x.fecha_entore, 35) : "";
    const target = x.fpp || tactoDue;
    const days = daysFromToday(target);
    const result = classifyRepro(x.resultado);
    return `<tr><td><b>${traceButton(x.numero || x.caravana, "Ino")}</b></td><td>${esc(x.origen || "—")}</td><td>${fmtDate(x.fecha_nacimiento)}</td><td>${fmtDate(x.fecha_entore)}</td><td>${esc(x.toro || "—")}</td><td>${fmtDate(x.fecha_tacto)}</td><td>${result === "p" ? badge("Preñada") : result === "v" ? badge("Vacía", "danger") : badge("Pendiente", "warn")}</td><td>${fmtDate(x.fpp)}</td><td class="${dayClass(days)}">${target ? dayText(days) : "—"}</td><td>${esc(x.destino || "Sin definir")}</td><td><div class="row-actions"><button class="mini-button" data-edit-heifer="${x.id}">${result ? "Editar" : "Cargar tacto"}</button>${result === "p" ? `<button class="mini-button" data-new-birth-heifer="${x.id}">Parto</button>` : ""}</div></td></tr>`;
  });
  const label = state.drill.heifer?.label || [status, origin, q ? `Búsqueda: ${$("#heiferSearch").value}` : ""].filter(Boolean).join(" · ");
  $("#heiferTable").innerHTML = resultsBar(p.total, label, "heifer") + table(["Número", "Origen", "Nacimiento", "Entore", "Toro", "Tacto", "Resultado", "FPP", "Situación", "Destino", "Acciones"], rows) + pager(p);
  const recent = movements.filter((x) => canonicalFarm(x.establecimiento_origen) === "Ino" || canonicalFarm(x.establecimiento_destino) === "Ino").sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")).slice(0, 30);
  $("#inoMovements").innerHTML = `<div class="results-bar"><div><b>${number(recent.length)} movimientos recientes</b><small>Para filtrar por fecha, tipo o destino abrí el módulo completo.</small></div><button type="button" class="mini-button" data-drill="${esc(drillCode("movement", "all", "Ino"))}">Abrir movimientos</button></div>` + table(["Fecha", "Origen", "Categoría", "Destino", "Nueva categoría", "Cantidad", "Motivo"], recent.map((x) => `<tr><td>${fmtDate(x.fecha)}</td><td>${esc(x.establecimiento_origen)}</td><td>${esc(x.lote_origen)}</td><td>${esc(x.establecimiento_destino || "—")}</td><td>${esc(x.lote_destino || "—")}</td><td><b>${number(movementQuantity(x))}</b></td><td>${esc(x.observacion || "")}</td></tr>`));
}

async function renderHacienda() {
  const [animals, stock] = await Promise.all([all("animals"), stockSummary()]);
  const farm = $("#animalFarm").value;
  const category = $("#animalCategory").value;
  const stateFilter = $("#animalState").value;
  const q = normalize($("#animalSearch").value);
  const categories = [...new Set(animals.map((x) => x.categoria).filter(Boolean))].sort();
  const categorySelect = $("#animalCategory");
  if (!categorySelect.dataset.ready) {
    categorySelect.innerHTML = `<option value="">Todas las categorías</option>${categories.map((x) => `<option>${esc(x)}</option>`).join("")}`;
    categorySelect.dataset.ready = "1";
  }
  let declared = stock.establecimientos;
  if (farm) declared = declared.filter((x) => x.nombre === farm);
  $("#stockSummary").innerHTML = declared.map((f) => `<div class="farm-card"><h3>${esc(f.nombre)}</h3><button type="button" class="farm-total-link" data-drill="${esc(drillCode("animal-farm", f.nombre))}"><span class="farm-total">${number(f.total)}</span><small>stock declarado al ${fmtDate(stock.fecha)} · ver detalle</small></button>${f.categorias.map((c) => categoryRow(c.categoria, c.cantidad, drillCode("animal-category", f.nombre, c.categoria))).join("")}</div>`).join("");
  let filtered = animals.filter((x) => (!farm || canonicalFarm(x.establecimiento) === farm) && (!category || x.categoria === category) && (!stateFilter || (x.estado || "Activo") === stateFilter) && (!q || normalize([x.caravana, x.categoria, x.observacion, x.establecimiento].join(" ")).includes(q)) && matchesAnimalDrill(x, state.drill.animal));
  filtered.sort((a, b) => canonicalFarm(a.establecimiento).localeCompare(canonicalFarm(b.establecimiento)) || String(a.categoria).localeCompare(String(b.categoria)) || String(a.caravana).localeCompare(String(b.caravana)));
  const p = paginate(filtered, "animalPage");
  const declaredCategory = farm && (category || state.drill.animal?.categories?.length === 1) ? stock.establecimientos.find((x) => x.nombre === farm)?.categorias.find((x) => x.categoria === (category || state.drill.animal.categories[0]))?.cantidad : null;
  const note = declaredCategory !== null && declaredCategory !== undefined && declaredCategory !== p.total ? `Stock declarado: ${number(declaredCategory)}. Detalle individual encontrado: ${number(p.total)}; la planilla individual puede ser parcial.` : "El detalle individual puede no coincidir con el stock agregado de Hacienda Total.";
  const label = state.drill.animal?.label || [farm, category, stateFilter, q ? `Búsqueda: ${$("#animalSearch").value}` : ""].filter(Boolean).join(" · ");
  $("#animalTable").innerHTML = resultsBar(p.total, label, "animal", note) + table(["Caravana", "Establecimiento", "Categoría", "Sexo", "Identificación", "Estado", "Observación", "Acciones"], p.items.map((x) => `<tr><td><b>${traceButton(x.caravana, x.establecimiento)}</b></td><td>${esc(x.establecimiento)}</td><td>${esc(x.categoria)}</td><td>${esc(x.sexo || "—")}</td><td>${esc(x.tipo_identificacion || "—")}</td><td>${badge(x.estado || "Activo", (x.estado || "Activo") === "Activo" ? "" : "neutral")}</td><td>${esc(x.observacion || "")}</td><td><button class="mini-button" data-edit-animal="${x.id}">Editar</button></td></tr>`)) + pager(p);
}

async function renderBirths() {
  const births = await all("births");
  const years = [...new Set(births.map((x) => x.fecha?.slice(0, 4)).filter(Boolean))].sort().reverse();
  const yearSelect = $("#birthYear");
  if (!yearSelect.dataset.ready) {
    yearSelect.innerHTML = `<option value="">Todos los años</option>${years.map((y) => `<option>${y}</option>`).join("")}`;
    yearSelect.value = years.includes(today().slice(0, 4)) ? today().slice(0, 4) : years[0] || "";
    yearSelect.dataset.ready = "1";
  }
  const year = yearSelect.value;
  const farm = $("#birthFarm").value;
  const result = $("#birthResult").value;
  const q = normalize($("#birthSearch").value);
  let filtered = births.filter((x) => {
    if (year && !x.fecha?.startsWith(year)) return false;
    if (farm && canonicalFarm(x.establecimiento) !== farm) return false;
    if (result === "live" && !x.parto_vivo) return false;
    if (result === "dead" && !x.parto_muerto) return false;
    if (result === "rearing" && !x.muerte_recria) return false;
    if (q && !normalize([x.madre, x.padre, x.sexo, x.establecimiento].join(" ")).includes(q)) return false;
    return true;
  });
  const live = filtered.filter((x) => x.parto_vivo).length;
  const dead = filtered.filter((x) => x.parto_muerto).length;
  const rearing = filtered.filter((x) => x.muerte_recria).length;
  $("#birthKpis").innerHTML = [
    kpi("Partos registrados", number(filtered.length), year || "Histórico", "", drillCode("birth", "all", farm)),
    kpi("Nacidos vivos", number(live), percent(live, filtered.length), "good", drillCode("birth", "live", farm)),
    kpi("Muertos al parto", number(dead), percent(dead, filtered.length), dead ? "danger" : "good", drillCode("birth", "dead", farm)),
    kpi("Muertes en recría", number(rearing), percent(rearing, Math.max(live, 1)), rearing ? "warn" : "good", drillCode("birth", "rearing", farm)),
  ].join("");
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const monthly = months.map((m) => ({ live: filtered.filter((x) => x.fecha?.slice(5, 7) === m && x.parto_vivo).length, dead: filtered.filter((x) => x.fecha?.slice(5, 7) === m && x.parto_muerto).length, rearing: filtered.filter((x) => x.fecha_muerte_recria?.slice(5, 7) === m && x.muerte_recria).length }));
  $("#birthMonthly").innerHTML = simpleBars([{ name: "Vivos", values: monthly.map((x) => x.live) }, { name: "Muertos al parto", values: monthly.map((x) => x.dead), className: "dead" }, { name: "Muertes recría", values: monthly.map((x) => x.rearing), className: "alt" }], months.map((m) => fmtMonth(`${year || today().slice(0, 4)}-${m}`)));
  $("#birthCompare").innerHTML = ["Ino 2", "Los 3 Hnos."].map((f) => {
    const rows = filtered.filter((x) => canonicalFarm(x.establecimiento) === f);
    const l = rows.filter((x) => x.parto_vivo).length;
    const d = rows.filter((x) => x.parto_muerto).length;
    const r = rows.filter((x) => x.muerte_recria).length;
    return `<h3 style="font-size:13px;margin:12px 0 4px">${esc(f)}</h3>${progress("Todos", rows.length, rows.length || 1, "", drillCode("birth-farm", f))}${progress("Vivos", l, rows.length, "", drillCode("birth-farm-result", f, "live"))}${progress("Muertos al parto", d, rows.length, "danger", drillCode("birth-farm-result", f, "dead"))}${progress("Muertes en recría", r, Math.max(l, 1), "warn", drillCode("birth-farm-result", f, "rearing"))}`;
  }).join("");
  filtered.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const p = paginate(filtered, "birthPage");
  const label = state.drill.birth?.label || [year, farm, result, q ? `Búsqueda: ${$("#birthSearch").value}` : ""].filter(Boolean).join(" · ");
  $("#birthTable").innerHTML = resultsBar(p.total, label, "birth") + table(["Fecha", "Tambo", "Madre", "Padre", "Sexo", "Parto", "Recría", "Acciones"], p.items.map((x) => `<tr><td>${fmtDate(x.fecha)}</td><td>${esc(x.establecimiento)}</td><td><b>${traceButton(x.madre, x.establecimiento)}</b></td><td>${esc(x.padre || "—")}</td><td>${esc(x.sexo || "—")}</td><td>${x.parto_vivo ? badge("Vivo") : x.parto_muerto ? badge("Muerto", "danger") : "—"}</td><td>${x.muerte_recria ? `${badge("Muerte", "warn")} ${fmtDate(x.fecha_muerte_recria)}` : "—"}</td><td><button class="mini-button" data-edit-birth="${x.id}">Editar</button></td></tr>`)) + pager(p);
}

async function renderMovements() {
  const movements = await all("movements");
  const years = [...new Set(movements.map((x) => x.fecha?.slice(0, 4)).filter(Boolean))].sort().reverse();
  const yearSelect = $("#movementYear");
  if (!yearSelect.dataset.ready) {
    yearSelect.innerHTML = `<option value="">Todos los años</option>${years.map((y) => `<option>${y}</option>`).join("")}`;
    yearSelect.value = years.includes(today().slice(0, 4)) ? today().slice(0, 4) : years[0] || "";
    yearSelect.dataset.ready = "1";
  }
  const year = yearSelect.value;
  const farm = $("#movementFarm").value;
  const kind = $("#movementType").value;
  const q = normalize($("#movementSearch").value);
  let filtered = movements.filter((x) => (!year || x.fecha?.startsWith(year)) && (!farm || canonicalFarm(x.establecimiento_origen) === farm || canonicalFarm(x.establecimiento_destino) === farm) && (!kind || movementKind(x) === kind) && (!q || normalize([x.lote_origen, x.lote_destino, x.observacion, x.establecimiento_origen, x.establecimiento_destino].join(" ")).includes(q)) && matchesMovementDrill(x, state.drill.movement));
  const totalQty = filtered.reduce((s, x) => s + movementQuantity(x), 0);
  const internal = filtered.filter((x) => movementKind(x) === "internal").reduce((s, x) => s + movementQuantity(x), 0);
  const sales = filtered.filter((x) => movementKind(x) === "sale").reduce((s, x) => s + movementQuantity(x), 0);
  const deaths = filtered.filter((x) => movementKind(x) === "death").reduce((s, x) => s + movementQuantity(x), 0);
  $("#movementKpis").innerHTML = [
    kpi("Registros", number(filtered.length), `${number(totalQty)} animales/lotes`, "", drillCode("movement", "all", farm)),
    kpi("Traslados y cambios", number(internal), "Flujo interno", "good", drillCode("movement", "internal", farm)),
    kpi("Ventas", number(sales), "Salidas comerciales", "", drillCode("movement", "sale", farm)),
    kpi("Muertes", number(deaths), "Salidas por mortandad", deaths ? "danger" : "good", drillCode("movement", "death", farm)),
  ].join("");
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const monthValues = months.map((m) => ({ internal: filtered.filter((x) => x.fecha?.slice(5, 7) === m && movementKind(x) === "internal").reduce((s, x) => s + movementQuantity(x), 0), sales: filtered.filter((x) => x.fecha?.slice(5, 7) === m && movementKind(x) === "sale").reduce((s, x) => s + movementQuantity(x), 0), deaths: filtered.filter((x) => x.fecha?.slice(5, 7) === m && movementKind(x) === "death").reduce((s, x) => s + movementQuantity(x), 0) }));
  $("#movementMonthly").innerHTML = simpleBars([{ name: "Movimientos", values: monthValues.map((x) => x.internal) }, { name: "Ventas", values: monthValues.map((x) => x.sales), className: "alt" }, { name: "Muertes", values: monthValues.map((x) => x.deaths), className: "dead" }], months.map((m) => fmtMonth(`${year || today().slice(0, 4)}-${m}`)));
  const routes = new Map();
  for (const row of filtered) {
    const origin = row.establecimiento_origen || "—";
    const destination = row.establecimiento_destino || row.lote_destino || "Stock";
    const route = `${origin} → ${destination}`;
    const current = routes.get(route) || { qty: 0, origin, destination };
    current.qty += movementQuantity(row);
    routes.set(route, current);
  }
  $("#movementFlow").innerHTML = [...routes.values()].sort((a, b) => b.qty - a.qty).slice(0, 12).map((x) => flowStep(`${x.origin} → ${x.destination}`, x.qty, "Ruta acumulada del filtro", drillCode("movement-route", x.origin, x.destination))).join("") || `<div class="empty">Sin movimientos</div>`;
  filtered.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const p = paginate(filtered, "movementPage");
  const label = state.drill.movement?.label || [year, farm, kind, q ? `Búsqueda: ${$("#movementSearch").value}` : ""].filter(Boolean).join(" · ");
  $("#movementTable").innerHTML = resultsBar(p.total, label, "movement") + table(["Fecha", "Origen", "Lote origen", "Destino", "Lote destino", "Machos", "Hembras", "Tipo", "Detalle", "Acciones"], p.items.map((x) => `<tr><td>${fmtDate(x.fecha)}</td><td>${esc(x.establecimiento_origen || "—")}</td><td>${esc(x.lote_origen || "—")}</td><td>${esc(x.establecimiento_destino || "—")}</td><td>${esc(x.lote_destino || "—")}</td><td>${number(Math.max(Number(x.egreso_machos || 0), Number(x.ingreso_machos || 0)))}</td><td>${number(Math.max(Number(x.egreso_hembras || 0), Number(x.ingreso_hembras || 0)))}</td><td>${badge(({ internal: "Movimiento", sale: "Venta", death: "Muerte", birth: "Nacimiento" })[movementKind(x)], movementKind(x) === "death" ? "danger" : movementKind(x) === "sale" ? "warn" : "info")}</td><td>${esc(x.observacion || "")}</td><td><button class="mini-button" data-edit-movement="${x.id}">Editar</button></td></tr>`)) + pager(p);
}

async function renderHealth() {
  const rows = await all("health");
  const latest = new Map();
  for (const row of rows) {
    const key = `${canonicalFarm(row.establecimiento)}|${normalize(row.tratamiento)}`;
    const prev = latest.get(key);
    if (!prev || String(row.fecha || "") > String(prev.fecha || "")) latest.set(key, row);
  }
  let filtered = [...latest.values()];
  const farm = $("#healthFarm").value;
  const q = normalize($("#healthSearch").value);
  const status = $("#healthStatus").value;
  filtered = filtered.filter((x) => {
    if (farm && canonicalFarm(x.establecimiento) !== farm) return false;
    if (q && !normalize([x.tratamiento, x.categoria, x.observacion].join(" ")).includes(q)) return false;
    const d = daysFromToday(x.vencimiento);
    if (status === "due" && !(d !== null && d >= 0 && d <= 90)) return false;
    if (status === "overdue" && !(d !== null && d < 0)) return false;
    if (!matchesHealthDrill(x, state.drill.health)) return false;
    return true;
  });
  const due30 = filtered.filter((x) => { const d = daysFromToday(x.vencimiento); return d !== null && d >= 0 && d <= 30; }).length;
  const due90 = filtered.filter((x) => { const d = daysFromToday(x.vencimiento); return d !== null && d >= 0 && d <= 90; }).length;
  const overdue = filtered.filter((x) => daysFromToday(x.vencimiento) < 0).length;
  $("#healthKpis").innerHTML = [
    kpi("Planes vigentes", number(filtered.length), "Último registro por tratamiento", "", drillCode("health", "all", farm)),
    kpi("Próximos 30 días", number(due30), "Programar trabajo", due30 ? "warn" : "good", drillCode("health", "due30", farm)),
    kpi("Próximos 90 días", number(due90), "Horizonte sanitario", "", drillCode("health", "due90", farm)),
    kpi("Vencidos", number(overdue), "Revisar si se realizó", overdue ? "danger" : "good", drillCode("health", "overdue", farm)),
  ].join("");
  filtered.sort((a, b) => (a.vencimiento || "9999").localeCompare(b.vencimiento || "9999"));
  const p = paginate(filtered, "healthPage");
  const label = state.drill.health?.label || [farm, status, q ? `Búsqueda: ${$("#healthSearch").value}` : ""].filter(Boolean).join(" · ");
  $("#healthTable").innerHTML = resultsBar(p.total, label, "health") + table(["Establecimiento", "Tratamiento", "Categoría", "Última aplicación", "Próximo vencimiento", "Situación", "Observación", "Acciones"], p.items.map((x) => { const d = daysFromToday(x.vencimiento); return `<tr><td>${esc(x.establecimiento)}</td><td><b>${esc(x.tratamiento)}</b></td><td>${esc(x.categoria || "Todo el rodeo")}</td><td>${fmtDate(x.fecha)}</td><td>${fmtDate(x.vencimiento)}</td><td class="${dayClass(d)}">${x.vencimiento ? dayText(d) : "Sin vencimiento"}</td><td>${esc(x.observacion || "")}</td><td><button class="mini-button" data-edit-health="${x.id}">Editar</button></td></tr>`; })) + pager(p);
}

async function renderData() {
  const [sources, audit, profiles, heifers, animals, births, movements, health, tasks] = await Promise.all([sourceMeta(), auditMeta(), all("profiles"), all("heifers"), all("animals"), all("births"), all("movements"), all("health"), all("tasks")]);
  const profileCount = activeDairyRows(profiles).reduce((map, x) => map.set(canonicalFarm(x.establecimiento), (map.get(canonicalFarm(x.establecimiento)) || 0) + 1), new Map());
  $("#sourceCards").innerHTML = [
    sourceCard("Perfil de Rodeo · Ino 2", `${number(profileCount.get("Ino 2") || 0)} animales activos`, sources.profiles?.sources?.["Ino 2"] || "Planilla cargada", drillCode("source", "dairy", "Ino 2")),
    sourceCard("Perfil de Rodeo · Los 3 Hnos.", `${number(profileCount.get("Los 3 Hnos.") || 0)} animales activos`, sources.profiles?.sources?.["Los 3 Hnos."] || "Planilla cargada", drillCode("source", "dairy", "Los 3 Hnos.")),
    sourceCard("Vaquillas con toro · Ino", `${number(activeHeiferRows(heifers).length)} entoradas activas`, sources.heifers?.source_file || "Vaquillas con toro", drillCode("source", "heifer", "Ino")),
    sourceCard("Hacienda Total", `${number(animals.length)} animales individualizados`, sources.hacienda?.source_file ? `${sources.hacienda.source_file} · stock ${number(sources.hacienda.stock_total || 0)} al ${fmtDate(sources.hacienda.latest_date)}` : "Stock declarado y movimientos", drillCode("source", "animal", "")),
    sourceCard("Nacimientos", `${number(births.length)} registros`, sources.births?.sources ? `${sources.births.sources["Ino 2"] || "Ino 2"} + ${sources.births.sources["Los 3 Hnos."] || "Los 3 Hnos."}` : "Ino 2 + Los 3 Hnos.", drillCode("source", "birth", "")),
    sourceCard("Sanidad", `${number(health.length)} registros`, sources.health?.source_file || "Tratamientos y vencimientos", drillCode("source", "health", "")),
  ].join("");
  $("#auditList").innerHTML = (audit.issues || []).map(auditCard).join("");
  $("#cloudState").innerHTML = supabase ? (session ? `${badge("Conectado")}<p>${esc(session.user.email)}</p><p class="note">Locales: ${number(animals.length + births.length + movements.length + health.length + profiles.length + heifers.length + tasks.length)} registros.</p>` : `${badge("Sin iniciar sesión", "warn")}<p>Los datos siguen guardándose en este dispositivo.</p>`) : `${badge("Conexión no disponible", "warn")}`;
}

const VIEW_RENDERERS = {
  control: renderControl,
  agenda: renderAgenda,
  tambos: renderDairies,
  ino: renderIno,
  hacienda: renderHacienda,
  nacimientos: renderBirths,
  movimientos: renderMovements,
  sanidad: renderHealth,
  datos: renderData,
};

function traceIdentity(row) {
  return canonicalCaravana(row?.caravana || row?.numero || row?.madre || row?.animal_id || "");
}
function traceDateLabel(value) {
  return value ? fmtDate(value) : "Sin fecha";
}
function traceEvent(date, title, detail, tone = "info", source = "") {
  return { date: date || "", title, detail, tone, source };
}
function traceEventHtml(event) {
  return `<div class="timeline-item ${event.tone}">
    <div class="timeline-marker"></div>
    <div class="timeline-content">
      <div class="timeline-date">${esc(traceDateLabel(event.date))}</div>
      <strong>${esc(event.title)}</strong>
      <p>${esc(event.detail || "")}</p>
      ${event.source ? `<span class="source-chip">${esc(event.source)}</span>` : ""}
    </div>
  </div>`;
}
function uniqueTraceRows(rows, keyFn) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = keyFn(row);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
async function traceCandidates(query = "", farm = "") {
  const [animals, profiles, heifers, births] = await Promise.all([
    all("animals"), all("profiles"), all("heifers"), all("births")
  ]);
  const q = canonicalCaravana(query);
  const candidates = [];

  // Prioridad: el Perfil de Rodeo describe la ubicación y categoría actuales.
  for (const row of profiles) candidates.push({
    id: traceIdentity(row), farm: canonicalFarm(row.establecimiento), category: row.categoria || "Vaca",
    label: row.caravana, source: "Perfil de Rodeo", priority: 40
  });
  // Las demás fuentes forman parte de la historia del mismo animal.
  for (const row of heifers) candidates.push({
    id: traceIdentity(row), farm: "Ino", category: "Vaquillona",
    label: row.numero, source: "Vaquillas con toro", priority: 30
  });
  for (const row of animals) {
    const id = traceIdentity(row);
    if (id && /^\d+$/.test(id)) candidates.push({
      id, farm: canonicalFarm(row.establecimiento), category: row.categoria || "Hacienda",
      label: row.caravana, source: "Hacienda", priority: 20
    });
  }
  for (const row of births) {
    const id = traceIdentity({ caravana: row.caravana || row.numero || "" });
    if (id) candidates.push({
      id, farm: canonicalFarm(row.establecimiento), category: "Nacimiento",
      label: row.caravana || row.numero, source: "Nacimientos", priority: 10
    });
  }

  // Una caravana representa un único animal aunque haya pasado por distintos establecimientos.
  const grouped = new Map();
  for (const item of candidates) {
    if (!item.id) continue;
    let group = grouped.get(item.id);
    if (!group) {
      group = { ...item, farms: new Set(), sources: new Set(), categories: new Set() };
      grouped.set(item.id, group);
    }
    if (item.farm) group.farms.add(item.farm);
    if (item.source) group.sources.add(item.source);
    if (item.category) group.categories.add(item.category);
    if ((item.priority || 0) > (group.priority || 0)) {
      group.farm = item.farm;
      group.category = item.category;
      group.label = item.label;
      group.source = item.source;
      group.priority = item.priority;
    }
  }

  return [...grouped.values()]
    .filter((x) => (!q || x.id.includes(q)) && (!farm || x.farms.has(farm)))
    .map((x) => ({
      ...x,
      history: [...x.farms].filter(Boolean),
      sourceSummary: [...x.sources].filter(Boolean).join(" · ")
    }))
    .sort((a, b) => a.id.localeCompare(b.id, "es", { numeric: true }))
    .slice(0, 30);
}
async function renderTraceSuggestions() {
  const q = $("#traceSearch")?.value || "";
  const farm = $("#traceFarm")?.value || "";
  const box = $("#traceSuggestions");
  if (!box) return;
  if (!q.trim()) { box.innerHTML = ""; return; }
  const rows = await traceCandidates(q, farm);
  box.innerHTML = rows.length
    ? `<div class="trace-suggestions">${rows.map((x) => `<button class="trace-suggestion" data-trace-animal="${esc(x.id)}">
        <b>${esc(x.label || x.id)}</b><span>${esc(x.farm || "Sin ubicación actual")} · ${esc(x.category)}</span><small>${x.history?.length > 1 ? `Historial: ${esc(x.history.join(" → "))} · ` : ""}${esc(x.sourceSummary || x.source)}</small>
      </button>`).join("")}</div>`
    : `<div class="empty compact-empty">No encontré coincidencias con esa caravana.</div>`;
}
async function renderTrace(animalId = state.traceAnimal) {
  const result = $("#traceResult");
  if (!result) return;
  const key = canonicalCaravana(animalId || $("#traceSearch")?.value || "");
  state.traceAnimal = key;
  if (!key) {
    result.innerHTML = '<div class="empty">Ingresá una caravana para reconstruir su historia.</div>';
    return;
  }
  const [animals, profiles, heifers, births, movements, health, tasks] = await Promise.all([
    all("animals"), all("profiles"), all("heifers"), all("births"), all("movements"), all("health"), all("tasks")
  ]);
  const animalRows = animals.filter((x) => traceIdentity(x) === key);
  const profileRows = profiles.filter((x) => traceIdentity(x) === key);
  const heiferRows = heifers.filter((x) => traceIdentity(x) === key);
  const birthsAsMother = births.filter((x) => canonicalCaravana(x.madre) === key);
  const birthsAsAnimal = births.filter((x) => traceIdentity({ caravana: x.caravana || x.numero || "" }) === key);
  const taskRows = tasks.filter((x) => canonicalCaravana(x.animal_id) === key);
  const movementRows = movements.filter((x) => {
    const text = normalize([x.caravana, x.numero, x.animal_id, x.observacion].join(" "));
    return text && text.split(/\D+/).includes(key);
  });
  const healthRows = health.filter((x) => {
    const text = normalize([x.caravana, x.numero, x.animal_id, x.observacion].join(" "));
    return text && text.split(/\D+/).includes(key);
  });

  const base = profileRows.at(-1) || heiferRows.at(-1) || animalRows.at(-1) || birthsAsAnimal.at(-1) || null;
  if (!base && !birthsAsMother.length && !taskRows.length) {
    result.innerHTML = `<div class="empty"><b>No se encontró una ficha individual para ${esc(key)}.</b><br>Puede existir sólo dentro de movimientos por cantidad, que no permiten identificar un animal específico.</div>`;
    return;
  }

  const farm = canonicalFarm(base?.establecimiento || base?.destino || base?.origen || animalRows.at(-1)?.establecimiento || "");
  const category = base?.categoria || (heiferRows.length ? "Vaquillona" : animalRows.at(-1)?.categoria || "Sin categoría");
  const repro = classifyRepro(base?.resultado_tacto || base?.resultado);
  const status = base?.estado || (base?.activo === false ? "Inactivo" : "Activo");
  const events = [];

  for (const x of birthsAsAnimal) events.push(traceEvent(x.fecha, "Nacimiento", `${x.establecimiento || ""} · ${x.sexo || "sexo sin dato"} · ${x.parto_vivo ? "vivo" : x.parto_muerto ? "muerto al parto" : "resultado sin dato"}`, x.parto_muerto ? "danger" : "good", "Nacimientos"));
  for (const x of heiferRows) {
    if (x.fecha_nacimiento) events.push(traceEvent(x.fecha_nacimiento, "Fecha de nacimiento", `Origen: ${x.origen || "sin dato"}`, "good", "Vaquillas con toro"));
    if (x.fecha_ingreso) events.push(traceEvent(x.fecha_ingreso, "Ingreso a recría", "Ingreso registrado en Ino.", "info", "Vaquillas con toro"));
    if (x.fecha_entore) events.push(traceEvent(x.fecha_entore, "Entore", `Toro: ${x.toro || "sin dato"}`, "info", "Vaquillas con toro"));
    if (x.fecha_tacto) events.push(traceEvent(x.fecha_tacto, "Tacto", `Resultado: ${x.resultado || "sin dato"}`, classifyRepro(x.resultado) === "p" ? "good" : "warn", "Vaquillas con toro"));
    if (x.fpp) events.push(traceEvent(x.fpp, "Fecha probable de parto", `Destino previsto: ${x.destino || "sin definir"}`, "warn", "Vaquillas con toro"));
    if (x.fecha_egreso) events.push(traceEvent(x.fecha_egreso, "Egreso de recría", `Destino: ${x.destino || "sin dato"}`, "info", "Vaquillas con toro"));
    if (x.fecha_muerte) events.push(traceEvent(x.fecha_muerte, "Muerte", x.observacion || "", "danger", "Vaquillas con toro"));
    if (x.fecha_venta) events.push(traceEvent(x.fecha_venta, "Venta", x.observacion || "", "danger", "Vaquillas con toro"));
  }
  for (const x of profileRows) {
    if (x.fecha_nacimiento) events.push(traceEvent(x.fecha_nacimiento, "Nacimiento registrado", `Establecimiento: ${x.establecimiento}`, "good", "Perfil de Rodeo"));
    if (x.fecha_primer_parto) events.push(traceEvent(x.fecha_primer_parto, "Primer parto", `${x.edad_primer_parto_meses || "—"} meses al primer parto`, "good", "Perfil de Rodeo"));
    if (x.fecha_ultimo_parto) events.push(traceEvent(x.fecha_ultimo_parto, "Último parto", `${x.numero_partos || "—"} partos acumulados`, "good", "Perfil de Rodeo"));
    if (x.fecha_ultimo_servicio) events.push(traceEvent(x.fecha_ultimo_servicio, "Último servicio", `${x.numero_servicios || "—"} servicios`, "info", "Perfil de Rodeo"));
    if (x.fecha_probable_parto) events.push(traceEvent(x.fecha_probable_parto, "Fecha probable de parto", `Resultado reproductivo: ${x.resultado_tacto || "sin dato"}`, "warn", "Perfil de Rodeo"));
    if (x.fecha_ultimo_aborto) events.push(traceEvent(x.fecha_ultimo_aborto, "Aborto", `${x.numero_abortos || 1} aborto(s) registrados`, "danger", "Perfil de Rodeo"));
    if (x.fecha_baja) events.push(traceEvent(x.fecha_baja, "Baja", x.indicacion_baja || x.observaciones || "", "danger", "Perfil de Rodeo"));
  }
  for (const x of birthsAsMother) events.push(traceEvent(x.fecha, "Parto", `${x.parto_vivo ? "Cría viva" : x.parto_muerto ? "Cría muerta al parto" : "resultado sin dato"} · Padre: ${x.padre || "sin dato"} · Sexo: ${x.sexo || "sin dato"}`, x.parto_muerto ? "danger" : "good", "Nacimientos"));
  for (const x of movementRows) events.push(traceEvent(x.fecha, "Movimiento individual relacionado", `${x.establecimiento_origen || "—"} → ${x.establecimiento_destino || "—"} · ${x.lote_origen || ""} ${x.lote_destino ? "→ " + x.lote_destino : ""}`, movementKind(x) === "death" ? "danger" : "info", "Movimientos"));
  for (const x of healthRows) events.push(traceEvent(x.fecha, "Sanidad individual", `${x.tratamiento || ""}${x.vencimiento ? " · vence " + fmtDate(x.vencimiento) : ""}`, "info", "Sanidad"));
  for (const x of taskRows) events.push(traceEvent(x.due_date || x.fecha, `Tarea: ${x.title || x.titulo || x.type || "Seguimiento"}`, `${x.status || "pending"} · ${x.detail || x.detalle || ""}`, x.status === "done" ? "good" : "warn", "Agenda"));

  const dedup = uniqueTraceRows(events, (x) => `${x.date}|${x.title}|${x.detail}`);
  dedup.sort((a, b) => (b.date || "9999").localeCompare(a.date || "9999"));

  const knownFields = [
    ["Establecimiento", farm || "—"],
    ["Categoría actual", category || "—"],
    ["Estado", status || "—"],
    ["Estado reproductivo", repro === "p" ? "Preñada" : repro === "v" ? "Vacía" : repro === "d" ? "Dudosa" : "Sin resultado"],
    ["Última FPP", base?.fecha_probable_parto || base?.fpp ? fmtDate(base.fecha_probable_parto || base.fpp) : "—"],
    ["Origen", base?.origen || "—"],
    ["Destino", base?.destino || "—"],
    ["Registros vinculados", number(dedup.length)]
  ];

  const limitations = [];
  if (!birthsAsAnimal.length) limitations.push("No hay nacimiento individual identificado con esta caravana.");
  if (!movementRows.length) limitations.push("Los movimientos generales por cantidad no pueden asignarse automáticamente a esta caravana.");
  if (!healthRows.length) limitations.push("El plan sanitario disponible es mayormente por lote o establecimiento.");
  if (!profileRows.length && !heiferRows.length) limitations.push("No hay registro reproductivo individual para esta caravana.");

  result.innerHTML = `
    <div class="trace-head panel">
      <div><div class="eyebrow">ANIMAL</div><h2>Caravana ${esc(key)}</h2><p>${esc(farm || "Establecimiento sin definir")} · ${esc(category || "Sin categoría")}</p></div>
      <div class="button-row">
        ${profileRows.length ? `<button class="button secondary compact" data-edit-profile="${profileRows.at(-1).id}">Editar rodeo</button>` : ""}
        ${heiferRows.length ? `<button class="button secondary compact" data-edit-heifer="${heiferRows.at(-1).id}">Editar vaquillona</button>` : ""}
        ${animalRows.length ? `<button class="button secondary compact" data-edit-animal="${animalRows.at(-1).id}">Editar hacienda</button>` : ""}
        <button class="button primary compact" data-action="new-task" data-default-animal="${esc(key)}" data-default-farm="${esc(farm)}">+ Tarea</button>
      </div>
    </div>
    <div class="trace-grid">
      ${knownFields.map((x) => `<div class="trace-field"><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join("")}
    </div>
    ${limitations.length ? `<div class="panel trace-limitations"><h3>Alcance de esta trazabilidad</h3>${limitations.map((x) => `<p>• ${esc(x)}</p>`).join("")}</div>` : ""}
    <article class="panel">
      <div class="panel-head"><div><h2>Línea de tiempo</h2><p>Eventos encontrados en todas las fuentes disponibles.</p></div></div>
      <div class="timeline">${dedup.length ? dedup.map(traceEventHtml).join("") : '<div class="empty">No hay eventos fechados.</div>'}</div>
    </article>`;
}

function setValue(id, value) {
  const el = $(id);
  if (el) el.value = value ?? "";
}
function scrollToSection(id) {
  requestAnimationFrame(() => document.querySelector(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
}
async function openTraceFromAnywhere(animal, farm = "") {
  setValue("#traceSearch", animal);
  setValue("#traceFarm", farm && ["Ino", "Ino 2", "Los 3 Hnos."].includes(canonicalFarm(farm)) ? canonicalFarm(farm) : "");
  $("#traceSuggestions").innerHTML = "";
  await showView("trazabilidad");
  await renderTrace(animal);
  scrollToSection("#traceResult");
}
async function openAuditIssue(id) {
  const audit = await auditMeta();
  let issue = (audit.issues || []).find((x) => x.id === id);
  if (id === "stale-fpp") {
    const [profiles, heifers, births] = await Promise.all([all("profiles"), all("heifers"), all("births")]);
    const stale = buildCalvings(profiles, heifers, births).filter((x) => x.days < -45);
    issue = { id, area: "Reproducción", title: "FPP antiguas archivadas", detail: "Estas fechas no generan alertas operativas, pero conviene corregirlas en la fuente.", stale };
  }
  if (!issue) return;
  const lists = [];
  if (issue.missing_in_roster?.length) lists.push(`<section><h3>En Ficha Tacto pero no en el padrón activo</h3><div class="chip-list">${issue.missing_in_roster.map((x) => `<button class="badge neutral badge-button" data-open-trace="${esc(x)}" data-trace-farm="Ino">${esc(x)}</button>`).join("")}</div></section>`);
  if (issue.missing_in_ficha?.length) lists.push(`<section><h3>En el padrón activo pero no en Ficha Tacto</h3><div class="chip-list">${issue.missing_in_ficha.map((x) => `<button class="badge warn badge-button" data-open-trace="${esc(x)}" data-trace-farm="Ino">${esc(x)}</button>`).join("")}</div></section>`);
  if (issue.stale?.length) lists.push(`<section><h3>Animales con FPP antigua</h3>${table(["Animal", "Campo", "FPP", "Atraso", "Fuente"], issue.stale.map((x) => `<tr><td>${traceButton(x.animal, x.farm)}</td><td>${esc(x.farm)}</td><td>${fmtDate(x.fpp)}</td><td>${esc(dayText(x.days))}</td><td>${esc(x.source)}</td></tr>`))}</section>`);
  $("#detailEyebrow").textContent = issue.area || "CALIDAD DE DATOS";
  $("#detailTitle").textContent = issue.title;
  $("#detailBody").innerHTML = `<p class="detail-lead">${esc(issue.detail)}</p>${lists.join("") || '<div class="note">Este control es informativo. Abrí el módulo relacionado para revisar los registros de origen.</div>'}<div class="button-row">${issue.id?.includes("heifer") || issue.id?.includes("tacto") ? `<button class="button primary" data-drill="${esc(drillCode("heifer", "active", "Padrón activo de vaquillonas"))}">Abrir vaquillonas</button>` : ""}${issue.id === "individual-stock-partial" ? `<button class="button primary" data-drill="${esc(drillCode("animal-farm", ""))}">Abrir Hacienda</button>` : ""}${issue.id === "historical-reproduction" ? `<button class="button primary" data-drill="${esc(drillCode("heifer", "all", "Historial de vaquillonas"))}">Abrir historial</button>` : ""}</div>`;
  $("#detailDialog").showModal();
}
async function clearViewFilters(viewKey) {
  state.drill[viewKey] = null;
  if (viewKey === "task") { setValue("#taskSearch", ""); setValue("#taskFarm", ""); setValue("#taskType", ""); setValue("#taskStatus", "open"); setValue("#taskHorizon", "30"); resetPages(); return renderAgenda(); }
  if (viewKey === "dairy") { setValue("#dairyFarm", ""); setValue("#dairyCategory", ""); setValue("#dairyRepro", ""); setValue("#dairySearch", ""); resetPages(); return renderDairies(); }
  if (viewKey === "heifer") { setValue("#heiferSearch", ""); setValue("#heiferStatus", "active"); setValue("#heiferOrigin", ""); resetPages(); return renderIno(); }
  if (viewKey === "animal") { setValue("#animalSearch", ""); setValue("#animalFarm", ""); setValue("#animalCategory", ""); setValue("#animalState", "Activo"); resetPages(); return renderHacienda(); }
  if (viewKey === "birth") { setValue("#birthFarm", ""); setValue("#birthResult", ""); setValue("#birthSearch", ""); resetPages(); return renderBirths(); }
  if (viewKey === "movement") { setValue("#movementFarm", ""); setValue("#movementType", ""); setValue("#movementSearch", ""); resetPages(); return renderMovements(); }
  if (viewKey === "health") { setValue("#healthSearch", ""); setValue("#healthFarm", ""); setValue("#healthStatus", "current"); resetPages(); return renderHealth(); }
}
async function applyDrill(code) {
  const [kind, a = "", b = "", c = ""] = drillParts(code);
  if (kind === "audit") return openAuditIssue(a);
  if (kind === "trace") return openTraceFromAnywhere(a, b);
  if (kind === "control-stock") {
    const farm = $("#controlFarm")?.value || "";
    setValue("#animalFarm", farm); setValue("#animalCategory", ""); setValue("#animalState", "Activo"); setValue("#animalSearch", "");
    state.drill.animal = farm ? { label: `Stock de ${farm}` } : { label: "Stock de toda la explotación" };
    await showView("hacienda"); return scrollToSection("#animalTable");
  }
  if (kind === "control-calvings" || kind === "control-tasks") {
    const farm = $("#controlFarm")?.value || "";
    const horizon = $("#controlHorizon")?.value || "90";
    setValue("#taskFarm", farm); setValue("#taskStatus", "open"); setValue("#taskHorizon", horizon); setValue("#taskSearch", ""); setValue("#taskType", kind === "control-calvings" ? "parto" : "");
    state.drill.task = { label: kind === "control-calvings" ? `Partos hasta ${horizon} días${farm ? ` · ${farm}` : ""}` : `Tareas abiertas hasta ${horizon} días${farm ? ` · ${farm}` : ""}` };
    await showView("agenda"); return scrollToSection("#taskList");
  }
  if (kind === "control-births") {
    setValue("#birthFarm", $("#controlFarm")?.value || ""); setValue("#birthResult", ""); setValue("#birthSearch", "");
    state.drill.birth = { label: `Nacimientos ${today().slice(0, 4)}` };
    await showView("nacimientos"); return scrollToSection("#birthTable");
  }
  if (kind === "task-status") {
    setValue("#taskStatus", a); setValue("#taskHorizon", "all"); setValue("#taskType", ""); setValue("#taskSearch", "");
    state.drill.task = { label: a === "done" ? "Tareas realizadas" : a === "in_progress" ? "Tareas en curso" : "Tareas pendientes" };
    await showView("agenda"); return scrollToSection("#taskList");
  }
  if (kind === "task-horizon") {
    setValue("#taskStatus", "open"); setValue("#taskHorizon", a); setValue("#taskType", ""); setValue("#taskSearch", "");
    state.drill.task = { label: a === "overdue" ? "Tareas vencidas" : `Tareas de los próximos ${a} días` };
    await showView("agenda"); return scrollToSection("#taskList");
  }
  if (kind === "dairy") {
    const type = a; const label = b || "Detalle del rodeo";
    state.drill.dairy = { type, label };
    setValue("#dairyCategory", ""); setValue("#dairyRepro", ""); setValue("#dairySearch", "");
    await showView("tambos"); return scrollToSection("#dairyTable");
  }
  if (kind === "heifer") {
    const type = a; const label = b || "Detalle de vaquillonas";
    state.drill.heifer = { type, label };
    const simple = ["active", "pregnant", "empty", "pending", "due", "all"].includes(type) ? type : "all";
    setValue("#heiferStatus", simple); setValue("#heiferSearch", "");
    await showView("ino"); return scrollToSection("#heiferTable");
  }
  if (kind === "animal-farm") {
    setValue("#animalFarm", a); setValue("#animalCategory", ""); setValue("#animalState", "Activo"); setValue("#animalSearch", "");
    state.drill.animal = { label: a ? `Hacienda de ${a}` : "Toda la hacienda" };
    await showView("hacienda"); return scrollToSection("#animalTable");
  }
  if (kind === "animal-category") {
    setValue("#animalFarm", a); setValue("#animalCategory", b); setValue("#animalState", "Activo"); setValue("#animalSearch", "");
    state.drill.animal = { label: `${b}${a ? ` · ${a}` : ""}`, categories: [b] };
    await showView("hacienda"); return scrollToSection("#animalTable");
  }
  if (kind === "animal-beef") {
    const cats = ["Terneritos", "Terneros medianos", "Novillos de engorde", "Novillos medianos", "Novillos grandes", "Vacas de engorde", "Toros"];
    setValue("#animalFarm", a || "Ino"); setValue("#animalCategory", ""); setValue("#animalState", "Activo"); setValue("#animalSearch", "");
    state.drill.animal = { label: "Ganadería y engorde", categories: cats };
    await showView("hacienda"); return scrollToSection("#animalTable");
  }
  if (kind === "birth" || kind === "birth-farm" || kind === "birth-farm-result") {
    if (kind === "birth") { setValue("#birthResult", a === "all" ? "" : a); if (b) setValue("#birthFarm", b); }
    if (kind === "birth-farm") { setValue("#birthFarm", a); setValue("#birthResult", ""); }
    if (kind === "birth-farm-result") { setValue("#birthFarm", a); setValue("#birthResult", b); }
    setValue("#birthSearch", "");
    state.drill.birth = { label: [$("#birthFarm")?.value, $("#birthResult")?.value || "Todos los partos"].filter(Boolean).join(" · ") };
    await showView("nacimientos"); return scrollToSection("#birthTable");
  }
  if (["movement", "movement-custom", "movement-route"].includes(kind)) {
    state.drill.movement = null;
    if (kind === "movement") { setValue("#movementType", a === "all" ? "" : a); if (b) setValue("#movementFarm", b); state.drill.movement = { label: a === "all" ? "Todos los movimientos" : ({ sale: "Ventas", death: "Muertes", internal: "Traslados y cambios" })[a] || a }; }
    if (kind === "movement-custom") { setValue("#movementType", ""); if (b) setValue("#movementFarm", b); state.drill.movement = { type: a, label: a === "calves-to-ino" ? "Terneros trasladados a Ino" : "Vaquillonas pasadas a tambos" }; }
    if (kind === "movement-route") { setValue("#movementType", ""); state.drill.movement = { type: "route", origin: a, destination: b, label: `${a} → ${b}` }; }
    setValue("#movementSearch", "");
    await showView("movimientos"); return scrollToSection("#movementTable");
  }
  if (kind === "health") {
    const type = a; if (b) setValue("#healthFarm", b); setValue("#healthSearch", "");
    if (type === "all") { setValue("#healthStatus", "current"); state.drill.health = { label: "Planes vigentes" }; }
    else if (type === "overdue") { setValue("#healthStatus", "overdue"); state.drill.health = { type, label: "Vencimientos sanitarios vencidos" }; }
    else { setValue("#healthStatus", "all"); state.drill.health = { type, label: type === "due30" ? "Vencimientos dentro de 30 días" : "Vencimientos dentro de 90 días" }; }
    await showView("sanidad"); return scrollToSection("#healthTable");
  }
  if (kind === "source") {
    if (a === "dairy") { setValue("#dairyFarm", b); state.drill.dairy = { type: "active", label: `Perfil de Rodeo · ${b}` }; await showView("tambos"); return scrollToSection("#dairyTable"); }
    if (a === "heifer") { state.drill.heifer = { type: "active", label: "Vaquillas con toro · Ino" }; setValue("#heiferStatus", "active"); await showView("ino"); return scrollToSection("#heiferTable"); }
    if (a === "animal") { state.drill.animal = { label: "Detalle individual de Hacienda" }; await showView("hacienda"); return scrollToSection("#animalTable"); }
    if (a === "birth") { state.drill.birth = { label: "Registros de nacimientos" }; await showView("nacimientos"); return scrollToSection("#birthTable"); }
    if (a === "health") { state.drill.health = { label: "Plan sanitario" }; await showView("sanidad"); return scrollToSection("#healthTable"); }
  }
}

async function renderAll() {
  const active = $(".view.active")?.id || "control";
  const renderer = VIEW_RENDERERS[active] || renderControl;
  await renderer();
}

async function showView(id) {
  $$(".view").forEach((x) => x.classList.toggle("active", x.id === id));
  $$(".main-nav button").forEach((x) => x.classList.toggle("active", x.dataset.view === id));
  window.scrollTo({ top: 0, behavior: "smooth" });
  const renderer = VIEW_RENDERERS[id];
  if (renderer) await renderer();
}

const editorSchemas = {
  task: {
    eyebrow: "AGENDA",
    title: "Tarea",
    store: "tasks",
    fields: [
      ["title", "Título", "text", true], ["due_date", "Fecha", "date", true],
      ["farm", "Establecimiento", "select", false, ["Ino", "Ino 2", "Los 3 Hnos."]], ["type", "Tipo", "select", true, ["parto", "tacto", "secado", "sanidad", "movimiento", "rechazo", "general"]],
      ["status", "Estado", "select", true, ["pending", "in_progress", "done", "dismissed"]], ["priority", "Prioridad", "select", true, ["low", "medium", "high"]],
      ["animal_id", "Animal / caravana", "text", false], ["detail", "Detalle", "textarea", false],
    ],
  },
  birth: {
    eyebrow: "NACIMIENTOS",
    title: "Nacimiento",
    store: "births",
    fields: [
      ["fecha", "Fecha", "date", true], ["establecimiento", "Tambo", "select", true, ["Ino 2", "Los 3 Hnos."]],
      ["madre", "Madre", "text", true], ["padre", "Padre", "text", false], ["sexo", "Sexo", "select", false, ["Macho", "Hembra", "Sin dato"]],
      ["resultado_parto", "Resultado", "select", true, ["Vivo", "Muerto"]], ["muerte_recria_form", "Muerte en recría", "select", false, ["No", "Sí"]], ["fecha_muerte_recria", "Fecha muerte recría", "date", false],
      ["observacion", "Observación", "textarea", false],
    ],
  },
  movement: {
    eyebrow: "MOVIMIENTOS",
    title: "Movimiento",
    store: "movements",
    fields: [
      ["fecha", "Fecha", "date", true], ["establecimiento_origen", "Origen", "text", true], ["lote_origen", "Categoría origen", "text", false],
      ["establecimiento_destino", "Destino", "text", false], ["lote_destino", "Categoría destino", "text", false],
      ["egreso_machos", "Machos", "number", false], ["egreso_hembras", "Hembras", "number", false], ["observacion", "Motivo / detalle", "textarea", false],
    ],
  },
  health: {
    eyebrow: "SANIDAD",
    title: "Trabajo sanitario",
    store: "health",
    fields: [
      ["fecha", "Fecha de aplicación", "date", true], ["establecimiento", "Establecimiento", "select", true, ["Ino", "Ino 2", "Los 3 Hnos."]],
      ["tratamiento", "Tratamiento", "text", true], ["categoria", "Categoría / lote", "text", false], ["vencimiento", "Próximo vencimiento", "date", false], ["observacion", "Observación", "textarea", false],
    ],
  },
  animal: {
    eyebrow: "HACIENDA",
    title: "Animal",
    store: "animals",
    fields: [
      ["caravana", "Caravana", "text", true], ["establecimiento", "Establecimiento", "select", true, ["Ino", "Ino 2", "Los 3 Hnos."]], ["categoria", "Categoría", "text", true],
      ["sexo", "Sexo", "select", false, ["Macho", "Hembra"]], ["tipo_identificacion", "Identificación", "text", false], ["estado", "Estado", "select", true, ["Activo", "Inactivo"]], ["observacion", "Observación", "textarea", false],
    ],
  },
  heifer: {
    eyebrow: "INO · RECRÍA",
    title: "Control reproductivo de vaquillona",
    store: "heifers",
    fields: [
      ["numero", "Número", "text", true], ["origen", "Tambo de origen", "select", false, ["Ino 2", "Los 3 Hnos."]], ["fecha_entore", "Fecha de entore", "date", false], ["toro", "Toro", "text", false],
      ["fecha_tacto", "Fecha de tacto", "date", false], ["resultado", "Resultado", "select", false, ["p", "v", ""]], ["fpp", "Fecha probable de parto", "date", false],
      ["destino", "Tambo de destino", "select", false, ["Ino 2", "Los 3 Hnos."]], ["en_tambo", "Ya está en el tambo", "select", false, ["No", "Sí"]], ["observacion", "Observación", "textarea", false],
    ],
  },
  profile: {
    eyebrow: "PERFIL DE RODEO",
    title: "Registro de vaca",
    store: "profiles",
    fields: [
      ["caravana", "Caravana", "text", true], ["establecimiento", "Tambo", "select", true, ["Ino 2", "Los 3 Hnos."]], ["categoria", "Categoría", "select", true, ["ordene", "seca", "vaquillona"]],
      ["resultado_tacto", "Resultado reproductivo", "select", false, ["p", "v", ""]], ["fecha_ultimo_servicio", "Último servicio", "date", false], ["fecha_probable_parto", "Fecha probable de parto", "date", false],
      ["dias_lactancia", "Días en lactancia", "number", false], ["indicacion_baja", "Indicación de baja", "text", false], ["observaciones", "Observación", "textarea", false],
    ],
  },
};
function inputForField(field, value) {
  const [name, label, type, required, options] = field;
  let input;
  if (type === "select") input = `<select name="${name}" ${required ? "required" : ""}><option value="">Seleccionar</option>${(options || []).map((x) => `<option value="${esc(x)}" ${String(value ?? "") === String(x) ? "selected" : ""}>${esc(x || "Sin resultado")}</option>`).join("")}</select>`;
  else if (type === "textarea") input = `<textarea name="${name}">${esc(value ?? "")}</textarea>`;
  else input = `<input name="${name}" type="${type}" value="${esc(value ?? "")}" ${type === "number" ? 'step="0.01" min="0"' : ""} ${required ? "required" : ""}>`;
  return `<label class="${type === "textarea" ? "full" : ""}">${esc(label)}${input}</label>`;
}
async function openEditor(kind, record = {}, context = {}) {
  const schema = editorSchemas[kind];
  if (!schema) return;
  activeEditor = { kind, schema, record, context };
  const values = { ...record };
  if (kind === "task") {
    values.due_date ||= today(); values.status ||= "pending"; values.type ||= "general"; values.priority ||= "medium";
    if (context.defaultFarm) values.farm ||= context.defaultFarm;
  }
  if (kind === "birth") {
    values.fecha ||= today();
    values.resultado_parto = record.parto_muerto ? "Muerto" : "Vivo";
    values.muerte_recria_form = record.muerte_recria ? "Sí" : "No";
  }
  if (["movement", "health"].includes(kind)) values.fecha ||= today();
  $("#editorEyebrow").textContent = schema.eyebrow;
  $("#editorTitle").textContent = `${record.id ? "Editar" : "Nuevo"}: ${schema.title}`;
  $("#editorFields").innerHTML = schema.fields.map((f) => inputForField(f, values[f[0]])).join("");
  $("#editorDialog").showModal();
  if (kind === "heifer") {
    const result = $("#editorFields [name=resultado]");
    const tacto = $("#editorFields [name=fecha_tacto]");
    const fpp = $("#editorFields [name=fpp]");
    const entore = $("#editorFields [name=fecha_entore]");
    const calculate = () => {
      if (result?.value === "p" && !fpp?.value && entore?.value) fpp.value = addDays(entore.value, 283);
      if (result?.value && tacto && !tacto.value) tacto.value = today();
    };
    result?.addEventListener("change", calculate);
  }
}
async function saveEditor(event) {
  event.preventDefault();
  if (!activeEditor) return;
  const { kind, schema, record, context } = activeEditor;
  const form = new FormData($("#editorForm"));
  const obj = { ...record, id: record.id || `${kind}-${uuid()}`, updated_at: now() };
  for (const [name, , type] of schema.fields) {
    let value = form.get(name) ?? "";
    if (type === "number") value = Number(value || 0);
    obj[name] = value;
  }
  if (kind === "task") {
    obj.source_kind ||= "manual";
    obj.removed = false;
  }
  if (kind === "birth") {
    obj.parto_vivo = obj.resultado_parto === "Vivo";
    obj.parto_muerto = obj.resultado_parto === "Muerto";
    obj.muerte_recria = obj.muerte_recria_form === "Sí";
    delete obj.resultado_parto; delete obj.muerte_recria_form;
  }
  if (kind === "movement") {
    obj.ingreso_machos = Number(record.ingreso_machos || 0);
    obj.ingreso_hembras = Number(record.ingreso_hembras || 0);
    if (obj.establecimiento_destino && !["Venta", "Muerte"].includes(obj.establecimiento_destino)) {
      obj.ingreso_machos = obj.egreso_machos;
      obj.ingreso_hembras = obj.egreso_hembras;
    }
  }
  if (kind === "heifer") {
    obj.caravana = obj.numero;
    obj.activo_entorada = Boolean(obj.fecha_entore && normalize(obj.en_tambo) !== "si" && normalize(obj.en_tambo) !== "sí" && !obj.descarte && !obj.egreso_recria);
  }
  if (kind === "profile") {
    obj.activo = true; obj.categoria_activa = obj.categoria;
  }
  await put(schema.store, obj);
  if (context.taskId) {
    const task = (await mergedTasks()).find((x) => x.id === context.taskId);
    if (task) await put("tasks", { ...task, status: "done", removed: false, updated_at: now() });
  }
  closeEditor();
  toast("Registro guardado");
  await pushOne(schema.store, obj);
  await renderAll();
}

async function findTask(id) { return (await mergedTasks()).find((x) => x.id === id); }
async function saveTaskState(id, patch) {
  const task = await findTask(id);
  if (!task) return;
  const clean = { ...task, ...patch, id, updated_at: now() };
  delete clean.derived_base;
  await put("tasks", clean);
  await pushOne("tasks", clean);
  await renderAll();
}
async function cycleTask(id) {
  const task = await findTask(id);
  if (!task) return;
  const next = task.status === "pending" ? "in_progress" : task.status === "in_progress" ? "done" : "pending";
  await saveTaskState(id, { status: next, removed: false });
}
async function deleteTask(id) {
  const task = await findTask(id);
  if (!task) return;
  if (!confirm("¿Eliminar esta tarea?")) return;
  if (task.source_kind === "derived") await saveTaskState(id, { removed: true, status: "dismissed" });
  else {
    await remove("tasks", id);
    await queueRemoteDeletion("tasks", id);
    if (supabase && session && navigator.onLine) await flushPendingRemoteDeletions();
    await renderAll();
  }
}

const PAGE_STATE_KEYS = ["dairyPage", "heiferPage", "animalPage", "birthPage", "movementPage", "healthPage"];
function resetPages() { PAGE_STATE_KEYS.forEach((key) => { state[key] = 1; }); }
function rendererDrillKey(renderer) {
  return new Map([[renderAgenda, "task"], [renderDairies, "dairy"], [renderIno, "heifer"], [renderHacienda, "animal"], [renderBirths, "birth"], [renderMovements, "movement"], [renderHealth, "health"]]).get(renderer) || "";
}
function bindFilter(id, renderer, eventName = "change") {
  const el = $(id);
  if (!el) return;
  const run = () => { const key = rendererDrillKey(renderer); if (key) state.drill[key] = null; resetPages(); renderer(); };
  el.addEventListener(eventName, run);
  if (el.tagName === "INPUT" && eventName !== "input") el.addEventListener("input", run);
}

async function exportBackup() {
  const payload = { version: 7, exported_at: now(), data: {} };
  for (const storeName of STORES) payload.data[storeName] = await all(storeName);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `campo-hoy-respaldo-${today()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}
async function restoreBackup(file) {
  const payload = JSON.parse(await file.text());
  if (!payload.data) throw new Error("Respaldo inválido");
  for (const name of STORES) if (Array.isArray(payload.data[name])) { await clear(name); await bulkPut(name, payload.data[name]); }
  toast("Respaldo restaurado");
  await renderAll();
}

function workbookRows(workbook, sheetName) {
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: "" });
}
function knownFarm(value) {
  const farm = canonicalFarm(value);
  return ["Ino", "Ino 2", "Los 3 Hnos."].includes(farm) ? farm : "";
}
function detectFarmInRows(rows, allowed = ["Ino", "Ino 2", "Los 3 Hnos."]) {
  for (const row of rows.slice(0, 12)) {
    for (const value of (row || []).slice(0, 20)) {
      const farm = knownFarm(value);
      if (allowed.includes(farm)) return farm;
    }
  }
  return "";
}
function detectFarmFromFilename(fileName, allowed = ["Ino", "Ino 2", "Los 3 Hnos."]) {
  const name = normalize(fileName);
  let farm = "";
  if (name.includes("ino 2") || name.includes("ino2")) farm = "Ino 2";
  else if (name.includes("3 hnos") || name.includes("tres hnos") || name.includes("3 hermanos")) farm = "Los 3 Hnos.";
  else if (name.includes("ino 1") || /(^|[^0-9])ino([^0-9]|$)/.test(name)) farm = "Ino";
  return allowed.includes(farm) ? farm : "";
}
function profileWorkbookInfo(workbook, fileName = "") {
  const sheetName = findWorkbookSheet(workbook, "Rodeo") || workbook.SheetNames[0];
  const rows = workbookRows(workbook, sheetName);
  const fileKey = normalize(fileName);
  const farm = detectFarmInRows(rows, ["Ino 2", "Los 3 Hnos."])
    || detectFarmFromFilename(fileName, ["Ino 2", "Los 3 Hnos."])
    || (fileKey.includes("junio - julio") ? "Ino 2" : fileKey.includes("mayo - junio") ? "Los 3 Hnos." : "");
  if (!farm) throw new Error(`No se pudo identificar el establecimiento del Perfil de Rodeo ${fileName}`);
  return {
    sheetName,
    rows,
    farm,
    fecha_perfil: isoDate(rows?.[2]?.[10]) || today(),
    ultimo_tacto: isoDate(rows?.[2]?.[6]) || "",
  };
}
function parseProfileWorkbook(workbook, fileName = "") {
  const info = profileWorkbookInfo(workbook, fileName);
  const { rows, farm } = info;
  const records = [];
  for (let i = 30; i < rows.length; i++) {
    const r = rows[i] || [];
    if (r[0] === "" || r[0] == null) continue;
    const caravana = cleanExcelCell(r[0]);
    const activeCategory = cleanExcelCell(r[23]);
    const fpp = isoDate(r[11]) || (classifyRepro(r[8]) === "p" && isoDate(r[6]) ? addDays(isoDate(r[6]), 283) : "");
    records.push({
      id: `profile-${normalize(farm).replace(/\s+/g, "-")}-${i + 1}-${canonicalCaravana(caravana)}`,
      establecimiento: farm,
      fila_origen: i + 1,
      caravana,
      fecha_nacimiento: isoDate(r[1]),
      fecha_primer_parto: isoDate(r[2]),
      edad_primer_parto_meses: Number(r[3]) || null,
      fecha_ultimo_parto: isoDate(r[4]),
      numero_partos: Number(r[5]) || 0,
      fecha_ultimo_servicio: isoDate(r[6]),
      numero_servicios: Number(r[7]) || 0,
      resultado_tacto: cleanExcelCell(r[8]).toLowerCase(),
      categoria: activeCategory || cleanExcelCell(r[9]),
      dias_lactancia: Number(r[10]) || null,
      fecha_probable_parto: fpp,
      produccion: Number(r[12]) || null,
      indicacion_baja: cleanExcelCell(r[13]),
      fecha_baja: isoDate(r[14]),
      observaciones: cleanExcelCell(r[15]),
      fecha_ultimo_aborto: isoDate(r[16]),
      numero_abortos: Number(r[17]) || 0,
      categoria_activa: activeCategory,
      activo: Boolean(activeCategory),
      fecha_perfil: info.fecha_perfil,
      ultimo_tacto: info.ultimo_tacto,
      source_file: fileName,
      source: "perfil_rodeo_importado",
      updated_at: now(),
    });
  }
  return { records, farm, fecha_perfil: info.fecha_perfil, ultimo_tacto: info.ultimo_tacto };
}
function parseHeiferWorkbook(workbook, fileName = "") {
  const sheetName = workbook.SheetNames.find((n) => normalize(n).includes("terneras"));
  if (!sheetName) throw new Error("No se encontró la hoja N° Terneras");
  const rows = workbookRows(workbook, sheetName);
  const records = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] || [];
    if (r[1] === "" || r[1] == null) continue;
    const numero = cleanExcelCell(r[1]);
    const entore = isoDate(r[8]);
    const enTambo = cleanExcelCell(r[15]);
    const egreso = isoDate(r[16]);
    const descarte = cleanExcelCell(r[19]);
    records.push({
      id: `heifer-${canonicalCaravana(numero)}-${i + 1}`,
      fila_origen: i + 1,
      senasa: cleanExcelCell(r[0]), numero, caravana: numero,
      fecha_nacimiento: isoDate(r[2]), madre: cleanExcelCell(r[3]), padre: cleanExcelCell(r[4]), origen: canonicalFarm(r[5]),
      ingreso_recria: isoDate(r[6]), edad_ingreso_meses: Number(r[7]) || null, fecha_entore: entore, edad_entore_meses: Number(r[9]) || null, toro: cleanExcelCell(r[10]),
      fecha_tacto: isoDate(r[11]), resultado: cleanExcelCell(r[12]).toLowerCase(), fpp: isoDate(r[13]), aborto: cleanExcelCell(r[14]), en_tambo: enTambo,
      egreso_recria: egreso, destino: canonicalFarm(r[17]), duracion_recria_meses: Number(r[18]) || null, descarte, fecha_descarte: isoDate(r[20]), anos_vida: Number(r[21]) || null,
      observacion: cleanExcelCell(r[22]), activo_entorada: Boolean(entore && !["si", "sí"].includes(normalize(enTambo)) && !egreso && !descarte),
      source_file: fileName, source: "vaquillas_con_toro_importado", updated_at: now(),
    });
  }
  return records;
}
function yesExcelCell(value) {
  const v = normalize(value);
  return value === true || Number(value) === 1 || ["si", "sí", "x", "true", "vivo"].includes(v);
}
function parseBirthWorkbook(workbook, fileName = "") {
  const sheetName = findWorkbookSheet(workbook, "Nacimientos");
  if (!sheetName) throw new Error(`No se encontró la hoja Nacimientos en ${fileName}`);
  const rows = workbookRows(workbook, sheetName);
  const farm = detectFarmFromFilename(fileName, ["Ino 2", "Los 3 Hnos."]) || detectFarmInRows(rows, ["Ino 2", "Los 3 Hnos."]);
  if (!farm) throw new Error(`No se pudo identificar si ${fileName} corresponde a Ino 2 o Los 3 Hnos.`);
  const records = [];
  for (let i = 6; i < rows.length; i++) {
    const r = rows[i] || [];
    const fecha = isoDate(r[1]);
    const madre = cleanExcelCell(r[2]);
    if (!fecha) continue;
    const male = Boolean(cleanExcelCell(r[4]));
    const female = Boolean(cleanExcelCell(r[5]));
    records.push({
      id: `birth-${normalize(farm).replace(/\s+/g, "-")}-${i + 1}-${fecha}-${canonicalCaravana(madre)}`,
      fecha,
      establecimiento: farm,
      madre,
      padre: cleanExcelCell(r[3]),
      sexo: male ? "Macho" : female ? "Hembra" : "",
      parto_vivo: yesExcelCell(r[6]),
      parto_muerto: yesExcelCell(r[7]),
      muerte_recria: yesExcelCell(r[8]),
      fecha_muerte_recria: isoDate(r[9]),
      fila_origen: i + 1,
      source_file: fileName,
      source: "nacimientos_importado",
      updated_at: now(),
    });
  }
  return { records, farm };
}
function parseHealthWorkbook(workbook, fileName = "") {
  const configurations = [
    { names: ["Los 3 Hnos.", "Los 3 Hnos", "Los 3 Hermanos"], farm: "Los 3 Hnos.", date: 2, treatment: 4, due: 12, categoryStart: 7, categoryEnd: 10 },
    { names: ["Ino 2"], farm: "Ino 2", date: 2, treatment: 4, due: 12, categoryStart: 7, categoryEnd: 10 },
    { names: ["Ino 1", "Ino"], farm: "Ino", date: 0, treatment: 2, due: 12, categoryStart: 5, categoryEnd: 10 },
  ];
  const records = [];
  for (const config of configurations) {
    const sheetName = findWorkbookSheet(workbook, config.names);
    if (!sheetName) continue;
    const rows = workbookRows(workbook, sheetName);
    const header = rows[6] || [];
    for (let i = 8; i < Math.min(rows.length, 27); i++) {
      const r = rows[i] || [];
      const fecha = isoDate(r[config.date]);
      const tratamiento = cleanExcelCell(r[config.treatment]);
      if (!fecha || !tratamiento) continue;
      const categories = [];
      for (let c = config.categoryStart; c <= config.categoryEnd; c++) if (cleanExcelCell(r[c])) categories.push(cleanExcelCell(header[c]));
      records.push({
        id: `health-${normalize(config.farm).replace(/\s+/g, "-")}-${i + 1}-${fecha}-${normalize(tratamiento).replace(/[^a-z0-9]+/g, "-")}`,
        fecha,
        establecimiento: config.farm,
        tratamiento,
        vencimiento: isoDate(r[config.due]),
        categoria: categories.filter(Boolean).join(", "),
        observacion: "",
        fila_origen: i + 1,
        source_file: fileName,
        source: "sanidad_importado",
        updated_at: now(),
      });
    }
  }
  if (!records.length) throw new Error(`No se encontraron registros sanitarios en ${fileName}`);
  return records;
}

function cleanExcelCell(value) {
  if (value == null) return "";
  if (value instanceof Date) return isoDate(value);
  const text = String(value).trim();
  return /^\d+\.0$/.test(text) ? text.slice(0, -2) : text;
}
function numericExcelCell(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
function isManagedFarm(value) {
  return ["Ino", "Ino 2", "Los 3 Hnos."].includes(canonicalFarm(value));
}
function findWorkbookSheet(workbook, expected) {
  const names = Array.isArray(expected) ? expected : [expected];
  return workbook.SheetNames.find((sheetName) => names.some((name) => normalize(sheetName) === normalize(name)));
}
function parseHaciendaMovements(workbook) {
  const sheetName = findWorkbookSheet(workbook, "Datos");
  if (!sheetName) throw new Error("No se encontró la hoja Datos de Hacienda Total");
  const rows = workbookRows(workbook, sheetName);
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const fecha = isoDate(row[1]);
    const origin = canonicalFarm(row[2]);
    if (!fecha || !origin) continue;
    records.push({
      id: `hacienda-mov-${i + 1}-${fecha}-${normalize(origin).replace(/\s+/g, "-")}`,
      fecha,
      establecimiento_origen: origin,
      establecimiento_destino: isManagedFarm(row[3]) ? canonicalFarm(row[3]) : cleanExcelCell(row[3]),
      lote_origen: cleanExcelCell(row[4]),
      lote_destino: cleanExcelCell(row[5]),
      egreso_machos: numericExcelCell(row[6]),
      ingreso_machos: numericExcelCell(row[7]),
      egreso_hembras: numericExcelCell(row[8]),
      ingreso_hembras: numericExcelCell(row[9]),
      observacion: cleanExcelCell(row[10]),
      fila_origen: i + 1,
      source: "hacienda_total_importado",
      updated_at: now(),
    });
  }
  return records;
}
function stockCategoryLabel(farm, lot, sex) {
  const normalizedLot = normalize(lot);
  if (normalizedLot === "nacidos") return sex === "Macho" ? "Machos" : "Hembras";
  const labels = {
    "terneritos": "Terneritos", "ter medianos": "Terneros medianos", "vaq s/toro": "Vaquillas sin toro",
    "vaq c/toro": "Vaquillas con toro", "vaq c/toro 2": "Vaquillas con toro 2", "nov medianos": "Novillos medianos",
    "nov grandes": "Novillos grandes", "nov engordes": "Novillos de engorde", "vac engordes": "Vacas de engorde",
    "vacas": "Vacas", "toros": "Toros",
  };
  return labels[normalizedLot] || cleanExcelCell(lot);
}
function calculateHaciendaStock(movements) {
  const ledger = new Map();
  const change = (farm, lot, sex, quantity) => {
    const managedFarm = canonicalFarm(farm);
    if (!isManagedFarm(managedFarm) || !lot || !quantity) return;
    const key = `${managedFarm}\u0001${cleanExcelCell(lot)}\u0001${sex}`;
    ledger.set(key, (ledger.get(key) || 0) + quantity);
  };
  for (const row of movements) {
    const destinationIsFarm = isManagedFarm(row.establecimiento_destino);
    for (const [sex, outgoing, incoming] of [["Macho", row.egreso_machos, row.ingreso_machos], ["Hembra", row.egreso_hembras, row.ingreso_hembras]]) {
      change(row.establecimiento_origen, row.lote_origen, sex, -Number(outgoing || 0));
      if (destinationIsFarm && row.lote_destino) change(row.establecimiento_destino, row.lote_destino, sex, Number(incoming || 0));
      else change(row.establecimiento_origen, row.lote_origen, sex, Number(incoming || 0));
    }
  }
  const farmCategories = new Map();
  for (const [key, quantityRaw] of ledger) {
    const quantity = Math.round(quantityRaw);
    if (quantity <= 0) continue;
    const [farm, lot, sex] = key.split("\u0001");
    const category = stockCategoryLabel(farm, lot, sex);
    if (!farmCategories.has(farm)) farmCategories.set(farm, new Map());
    const categories = farmCategories.get(farm);
    categories.set(category, (categories.get(category) || 0) + quantity);
  }
  const order = ["Los 3 Hnos.", "Ino 2", "Ino"];
  const establecimientos = order.map((farm) => {
    const categories = farmCategories.get(farm) || new Map();
    const categorias = [...categories.entries()].map(([categoria, cantidad]) => ({ categoria, cantidad }));
    return { nombre: farm, total: categorias.reduce((sum, item) => sum + item.cantidad, 0), categorias };
  });
  const dates = movements.map((row) => row.fecha).filter(Boolean).sort();
  return { total: establecimientos.reduce((sum, farm) => sum + farm.total, 0), fecha: dates.at(-1) || today(), establecimientos };
}
function isMissingTag(value) {
  const key = normalize(value).replace(/[^a-z0-9]/g, "");
  return ["sc", "sincaravana", "sindato"].includes(key);
}
function appendHaciendaAnimal(records, farm, category, sex, rowNumber, columnNumber, primaryValue, secondaryValue = "", note = "") {
  const primary = cleanExcelCell(primaryValue);
  const secondary = cleanExcelCell(secondaryValue);
  if (!primary && !secondary) return;
  const preferred = primary && !isMissingTag(primary) ? primary : secondary || primary || "S/C";
  const details = [];
  if (secondary && secondary !== preferred) details.push(`N° propia: ${secondary}`);
  if (note) details.push(note);
  records.push({
    id: `hacienda-animal-${normalize(farm).replace(/\s+/g, "-")}-${rowNumber}-${columnNumber}-${canonicalCaravana(preferred) || "sc"}`,
    caravana: preferred, establecimiento: farm, categoria: category, sexo: sex,
    tipo_identificacion: primary && !isMissingTag(primary) ? "SENASA" : secondary ? "Propia" : "Sin caravana",
    estado: "Activo", observacion: details.join(" · "), fila_origen: rowNumber,
    source: "hacienda_total_importado", updated_at: now(),
  });
}
function parseHaciendaAnimalSheet(workbook, sheetNames, farm, startRow, specifications, noteColumn) {
  const sheetName = findWorkbookSheet(workbook, sheetNames);
  if (!sheetName) return [];
  const rows = workbookRows(workbook, sheetName);
  const records = [];
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i] || [];
    const note = noteColumn == null ? "" : cleanExcelCell(row[noteColumn]);
    for (const spec of specifications) {
      if (spec.secondary == null) appendHaciendaAnimal(records, farm, spec.category, spec.sex, i + 1, spec.primary + 1, row[spec.primary], "", note);
      else appendHaciendaAnimal(records, farm, spec.category, spec.sex, i + 1, spec.primary + 1, row[spec.primary], row[spec.secondary], note);
    }
  }
  return records;
}
function parseHaciendaAnimals(workbook) {
  const ino = parseHaciendaAnimalSheet(workbook, ["Carav Ino"], "Ino", 4, [
    { primary: 1, category: "Terneritos", sex: "Macho" }, { primary: 2, category: "Terneritos", sex: "Hembra" },
    { primary: 4, category: "Terneros medianos", sex: "Macho" }, { primary: 5, category: "Terneros medianos", sex: "Hembra" },
    { primary: 7, category: "Vaquillas sin toro", sex: "Hembra" }, { primary: 9, secondary: 10, category: "Vaquillas con toro", sex: "Hembra" },
    { primary: 12, category: "Novillos medianos", sex: "Macho" }, { primary: 14, category: "Novillos grandes", sex: "Macho" },
    { primary: 16, category: "Novillos de engorde", sex: "Macho" }, { primary: 18, secondary: 19, category: "Vacas de engorde", sex: "Hembra" },
    { primary: 21, category: "Toros", sex: "Macho" },
  ], 23);
  const common = [
    { primary: 1, category: "Machos", sex: "Macho" }, { primary: 3, category: "Hembras", sex: "Hembra" },
    { primary: 5, secondary: 6, category: "Vacas", sex: "Hembra" }, { primary: 8, category: "Toros", sex: "Macho" },
  ];
  const ino2 = parseHaciendaAnimalSheet(workbook, ["Carav Ino 2"], "Ino 2", 3, common, 10);
  const three = parseHaciendaAnimalSheet(workbook, ["Carav 3 Hnos.", "Carav 3 Hnos"], "Los 3 Hnos.", 3, common, 10);
  const records = [...ino, ...ino2, ...three];
  if (!records.length) throw new Error("No se encontraron caravanas en las hojas de Hacienda Total");
  return records;
}
function parseHaciendaWorkbook(workbook) {
  const movements = parseHaciendaMovements(workbook);
  if (!movements.length) throw new Error("La hoja Datos no contiene movimientos reconocibles");
  const animals = parseHaciendaAnimals(workbook);
  const stock = calculateHaciendaStock(movements);
  return { animals, movements, stock };
}
function detectWorkbookSource(workbook, fileName = "") {
  const has = (names) => Boolean(findWorkbookSheet(workbook, names));
  if (has(["N° Terneras", "Nº Terneras", "N Terneras"])) return { type: "heifers", key: "heifers", label: "Vaquillas con toro" };
  if (has("Rodeo")) {
    const farm = profileWorkbookInfo(workbook, fileName).farm;
    return { type: "profile", key: `profile:${farm}`, farm, label: `Perfil de Rodeo · ${farm}` };
  }
  if (has("Nacimientos")) {
    const farm = detectFarmFromFilename(fileName, ["Ino 2", "Los 3 Hnos."]);
    if (!farm) throw new Error(`No pude determinar el establecimiento de ${fileName}`);
    return { type: "births", key: `births:${farm}`, farm, label: `Nacimientos · ${farm}` };
  }
  if (has(["Los 3 Hnos.", "Los 3 Hnos"]) && has("Ino 2") && has(["Ino 1", "Ino"])) return { type: "health", key: "health", label: "Sanidad" };
  if (has("Datos") && (has("Carav Ino") || has("Carav Ino 2"))) return { type: "hacienda", key: "hacienda", label: "Hacienda Total" };
  throw new Error(`La estructura de ${fileName} no coincide con ninguna de las planillas conocidas`);
}
function selectedFilesSummary() {
  const list = $("#sourceFilesList");
  const status = $("#sourceImportStatus");
  if (!list) return;
  if (!sourceFiles.length) {
    list.innerHTML = `<div class="empty">Todavía no seleccionaste planillas.</div>`;
    if (status) status.innerHTML = "";
    return;
  }
  list.innerHTML = sourceFiles.map((file) => `<div class="source-file-row"><span>📄</span><div><b>${esc(file.name)}</b><small>${number(Math.round(file.size / 1024))} KB</small></div><button class="mini-button" type="button" data-remove-source-file="${esc(file.name)}">Quitar</button></div>`).join("");
  if (status) status.innerHTML = alertBox("info", `${number(sourceFiles.length)} planillas seleccionadas`, "Podés agregar más archivos o importar cuando estén las siete fuentes.", "✓");
}
function addSelectedSourceFiles(fileList) {
  for (const file of fileList || []) {
    const identity = `${file.name}\u0001${file.size}\u0001${file.lastModified}`;
    if (!sourceFiles.some((item) => `${item.name}\u0001${item.size}\u0001${item.lastModified}` === identity)) sourceFiles.push(file);
  }
  selectedFilesSummary();
}
async function importAllSources() {
  if (!sourceFiles.length) return toast("Elegí las planillas de OneDrive");
  if (!(await ensureXlsxSdk())) return toast("Para leer Excel, abrí la app una vez con internet");
  const status = $("#sourceImportStatus");
  status.innerHTML = alertBox("info", "Leyendo todas las planillas", "Primero se validan completas; todavía no se reemplazó ningún dato.", "…");
  try {
    const parsed = new Map();
    const duplicates = [];
    for (const file of sourceFiles) {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const source = detectWorkbookSource(workbook, file.name);
      if (parsed.has(source.key)) duplicates.push(source.label);
      if (source.type === "hacienda") parsed.set(source.key, { ...source, file, data: parseHaciendaWorkbook(workbook) });
      if (source.type === "heifers") parsed.set(source.key, { ...source, file, data: parseHeiferWorkbook(workbook, file.name) });
      if (source.type === "profile") parsed.set(source.key, { ...source, file, data: parseProfileWorkbook(workbook, file.name) });
      if (source.type === "births") parsed.set(source.key, { ...source, file, data: parseBirthWorkbook(workbook, file.name) });
      if (source.type === "health") parsed.set(source.key, { ...source, file, data: parseHealthWorkbook(workbook, file.name) });
    }
    const required = [
      ["hacienda", "Hacienda Total"], ["heifers", "Vaquillas con toro"], ["health", "Sanidad"],
      ["profile:Ino 2", "Perfil de Rodeo · Ino 2"], ["profile:Los 3 Hnos.", "Perfil de Rodeo · Los 3 Hnos."],
      ["births:Ino 2", "Nacimientos · Ino 2"], ["births:Los 3 Hnos.", "Nacimientos · Los 3 Hnos."],
    ];
    const missing = required.filter(([key]) => !parsed.has(key)).map(([, label]) => label);
    if (missing.length) throw new Error(`Faltan: ${missing.join("; ")}. No se modificó ningún dato.`);

    const hacienda = parsed.get("hacienda");
    const heifers = parsed.get("heifers");
    const health = parsed.get("health");
    const profileIno2 = parsed.get("profile:Ino 2");
    const profileThree = parsed.get("profile:Los 3 Hnos.");
    const birthsIno2 = parsed.get("births:Ino 2");
    const birthsThree = parsed.get("births:Los 3 Hnos.");
    const profileRecords = [...profileIno2.data.records, ...profileThree.data.records];
    const birthRecords = [...birthsIno2.data.records, ...birthsThree.data.records];

    await clear("animals"); await bulkPut("animals", hacienda.data.animals);
    await clear("movements"); await bulkPut("movements", hacienda.data.movements);
    await clear("heifers"); await bulkPut("heifers", heifers.data);
    await clear("health"); await bulkPut("health", health.data);
    await clear("profiles"); await bulkPut("profiles", profileRecords);
    await clear("births"); await bulkPut("births", birthRecords);
    await setMeta("stock", { value: hacienda.data.stock });

    const sources = await sourceMeta();
    sources.hacienda = { source_file: hacienda.file.name, imported_at: now(), stock_total: hacienda.data.stock.total, latest_date: hacienda.data.stock.fecha };
    sources.heifers = { source_file: heifers.file.name, imported_at: now(), records: heifers.data.length };
    sources.health = { source_file: health.file.name, imported_at: now(), records: health.data.length };
    sources.profiles = { imported_at: now(), sources: { "Ino 2": profileIno2.file.name, "Los 3 Hnos.": profileThree.file.name }, dates: { "Ino 2": profileIno2.data.fecha_perfil, "Los 3 Hnos.": profileThree.data.fecha_perfil } };
    sources.births = { imported_at: now(), sources: { "Ino 2": birthsIno2.file.name, "Los 3 Hnos.": birthsThree.file.name }, records: { "Ino 2": birthsIno2.data.records.length, "Los 3 Hnos.": birthsThree.data.records.length } };
    sources.last_import = { type: "all_sources", files: sourceFiles.map((file) => file.name), at: now() };
    await setMeta("sources", { value: sources });

    const replacementTypes = ["animals", "movements", "heifers", "health", "profiles", "births"];
    await queueRemoteReplacements(replacementTypes);
    let cloudDetail = "Quedó guardado en este dispositivo.";
    if (supabase && session && navigator.onLine) {
      await flushPendingRemoteReplacements();
      await syncMetadata();
      cloudDetail = "También quedó reemplazado en la nube.";
    } else cloudDetail = "Se subirá a la nube al tocar Sincronizar ahora cuando haya internet.";

    const duplicateDetail = duplicates.length ? ` Se eligió el último archivo para: ${[...new Set(duplicates)].join(", ")}.` : "";
    status.innerHTML = alertBox("info", "Las siete fuentes quedaron actualizadas", `${number(hacienda.data.stock.total)} animales de stock; ${number(hacienda.data.movements.length)} movimientos; ${number(birthRecords.length)} nacimientos; ${number(health.data.length)} registros sanitarios; ${number(profileRecords.filter((x) => x.activo).length)} animales activos en tambos; ${number(heifers.data.filter((x) => x.activo_entorada).length)} vaquillas entoradas activas. ${cloudDetail}${duplicateDetail}`, "✓");
    sourceFiles = [];
    $("#sourceFiles").value = "";
    selectedFilesSummary();
    status.innerHTML = alertBox("info", "Las siete fuentes quedaron actualizadas", `${number(hacienda.data.stock.total)} animales de stock; ${number(hacienda.data.movements.length)} movimientos; ${number(birthRecords.length)} nacimientos; ${number(health.data.length)} registros sanitarios; ${number(profileRecords.filter((x) => x.activo).length)} animales activos en tambos; ${number(heifers.data.filter((x) => x.activo_entorada).length)} vaquillas entoradas activas. ${cloudDetail}${duplicateDetail}`, "✓");
    await renderAll();
  } catch (error) {
    console.error(error);
    status.innerHTML = alertBox("danger", "No se importó nada", error.message || "Alguna planilla no fue reconocida", "⚠");
  }
}

async function queueRemoteReplacements(types) {
  const current = (await getMeta("pending-remote-replacements"))?.value || [];
  await setMeta("pending-remote-replacements", { value: [...new Set([...current, ...types])] });
}
async function replaceRemoteCollection(type) {
  if (!supabase || !session || !navigator.onLine) return false;
  const deletion = await supabase.from("campo_records").delete().eq("owner_id", session.user.id).eq("entity_type", type);
  if (deletion.error) throw deletion.error;
  const local = await all(type);
  for (let i = 0; i < local.length; i += 300) await pushBatch(type, local.slice(i, i + 300));
  return true;
}
async function flushPendingRemoteReplacements() {
  if (!supabase || !session || !navigator.onLine) return false;
  const pendingMeta = await getMeta("pending-remote-replacements");
  const pending = pendingMeta?.value || [];
  if (!pending.length) return true;
  for (const type of pending) await replaceRemoteCollection(type);
  await setMeta("pending-remote-replacements", { value: [] });
  return true;
}

function updateAuthGate() {
  const gate = $("#authGate");
  const protectedApp = $("#protectedApp");
  if (!gate || !protectedApp) return;
  const loggedIn = Boolean(session || offlineAccess || demoMode);
  gate.classList.toggle("hidden", loggedIn);
  protectedApp.classList.toggle("hidden", !loggedIn);
  if (loggedIn) {
    const email = session?.user?.email || offlineUser?.email || "";
    if ($("#email")) $("#email").value = email;
  } else if (!navigator.onLine && $("#gateMessage")) {
    $("#gateMessage").textContent = "Para habilitar el uso sin señal, ingresá una vez con internet en este dispositivo.";
  }
}
async function enterDemo() {
  demoMode = true;
  await setMeta("demo-session", { value: { started_at: now(), mode: "local" } });
  updateAuthGate();
  await renderAll();
  toast("Demo iniciada con datos ficticios");
}
async function gateLogin(signup = false) {
  if (!supabase) await initSupabase();
  if (!supabase) {
    $("#gateMessage").textContent = navigator.onLine ? "No se pudo conectar con Supabase. Probá nuevamente." : "Sin señal. Este dispositivo necesita un primer ingreso con internet.";
    return;
  }
  const email = $("#gateEmail").value.trim();
  const password = $("#gatePassword").value;
  if (!email || !password) {
    $("#gateMessage").textContent = "Ingresá correo y contraseña.";
    return;
  }
  $("#gateMessage").textContent = signup ? "Creando usuario…" : "Ingresando…";
  const result = signup
    ? await supabase.auth.signUp({ email, password })
    : await supabase.auth.signInWithPassword({ email, password });
  if (result.error) {
    $("#gateMessage").textContent = result.error.message;
    return;
  }
  session = result.data.session;
  if (session) await rememberOfflineAccess(session.user);
  if (!session && signup) {
    $("#gateMessage").textContent = "Usuario creado. Revisá el correo para confirmar la cuenta.";
    return;
  }
  $("#gateMessage").textContent = "";
  updateAuthGate();
  await syncAll();
  await renderAll();
}

async function initSupabase() {
  const cfg = window.CAMPO_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || supabase) return;
  try {
    const loaded = await ensureSupabaseSdk();
    if (!loaded) throw new Error("No se cargó la biblioteca de Supabase");
    const sdk = window.supabase;
    supabase = sdk.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    session = (await supabase.auth.getSession()).data.session;
    if (session) await rememberOfflineAccess(session.user);
    updateAuthGate();
    supabase.auth.onAuthStateChange(async (_event, current) => {
      session = current;
      if (session) await rememberOfflineAccess(session.user);
      updateAuthGate();
      if (session && navigator.onLine) {
        await syncAll();
        await renderAll();
      }
    });
    if (session && navigator.onLine) await syncAll();
  } catch (error) {
    console.warn("Supabase no disponible", error);
    supabase = null;
    updateAuthGate();
  }
}
async function login(signup = false) {
  if (!supabase) await initSupabase();
  if (!supabase) return toast("La conexión todavía no está disponible");
  const email = $("#email").value.trim();
  const password = $("#password").value;
  if (!email || !password) return toast("Ingresá correo y contraseña");
  const result = signup ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
  if (result.error) return toast(result.error.message);
  session = result.data.session;
  if (session) await rememberOfflineAccess(session.user);
  updateAuthGate();
  toast(signup ? "Usuario creado" : "Sesión iniciada");
  await renderData();
}
async function pushOne(type, object) {
  if (!supabase || !session || !navigator.onLine || !object) return;
  const row = { owner_id: session.user.id, entity_type: type, record_id: object.id, payload: object, updated_at: object.updated_at || now() };
  const result = await supabase.from("campo_records").upsert(row, { onConflict: "owner_id,entity_type,record_id" });
  if (result.error) console.warn(result.error);
}
async function pushBatch(type, objects) {
  if (!supabase || !session || !navigator.onLine || !objects.length) return;
  const rows = objects.map((object) => ({ owner_id: session.user.id, entity_type: type, record_id: object.id, payload: object, updated_at: object.updated_at || now() }));
  const result = await supabase.from("campo_records").upsert(rows, { onConflict: "owner_id,entity_type,record_id" });
  if (result.error) throw result.error;
}

async function fetchAllRemoteRows(entityType) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const result = await supabase
      .from("campo_records")
      .select("*")
      .eq("owner_id", session.user.id)
      .eq("entity_type", entityType)
      .order("record_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (result.error) throw result.error;
    const page = result.data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function syncMetadata(preferRemote = false) {
  if (!supabase || !session || !navigator.onLine) return;
  const allowed = ["stock", "sources", "audit"];
  const localRows = (await all("meta")).filter((row) => allowed.includes(row.id));
  const remoteRows = await fetchAllRemoteRows("meta");
  const localMap = new Map(localRows.map((row) => [row.id, row]));
  for (const row of remoteRows) {
    if (!allowed.includes(row.record_id)) continue;
    const current = localMap.get(row.record_id);
    if (preferRemote || !current || new Date(row.updated_at) > new Date(current.updated_at || 0)) await put("meta", { ...row.payload, updated_at: row.updated_at });
  }
  const merged = (await all("meta")).filter((row) => allowed.includes(row.id));
  for (let i = 0; i < merged.length; i += 300) await pushBatch("meta", merged.slice(i, i + 300));
}
async function syncAll() {
  if (syncInProgress) return;
  if (!supabase || !session) return toast(offlineAccess ? "Los cambios están guardados localmente. Ingresá con internet para sincronizar." : "Ingresá primero");
  if (!navigator.onLine) return toast("Sin señal: los cambios quedan guardados en este dispositivo");
  syncInProgress = true;
  toast("Sincronizando…");
  try {
    const pendingBefore = (await getMeta("pending-remote-replacements"))?.value || [];
    const firstCloudSync = !(await getMeta("device-cloud-state"))?.value?.has_synced;
    await flushPendingRemoteDeletions();
    await flushPendingRemoteReplacements();
    for (const name of ["animals", "births", "health", "movements", "profiles", "heifers", "tasks"]) {
      const local = await all(name);
      const remoteRows = await fetchAllRemoteRows(name);
      if (name === "profiles" && remoteRows.length > 0 && remoteRows.length < 1279) {
        throw new Error(`Supabase devolvió solo ${remoteRows.length} perfiles. Se canceló la sincronización para no dejar datos incompletos.`);
      }
      if (firstCloudSync && remoteRows.length) {
        // Primer inicio en un dispositivo/dominio nuevo: la nube es la fuente de verdad.
        // Evita que los datos de ejemplo o una copia local vieja vuelvan a contaminar Supabase.
        await clear(name);
        await bulkPut(name, remoteRows.map((row) => ({ ...row.payload, updated_at: row.updated_at })));
      } else {
        // Sincronizaciones posteriores: conserva el registro más reciente por ID.
        const localMap = new Map(local.map((x) => [x.id, x]));
        for (const row of remoteRows) {
          const current = localMap.get(row.record_id);
          if (!current || new Date(row.updated_at) > new Date(current.updated_at || 0)) {
            await put(name, { ...row.payload, updated_at: row.updated_at });
          }
        }
        const merged = await all(name);
        for (let i = 0; i < merged.length; i += 300) await pushBatch(name, merged.slice(i, i + 300));
      }
    }
    await syncMetadata(firstCloudSync && !pendingBefore.length);
    await setMeta("device-cloud-state", { value: { has_synced: true, last_sync: now() } });
    toast("Sincronización terminada");
    await renderAll();
  } catch (error) {
    console.error(error);
    toast(error.message || "Error al sincronizar");
  } finally {
    syncInProgress = false;
  }
}


function closeEditor() {
  const dialog = $("#editorDialog");
  if (dialog?.open) dialog.close("cancel");
  activeEditor = null;
  const form = $("#editorForm");
  if (form) form.reset();
}

function bindEvents() {
  const editorDialog = $("#editorDialog");
  $$('[data-action="close-dialog"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeEditor();
    });
  });
  editorDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeEditor();
  });
  editorDialog?.addEventListener("click", (event) => {
    if (event.target === editorDialog) closeEditor();
  });
  const detailDialog = $("#detailDialog");
  detailDialog?.addEventListener("cancel", (event) => { event.preventDefault(); detailDialog.close(); });
  detailDialog?.addEventListener("click", (event) => { if (event.target === detailDialog) detailDialog.close(); });
  $$(".main-nav [data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
  $$('[data-view-jump]').forEach((button) => button.addEventListener("click", () => showView(button.dataset.viewJump)));
  bindFilter("#controlFarm", renderControl); bindFilter("#controlHorizon", renderControl);
  bindFilter("#taskSearch", renderAgenda, "input"); bindFilter("#taskFarm", renderAgenda); bindFilter("#taskType", renderAgenda); bindFilter("#taskStatus", renderAgenda); bindFilter("#taskHorizon", renderAgenda);
  bindFilter("#dairyFarm", renderDairies); bindFilter("#dairyCategory", renderDairies); bindFilter("#dairyRepro", renderDairies); bindFilter("#dairySearch", renderDairies, "input");
  bindFilter("#heiferSearch", renderIno, "input"); bindFilter("#heiferStatus", renderIno); bindFilter("#heiferOrigin", renderIno);
  bindFilter("#animalSearch", renderHacienda, "input");
  bindFilter("#traceFarm", renderTraceSuggestions);
  $("#traceSearch")?.addEventListener("input", renderTraceSuggestions);
  $("#traceSearch")?.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); renderTrace(); } });
  $("#traceFindBtn")?.addEventListener("click", () => renderTrace());
  $("#traceClearBtn")?.addEventListener("click", () => { $("#traceSearch").value = ""; state.traceAnimal = ""; $("#traceSuggestions").innerHTML = ""; renderTrace(""); }); bindFilter("#animalFarm", renderHacienda); bindFilter("#animalCategory", renderHacienda); bindFilter("#animalState", renderHacienda);
  bindFilter("#birthYear", renderBirths); bindFilter("#birthFarm", renderBirths); bindFilter("#birthResult", renderBirths); bindFilter("#birthSearch", renderBirths, "input");
  bindFilter("#movementYear", renderMovements); bindFilter("#movementFarm", renderMovements); bindFilter("#movementType", renderMovements); bindFilter("#movementSearch", renderMovements, "input");
  bindFilter("#healthSearch", renderHealth, "input"); bindFilter("#healthFarm", renderHealth); bindFilter("#healthStatus", renderHealth);
  $("#editorForm").addEventListener("submit", saveEditor);
  $("#exportBtn").addEventListener("click", exportBackup);
  $("#backupFile").addEventListener("change", async (e) => { try { if (e.target.files[0]) await restoreBackup(e.target.files[0]); } catch (error) { toast(error.message); } });
  $("#sourceFiles").addEventListener("change", (event) => { addSelectedSourceFiles(event.target.files); event.target.value = ""; });
  $("#importAllSourcesBtn").addEventListener("click", importAllSources);
  $("#clearSourceFilesBtn").addEventListener("click", () => { sourceFiles = []; $("#sourceFiles").value = ""; selectedFilesSummary(); });
  $("#gateLoginBtn")?.addEventListener("click", () => gateLogin(false));
  $("#gateSignupBtn")?.addEventListener("click", () => gateLogin(true));
  $("#demoLoginBtn")?.addEventListener("click", enterDemo);
  $("#gatePassword")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") gateLogin(false);
  });
  $("#loginBtn").addEventListener("click", () => login(false));
  $("#signupBtn").addEventListener("click", () => login(true));
  $("#syncBtn").addEventListener("click", syncAll);
  $("#logoutBtn").addEventListener("click", async () => {
    if (supabase) await supabase.auth.signOut();
    session = null;
    demoMode = false;
    await forgetOfflineAccess();
    updateAuthGate();
  });
  document.addEventListener("click", async (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.drill) { $("#detailDialog")?.close(); return applyDrill(target.dataset.drill); }
    if (target.dataset.openTrace) { $("#detailDialog")?.close(); return openTraceFromAnywhere(target.dataset.openTrace, target.dataset.traceFarm || ""); }
    if (target.dataset.clearView) return clearViewFilters(target.dataset.clearView);
    if (target.dataset.action === "close-detail") { event.preventDefault(); return $("#detailDialog")?.close(); }
    if (target.dataset.removeSourceFile) { sourceFiles = sourceFiles.filter((file) => file.name !== target.dataset.removeSourceFile); return selectedFilesSummary(); }
    if (target.dataset.action === "close-dialog") { event.preventDefault(); return closeEditor(); }
    if (target.dataset.traceAnimal) { $("#traceSearch").value = target.dataset.traceAnimal; $("#traceSuggestions").innerHTML = ""; return renderTrace(target.dataset.traceAnimal); }
    if (target.dataset.action === "new-task") return openEditor("task", {}, { defaultFarm: target.dataset.defaultFarm || "", defaultAnimal: target.dataset.defaultAnimal || "" });
    if (target.dataset.action === "new-birth") return openEditor("birth");
    if (target.dataset.action === "new-movement") return openEditor("movement", { establecimiento_origen: target.dataset.defaultFarm || "" });
    if (target.dataset.action === "new-health") return openEditor("health");
    if (target.dataset.action === "new-animal") return openEditor("animal", { estado: "Activo" });
    if (target.dataset.taskCycle) return cycleTask(target.dataset.taskCycle);
    if (target.dataset.dismissTask) return saveTaskState(target.dataset.dismissTask, { status: "dismissed", removed: false });
    if (target.dataset.reactivateTask) return saveTaskState(target.dataset.reactivateTask, { status: "pending", removed: false });
    if (target.dataset.deleteTask) return deleteTask(target.dataset.deleteTask);
    if (target.dataset.editTask) { const task = await findTask(target.dataset.editTask); if (task) { const clean = { ...task }; delete clean.derived_base; return openEditor("task", clean); } }
    if (target.dataset.taskAction) {
      const task = await findTask(target.dataset.taskId);
      if (!task) return;
      if (target.dataset.taskAction === "birth") {
        const source = await getOne(task.source_store, task.source_id);
        const farm = task.farm === "Ino" ? (source?.destino || source?.origen || "Ino 2") : task.farm;
        return openEditor("birth", { fecha: today(), establecimiento: farm, madre: task.animal_id, padre: source?.toro || "" }, { taskId: task.id });
      }
      if (target.dataset.taskAction === "heifer") { const source = await getOne("heifers", task.source_id); if (source) return openEditor("heifer", source, { taskId: task.id }); }
    }
    if (target.dataset.editProfile) { const row = await getOne("profiles", target.dataset.editProfile); if (row) return openEditor("profile", row); }
    if (target.dataset.newBirthProfile) { const row = await getOne("profiles", target.dataset.newBirthProfile); if (row) return openEditor("birth", { fecha: today(), establecimiento: row.establecimiento, madre: row.caravana }); }
    if (target.dataset.editHeifer) { const row = await getOne("heifers", target.dataset.editHeifer); if (row) return openEditor("heifer", row); }
    if (target.dataset.newBirthHeifer) { const row = await getOne("heifers", target.dataset.newBirthHeifer); if (row) return openEditor("birth", { fecha: today(), establecimiento: row.destino || row.origen || "Ino 2", madre: row.numero, padre: row.toro || "" }); }
    if (target.dataset.editAnimal) { const row = await getOne("animals", target.dataset.editAnimal); if (row) return openEditor("animal", row); }
    if (target.dataset.editBirth) { const row = await getOne("births", target.dataset.editBirth); if (row) return openEditor("birth", row); }
    if (target.dataset.editMovement) { const row = await getOne("movements", target.dataset.editMovement); if (row) return openEditor("movement", row); }
    if (target.dataset.editHealth) { const row = await getOne("health", target.dataset.editHealth); if (row) return openEditor("health", row); }
    if (target.dataset.page) {
      state[target.dataset.page] += Number(target.dataset.delta || 0);
      const renderer = { dairyPage: renderDairies, heiferPage: renderIno, animalPage: renderHacienda, birthPage: renderBirths, movementPage: renderMovements, healthPage: renderHealth }[target.dataset.page];
      if (renderer) return renderer();
    }
  });
  window.addEventListener("online", async () => {
    $("#networkStatus").textContent = "En línea";
    $("#networkStatus").classList.remove("offline");
    if (!supabase) await initSupabase();
    if (session) await syncAll();
  });
  window.addEventListener("offline", () => {
    $("#networkStatus").textContent = "Sin señal · guardado local";
    $("#networkStatus").classList.add("offline");
  });
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredPrompt = event; $("#installBtn").classList.remove("hidden"); });
  $("#installBtn").addEventListener("click", async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $("#installBtn").classList.add("hidden"); });
}

async function init() {
  $("#networkStatus").textContent = navigator.onLine ? "En línea" : "Sin señal · guardado local";
  $("#networkStatus").classList.toggle("offline", !navigator.onLine);
  db = await openDb();
  await seed();
  await loadOfflineAccess();
  updateAuthGate();
  bindEvents();
  selectedFilesSummary();
  await renderAll();
  initSupabase().then(() => { if ($(".view.active")?.id === "datos") renderData(); });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js?v=8.6").catch(console.warn);
}

init().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML("beforeend", `<div class="toast show">No se pudo iniciar: ${esc(error.message)}</div>`);
});
