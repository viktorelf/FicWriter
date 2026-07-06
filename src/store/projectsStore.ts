// src/store/projectsStore.ts
import { appDataDir, join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import {
  exists,
  mkdir,
  readDir,
  readTextFile,
  readFile,
  writeTextFile,
  writeFile,
  remove,
  rename,
} from "@tauri-apps/plugin-fs";

import {
  saveChapterNotes,
  saveChapterText,
  saveChapterTitle,
  type ChapterNotes,
  deleteChapterFiles,
} from "./fsStore";

/* ================= TYPES ================= */

export type ProjectType = "original" | "fanfic";

export type Rating = "G" | "PG-13" | "R" | "NC-17" | "NC-21";

export type Direction = "gen" | "het" | "slash" | "femslash" | "other";

export type CharacterField = {
  id: string;
  label: string;
};

export type CharacterCard = {
  id: string;
  name: string;
  avatar?: string;
  fields: Record<string, string>;
};

export type ChapterMeta = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type Project = {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt?: number;
  pinnedAt?: number | null;
  chapters: ChapterMeta[];

  // относительный путь внутри проекта: "assets/cover.png"
  cover?: string;

  // настройки фанфика
  workType?: ProjectType;
  fandom?: string;
  pairing?: string;
  rating?: Rating;
  direction?: Direction;
  tags?: string[];
  shortDescription?: string;
  notes?: string;
  characterFields?: CharacterField[];
  characters?: CharacterCard[];
};

const ROOT_DIR = "ficwriter";

/* ================= HELPERS ================= */

function id(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function ensureDir(path: string) {
  if (!(await exists(path))) await mkdir(path, { recursive: true });
}

async function ensureRoot(): Promise<string> {
  const base = await appDataDir();
  const root = await join(base, ROOT_DIR);
  await ensureDir(root);

  const projectsDir = await join(root, "projects");
  await ensureDir(projectsDir);

  return root;
}

async function projectsRoot(): Promise<string> {
  const root = await ensureRoot();
  return await join(root, "projects");
}

async function indexPath(): Promise<string> {
  const pr = await projectsRoot();
  return await join(pr, "index.json");
}

async function projectDir(projectId: string): Promise<string> {
  const pr = await projectsRoot();
  const dir = await join(pr, projectId);
  await ensureDir(dir);
  return dir;
}

async function projectJsonPath(projectId: string): Promise<string> {
  const dir = await projectDir(projectId);
  return await join(dir, "project.json");
}

/**
 * Атомарная запись текста в файл:
 * пишем в tmp -> удаляем старый -> rename(tmp -> final)
 * Это защищает от "пустых файлов" при внезапном закрытии приложения.
 */
async function writeTextFileAtomic(finalPath: string, content: string) {
  const tmpPath = `${finalPath}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  await writeTextFile(tmpPath, content);

  try {
    await rename(tmpPath, finalPath);
    return;
  } catch {
    // возможно, финальный файл существует — пробуем заменить
  }

  if (await exists(finalPath)) {
    try {
      await remove(finalPath);
    } catch {
      // ignore
    }
  }

  try {
    await rename(tmpPath, finalPath);
    return;
  } catch {
    // fallback: прямое сохранение, если rename не удаётся
  }

  try {
    await writeTextFile(finalPath, content);
  } finally {
    if (await exists(tmpPath)) {
      try {
        await remove(tmpPath);
      } catch {
        // ignore
      }
    }
  }
}

/* ================= INDEX ================= */

/**
 * raw-индекс (кэш). Может быть пустой/битый.
 * Поэтому библиотека НЕ должна ему слепо доверять.
 */
export async function loadProjectsIndex(): Promise<Project[]> {
  const p = await indexPath();
  if (!(await exists(p))) return [];

  const raw = await readTextFile(p);
  const data = safeJsonParse<unknown>(raw);
  return Array.isArray(data) ? (data as Project[]) : [];
}

async function saveProjectsIndex(projects: Project[]) {
  const p = await indexPath();
  const payload = JSON.stringify(projects, null, 2);
  await writeTextFileAtomic(p, payload);
}

/**
 * Читает проекты из папок: projects/<id>/project.json
 * Это "источник правды".
 */
async function loadProjectsFromDisk(): Promise<Project[]> {
  const pr = await projectsRoot();
  if (!(await exists(pr))) return [];

  const entries = await readDir(pr);
  const out: Project[] = [];

  for (const e of entries) {
    if (!e.isDirectory) continue;

    const pid = e.name;
    if (!pid) continue;

    // пропускаем служебные папки, если вдруг появятся
    if (pid === "assets") continue;

    const pj = await join(pr, pid, "project.json");
    if (!(await exists(pj))) continue;

    const raw = await readTextFile(pj);
    const p = safeJsonParse<Project>(raw);
    if (p?.id) out.push(p);
  }

  out.sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
  return out;
}

/**
 * Безопасная загрузка для библиотеки:
 * - если index пустой/битый -> восстановим с диска и пересохраним index
 * - если index есть -> проверим, что project.json реально существует
 *   (если нет — тоже пересоберём с диска)
 */
export async function loadProjectsSafe(): Promise<Project[]> {
  const index = await loadProjectsIndex();

  if (!index.length) {
    const disk = await loadProjectsFromDisk();
    if (disk.length) await saveProjectsIndex(disk);
    return disk;
  }

  // проверяем существование файлов
  const pr = await projectsRoot();
  let okCount = 0;

  for (const p of index) {
    const pj = await join(pr, p.id, "project.json");
    if (await exists(pj)) okCount++;
  }

  // если индекс стал "грязным" — пересобираем
  if (okCount !== index.length) {
    const disk = await loadProjectsFromDisk();
    await saveProjectsIndex(disk);
    return disk;
  }

  return index;
}

/* ================= PROJECT CRUD ================= */

export async function loadProject(projectId: string): Promise<Project | null> {
  const p = await projectJsonPath(projectId);
  if (!(await exists(p))) return null;

  const raw = await readTextFile(p);
  return safeJsonParse<Project>(raw);
}

export async function saveProject(project: Project) {
  const p = await projectJsonPath(project.id);
  const payload = JSON.stringify(project, null, 2);

  // 1) сначала сохраняем project.json атомарно
  await writeTextFileAtomic(p, payload);

  // 2) потом обновляем index (как кэш)
  const index = await loadProjectsIndex();
  const i = index.findIndex((x) => x.id === project.id);
  if (i >= 0) index[i] = project;
  else index.unshift(project);

  await saveProjectsIndex(index);
}

export async function createProject(input: { title: string; description?: string }): Promise<Project> {
  const now = Date.now();

  const project: Project = {
    id: id(),
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    chapters: [],
  };

  await saveProject(project);
  return project;
}

export async function updateProject(projectId: string, patch: Partial<Project>) {
  const project = await loadProject(projectId);
  if (!project) throw new Error("Проект не найден");

  const updated: Project = {
    ...project,
    ...patch,
    updatedAt: Date.now(),
  };

  await saveProject(updated);
  return updated;
}

/**
 * Для метаданных (настройки фанфика).
 * Делает то же самое, но удобно вызывать пачкой.
 */
export async function updateProjectMeta(projectId: string, patch: Partial<Project>) {
  const project = await loadProject(projectId);
  if (!project) throw new Error("Проект не найден");

  Object.assign(project, patch);
  project.updatedAt = Date.now();

  await saveProject(project);
  return project;
}

export async function setProjectPinned(projectId: string, pinned: boolean) {
  const project = await loadProject(projectId);
  if (!project) throw new Error("Проект не найден");

  project.pinnedAt = pinned ? Date.now() : null;
  project.updatedAt = Date.now();

  await saveProject(project);
  return project;
}

export async function deleteProject(projectId: string) {
  const pr = await projectsRoot();
  const dir = await join(pr, projectId);

  // 1) удаляем папку проекта целиком (там же главы/обложка/notes)
  if (await exists(dir)) {
    await remove(dir, { recursive: true });
  }

  // 2) чистим index.json
  const index = await loadProjectsIndex();
  const next = index.filter((p) => p.id !== projectId);
  await saveProjectsIndex(next);
}


/* ================= COVER ================= */

export async function importProjectCover(projectId: string, sourcePath: string) {
  const project = await loadProject(projectId);
  if (!project) throw new Error("Проект не найден");

  // Rust копирует файл в appData/.../projects/<id>/assets/cover.ext
  const prevCover = project.cover;
  const rel = await invoke<string>("import_project_cover", {
    projectId,
    sourcePath,
  });

  project.cover = rel; // например "assets/cover.png"
  project.updatedAt = Date.now();
  await saveProject(project);

  if (prevCover && prevCover !== rel) {
    await deleteProjectCoverFile(projectId, prevCover);
  }

  return project.cover;
}

export async function clearProjectCover(projectId: string) {
  const project = await loadProject(projectId);
  if (!project) throw new Error("Проект не найден");

  const prevCover = project.cover;
  delete project.cover;
  project.updatedAt = Date.now();
  await saveProject(project);

  if (prevCover) {
    await deleteProjectCoverFile(projectId, prevCover);
  }
}

/* ================= CHARACTERS ================= */

export async function importCharacterAvatar(
  projectId: string,
  characterId: string,
  sourcePath: string
): Promise<string> {
  const project = await loadProject(projectId);
  if (!project) throw new Error("Проект не найден");

  const base = await appDataDir();
  const targetDir = await join(base, ROOT_DIR, "projects", projectId, "assets", "characters");
  await ensureDir(targetDir);

  const parts = sourcePath.split(".");
  const extRaw = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "png";
  const ext = extRaw.replace(/[^a-z0-9]/g, "") || "png";
  const filename = `${characterId}-${Date.now()}.${ext}`;
  const abs = await join(targetDir, filename);

  const bytes = await readFile(sourcePath);
  await writeFile(abs, bytes);

  return `assets/characters/${filename}`;
}

export async function deleteCharacterAvatar(projectId: string, relPath?: string) {
  if (!relPath) return;
  if (!relPath.startsWith("assets/characters/")) return;

  try {
    const base = await appDataDir();
    const abs = await join(base, ROOT_DIR, "projects", projectId, relPath.replace(/\\/g, "/"));
    if (await exists(abs)) {
      await remove(abs);
    }
  } catch {
    // ignore
  }
}

export async function importReferenceAsset(
  projectId: string,
  referenceId: string,
  sourcePath: string
): Promise<string> {
  const project = await loadProject(projectId);
  if (!project) throw new Error("РџСЂРѕРµРєС‚ РЅРµ РЅР°Р№РґРµРЅ");

  const base = await appDataDir();
  const targetDir = await join(base, ROOT_DIR, "projects", projectId, "assets", "references");
  await ensureDir(targetDir);

  const parts = sourcePath.split(".");
  const extRaw = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "png";
  const ext = extRaw.replace(/[^a-z0-9]/g, "") || "png";
  const filename = `${referenceId}-${Date.now()}.${ext}`;
  const abs = await join(targetDir, filename);

  const bytes = await readFile(sourcePath);
  await writeFile(abs, bytes);

  return `assets/references/${filename}`;
}

export async function deleteReferenceAsset(projectId: string, relPath?: string) {
  if (!relPath) return;
  if (!relPath.startsWith("assets/references/")) return;

  try {
    const base = await appDataDir();
    const abs = await join(base, ROOT_DIR, "projects", projectId, relPath.replace(/\\/g, "/"));
    if (await exists(abs)) {
      await remove(abs);
    }
  } catch {
    // ignore
  }
}

async function deleteProjectCoverFile(projectId: string, relPath?: string) {
  if (!relPath) return;
  if (!relPath.startsWith("assets/")) return;
  if (relPath.startsWith("assets/characters/")) return;

  try {
    const base = await appDataDir();
    const abs = await join(base, ROOT_DIR, "projects", projectId, relPath.replace(/\\/g, "/"));
    if (await exists(abs)) {
      await remove(abs);
    }
  } catch {
    // ignore
  }
}

export async function cleanupProjectAssets(projectId: string): Promise<{ removed: number }> {
  const project = await loadProject(projectId);
  if (!project) return { removed: 0 };

  const base = await appDataDir();
  const assetsDir = await join(base, ROOT_DIR, "projects", projectId, "assets");
  if (!(await exists(assetsDir))) return { removed: 0 };

  const used = new Set<string>();
  const norm = (p: string) => p.replace(/\\/g, "/");

  if (project.cover) used.add(norm(project.cover));
  for (const c of project.characters ?? []) {
    if (c.avatar) used.add(norm(c.avatar));
  }
  const references = (project as any).references as Array<{ path?: string }> | undefined;
  for (const ref of references ?? []) {
    if (ref.path) used.add(norm(ref.path));
  }

  let removed = 0;

  const assetsEntries = await readDir(assetsDir);
  for (const e of assetsEntries) {
    if (e.isFile && e.name) {
      const rel = `assets/${e.name}`;
      if (!used.has(rel)) {
        try {
          await remove(await join(assetsDir, e.name));
          removed += 1;
        } catch {
          // ignore
        }
      }
    }
  }

  const charactersDir = await join(assetsDir, "characters");
  if (await exists(charactersDir)) {
    const charEntries = await readDir(charactersDir);
    for (const e of charEntries) {
      if (e.isFile && e.name) {
        const rel = `assets/characters/${e.name}`;
        if (!used.has(rel)) {
          try {
            await remove(await join(charactersDir, e.name));
            removed += 1;
          } catch {
            // ignore
          }
        }
      }
    }
  }

  return { removed };
}

export async function cleanupAllProjectsAssets(): Promise<{ removed: number }> {
  const projects = await loadProjectsSafe();
  let removed = 0;
  for (const p of projects) {
    const res = await cleanupProjectAssets(p.id);
    removed += res.removed;
  }
  return { removed };
}

/* ================= CHAPTERS ================= */

export async function createChapter(projectId: string, title?: string): Promise<ChapterMeta> {
  const project = await loadProject(projectId);
  if (!project) throw new Error("Проект не найден");

  const chapterId = id();
  const now = Date.now();
  const chapterTitle = title?.trim() || `Глава ${project.chapters.length + 1}`;

  const meta: ChapterMeta = {
    id: chapterId,
    title: chapterTitle,
    createdAt: now,
    updatedAt: now,
  };

  project.chapters = [...(project.chapters ?? []), meta];
  project.updatedAt = now;
  await saveProject(project);

  await saveChapterTitle(projectId, chapterId, chapterTitle);
  await saveChapterText(projectId, chapterId, "<p></p>");
  const emptyNotes: ChapterNotes = { a: "", b: "", c: "" };
  await saveChapterNotes(projectId, chapterId, emptyNotes);

  return meta;
}

export async function deleteChapter(projectId: string, chapterId: string) {
  const project = await loadProject(projectId);
  if (!project) throw new Error("Проект не найден");

  await deleteChapterFiles(projectId, chapterId);

  project.chapters = (project.chapters ?? []).filter((c) => c.id !== chapterId);
  project.updatedAt = Date.now();

  await saveProject(project);
}

export async function updateChapterTitle(projectId: string, chapterId: string, title: string) {
  const project = await loadProject(projectId);
  if (!project) throw new Error("Проект не найден");

  project.chapters = (project.chapters ?? []).map((ch) =>
    ch.id === chapterId ? { ...ch, title, updatedAt: Date.now() } : ch
  );
  project.updatedAt = Date.now();
  await saveProject(project);
}
