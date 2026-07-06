import { appDataDir, join, basename } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { exists, mkdir, readTextFile, writeTextFile, readFile, writeFile, remove } from "@tauri-apps/plugin-fs";

const ROOT_DIR = "ficwriter";

export type WallpaperKind = "builtin" | "user";

export type WallpaperItem = {
  id: string;
  kind: WallpaperKind;
  title: string;
  // builtin
  assetKey?: string; // "nebula-01"
  // user
  relPath?: string;  // "wallpapers/xxx.webp"
  createdAt: number;
};

type Settings = {
  selectedWallpaperId?: string;
};

const BUILTIN_WALLPAPERS: WallpaperItem[] = [
  { id: "builtin:avatar", kind: "builtin", title: "avatar", assetKey: "avatar", createdAt: 0 },
  { id: "builtin:backerei", kind: "builtin", title: "backerei", assetKey: "backerei", createdAt: 0 },
  { id: "builtin:berry", kind: "builtin", title: "berry", assetKey: "berry", createdAt: 0 },
  { id: "builtin:board", kind: "builtin", title: "board", assetKey: "board", createdAt: 0 },
  { id: "builtin:bridgerton", kind: "builtin", title: "bridgerton", assetKey: "bridgerton", createdAt: 0 },
  { id: "builtin:chocolate", kind: "builtin", title: "chocolate", assetKey: "chocolate", createdAt: 0 },
  { id: "builtin:christmas", kind: "builtin", title: "christmas", assetKey: "christmas", createdAt: 0 },
  { id: "builtin:cozycup", kind: "builtin", title: "cozycup", assetKey: "cozycup", createdAt: 0 },
  { id: "builtin:cyber", kind: "builtin", title: "cyber", assetKey: "cyber", createdAt: 0 },
  { id: "builtin:desk", kind: "builtin", title: "desk", assetKey: "desk", createdAt: 0 },
  { id: "builtin:dune", kind: "builtin", title: "dune", assetKey: "dune", createdAt: 0 },
  { id: "builtin:fairy", kind: "builtin", title: "fairy", assetKey: "fairy", createdAt: 0 },
  { id: "builtin:fairyforest", kind: "builtin", title: "fairyforest", assetKey: "fairyforest", createdAt: 0 },
  { id: "builtin:fairytale", kind: "builtin", title: "fairytale", assetKey: "fairytale", createdAt: 0 },
  { id: "builtin:fall", kind: "builtin", title: "fall", assetKey: "fall", createdAt: 0 },
  { id: "builtin:flowers-CDjQrLaG", kind: "builtin", title: "flowers-CDjQrLaG", assetKey: "flowers-CDjQrLaG", createdAt: 0 },
  { id: "builtin:flowertown", kind: "builtin", title: "flowertown", assetKey: "flowertown", createdAt: 0 },
  { id: "builtin:france", kind: "builtin", title: "france", assetKey: "france", createdAt: 0 },
  { id: "builtin:fruhstuck", kind: "builtin", title: "fruhstuck", assetKey: "fruhstuck", createdAt: 0 },
  { id: "builtin:garden", kind: "builtin", title: "garden", assetKey: "garden", createdAt: 0 },
  { id: "builtin:gothic", kind: "builtin", title: "gothic", assetKey: "gothic", createdAt: 0 },
  { id: "builtin:india", kind: "builtin", title: "india", assetKey: "india", createdAt: 0 },
  { id: "builtin:japan", kind: "builtin", title: "japan", assetKey: "japan", createdAt: 0 },
  { id: "builtin:jungle", kind: "builtin", title: "jungle", assetKey: "jungle", createdAt: 0 },
  { id: "builtin:lake", kind: "builtin", title: "lake", assetKey: "lake", createdAt: 0 },
  { id: "builtin:lakeducks", kind: "builtin", title: "lakeducks", assetKey: "lakeducks", createdAt: 0 },
  { id: "builtin:library", kind: "builtin", title: "library", assetKey: "library", createdAt: 0 },
  { id: "builtin:lilaperl", kind: "builtin", title: "lilaperl", assetKey: "lilaperl", createdAt: 0 },
  { id: "builtin:rome", kind: "builtin", title: "rome", assetKey: "rome", createdAt: 0 },
  { id: "builtin:roses-DqkKNgzB", kind: "builtin", title: "roses-DqkKNgzB", assetKey: "roses-DqkKNgzB", createdAt: 0 },
  { id: "builtin:roses", kind: "builtin", title: "roses", assetKey: "roses", createdAt: 0 },
  { id: "builtin:sea", kind: "builtin", title: "sea", assetKey: "sea", createdAt: 0 },
  { id: "builtin:space", kind: "builtin", title: "space", assetKey: "space", createdAt: 0 },
  { id: "builtin:steampank", kind: "builtin", title: "steampank", assetKey: "steampank", createdAt: 0 },
  { id: "builtin:valentine", kind: "builtin", title: "valentine", assetKey: "valentine", createdAt: 0 },
  { id: "builtin:winter", kind: "builtin", title: "winter", assetKey: "winter", createdAt: 0 },
];

// пути к ассетам (подставь свои файлы в src/assets/wallpapers/)
function builtinAssetUrl(assetKey: string) {
  // Vite: new URL(..., import.meta.url).href
  return new URL(`../assets/wallpapers/${assetKey}.png`, import.meta.url).href;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function rootDir() {
  const base = await appDataDir();
  const root = await join(base, ROOT_DIR);
  if (!(await exists(root))) await mkdir(root, { recursive: true });
  return root;
}

async function wallpapersDir() {
  const root = await rootDir();
  const dir = await join(root, "wallpapers");
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  return dir;
}

async function wallpapersIndexPath() {
  const root = await rootDir();
  return await join(root, "wallpapers-index.json");
}

async function settingsPath() {
  const root = await rootDir();
  return await join(root, "settings.json");
}

export async function ensureWallpaperSystem() {
  await rootDir();
  await wallpapersDir();
  const idx = await wallpapersIndexPath();
  if (!(await exists(idx))) await writeTextFile(idx, JSON.stringify([], null, 2));
  const sp = await settingsPath();
  if (!(await exists(sp))) await writeTextFile(sp, JSON.stringify({}, null, 2));
}

async function readSettings(): Promise<Settings> {
  const p = await settingsPath();
  if (!(await exists(p))) return {};
  try {
    return JSON.parse(await readTextFile(p)) as Settings;
  } catch {
    return {};
  }
}

async function writeSettings(s: Settings) {
  const p = await settingsPath();
  await writeTextFile(p, JSON.stringify(s, null, 2));
}

export async function loadUserWallpapers(): Promise<WallpaperItem[]> {
  const p = await wallpapersIndexPath();
  if (!(await exists(p))) return [];
  try {
    const arr = JSON.parse(await readTextFile(p));
    return Array.isArray(arr) ? (arr as WallpaperItem[]) : [];
  } catch {
    return [];
  }
}

async function saveUserWallpapers(items: WallpaperItem[]) {
  const p = await wallpapersIndexPath();
  await writeTextFile(p, JSON.stringify(items, null, 2));
}

export async function loadAllWallpapers(): Promise<WallpaperItem[]> {
  await ensureWallpaperSystem();
  const user = await loadUserWallpapers();
  return [...BUILTIN_WALLPAPERS, ...user].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function setSelectedWallpaper(id: string | null) {
  const s = await readSettings();
  if (!id) delete s.selectedWallpaperId;
  else s.selectedWallpaperId = id;
  await writeSettings(s);
  emitWallpaperChanged();
}

export async function getSelectedWallpaperId(): Promise<string | null> {
  const s = await readSettings();
  return s.selectedWallpaperId ?? null;
}

export async function getSelectedWallpaperCssValue(): Promise<string> {
  const selectedId = await getSelectedWallpaperId();

  // дефолт
  const fallback = `url("${builtinAssetUrl("bridgerton")}")`;
  if (!selectedId) return fallback;

  const all = await loadAllWallpapers();
  const item = all.find((x) => x.id === selectedId);
  if (!item) return fallback;

  if (item.kind === "builtin" && item.assetKey) {
    return `url("${builtinAssetUrl(item.assetKey)}")`;
  }

  if (item.kind === "user" && item.relPath) {
    const base = await appDataDir();
    const abs = await join(base, ROOT_DIR, item.relPath.replace(/\\/g, "/"));
    return `url("${convertFileSrc(abs)}?v=${Date.now()}")`;
  }

  return fallback;
}

export async function importWallpaperFromPc(): Promise<WallpaperItem | null> {
  await ensureWallpaperSystem();

  const selected = await open({
    multiple: false,
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
  });

  if (!selected || Array.isArray(selected)) return null;

  const fileName = await basename(selected);
  const ext = (fileName.split(".").pop() || "png").toLowerCase();
  const safeExt = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "png";

  const dir = await wallpapersDir();
  const outName = `${makeId()}.${safeExt}`;
  const outAbs = await join(dir, outName);

  // копирование bytes
  const bytes = await readFile(selected);
  await writeFile(outAbs, bytes);

  const relPath = `wallpapers/${outName}`;
  const item: WallpaperItem = {
    id: `user:${outName}`,
    kind: "user",
    title: fileName.replace(/\.[^/.]+$/, ""),
    relPath,
    createdAt: Date.now(),
  };

  const list = await loadUserWallpapers();
  list.unshift(item);
  await saveUserWallpapers(list);

  return item;
}

export async function deleteUserWallpaper(id: string) {
  const list = await loadUserWallpapers();
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) return;

  const item = list[idx];
  list.splice(idx, 1);
  await saveUserWallpapers(list);

  // удалим файл
  if (item.relPath) {
    const base = await appDataDir();
    const abs = await join(base, ROOT_DIR, item.relPath.replace(/\\/g, "/"));
    if (await exists(abs)) {
      try { await remove(abs); } catch {}
    }
  }

  // если он был выбран — переключить на дефолт
  const selected = await getSelectedWallpaperId();
  if (selected === id) await setSelectedWallpaper("builtin:bridgerton");
}

export const WALLPAPER_CHANGED_EVENT = "ficwriter:wallpaper-changed";

function emitWallpaperChanged() {
  window.dispatchEvent(new Event(WALLPAPER_CHANGED_EVENT));
}
