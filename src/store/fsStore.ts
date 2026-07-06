import { readTextFile, writeTextFile, mkdir, exists, remove, rename } from "@tauri-apps/plugin-fs";
import { join, appDataDir } from "@tauri-apps/api/path";

const ROOT_DIR = "ficwriter";

/** корень: .../ficwriter/projects */
async function projectsRootPath() {
  const base = await appDataDir();
  return await join(base, ROOT_DIR, "projects");
}

/** ПУТЬ к папке главы — без mkdir! */
async function getChapterDirPath(projectId: string, chapterId: string) {
  const root = await projectsRootPath();
  return await join(root, projectId, chapterId);
}

/** mkdir только там, где реально нужно писать файлы */
async function ensureChapterDir(projectId: string, chapterId: string) {
  const dir = await getChapterDirPath(projectId, chapterId);
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

/** Атомарная запись текста в файл (уникальный tmp -> rename) */
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

/* ================== TEXT ================== */

export async function loadChapterText(projectId: string, chapterId: string) {
  const dir = await getChapterDirPath(projectId, chapterId);
  const p = await join(dir, "text.txt");
  if (!(await exists(p))) return "";
  return await readTextFile(p);
}

export async function saveChapterText(projectId: string, chapterId: string, text: string) {
  const dir = await ensureChapterDir(projectId, chapterId);
  const p = await join(dir, "text.txt");
  await writeTextFileAtomic(p, text);
}

/* ================== TITLE ================== */

export async function loadChapterTitle(projectId: string, chapterId: string) {
  const dir = await getChapterDirPath(projectId, chapterId);
  const p = await join(dir, "title.txt");
  if (!(await exists(p))) return null;
  return await readTextFile(p);
}

export async function saveChapterTitle(projectId: string, chapterId: string, title: string) {
  const dir = await ensureChapterDir(projectId, chapterId);
  const p = await join(dir, "title.txt");
  await writeTextFileAtomic(p, title);
}

/* ================== NOTES ================== */

export type ChapterReference = {
  id: string;
  name: string;
  path: string;
};

export type ChapterPinnedPhoto = {
  id: string;
  name: string;
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ChapterNotes = { a: string; b: string; c: string; refs?: ChapterReference[] };

export async function loadChapterNotes(projectId: string, chapterId: string): Promise<ChapterNotes> {
  const dir = await getChapterDirPath(projectId, chapterId);
  const p = await join(dir, "notes.json");
  if (!(await exists(p))) return { a: "", b: "", c: "", refs: [] };
  try {
    const raw = await readTextFile(p);
    const data = JSON.parse(raw);
    return {
      a: typeof data?.a === "string" ? data.a : "",
      b: typeof data?.b === "string" ? data.b : "",
      c: typeof data?.c === "string" ? data.c : "",
      refs: Array.isArray(data?.refs)
        ? data.refs
            .filter((item: any) => item && typeof item.id === "string" && typeof item.path === "string")
            .map((item: any) => ({
              id: item.id,
              name: typeof item.name === "string" ? item.name : "Изображение",
              path: item.path,
            }))
        : [],
    };
  } catch {
    return { a: "", b: "", c: "", refs: [] };
  }
}

export async function loadChapterPinnedPhotos(
  projectId: string,
  chapterId: string
): Promise<ChapterPinnedPhoto[]> {
  const dir = await getChapterDirPath(projectId, chapterId);
  const p = await join(dir, "pinned-photos.json");
  if (!(await exists(p))) return [];
  try {
    const raw = await readTextFile(p);
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (item: any) =>
          item &&
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          typeof item.path === "string" &&
          Number.isFinite(item.x) &&
          Number.isFinite(item.y) &&
          Number.isFinite(item.width) &&
          Number.isFinite(item.height)
      )
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        path: item.path,
        x: Math.round(item.x),
        y: Math.round(item.y),
        width: Math.max(72, Math.round(item.width)),
        height: Math.max(72, Math.round(item.height)),
      }));
  } catch {
    return [];
  }
}

export async function saveChapterPinnedPhotos(
  projectId: string,
  chapterId: string,
  photos: ChapterPinnedPhoto[]
) {
  const dir = await ensureChapterDir(projectId, chapterId);
  const p = await join(dir, "pinned-photos.json");
  await writeTextFileAtomic(p, JSON.stringify(photos, null, 2));
}

export async function saveChapterNotes(projectId: string, chapterId: string, notes: ChapterNotes) {
  const dir = await ensureChapterDir(projectId, chapterId);
  const p = await join(dir, "notes.json");
  await writeTextFileAtomic(p, JSON.stringify(notes, null, 2));
}

/* ================== DELETE ================== */

/** Удаляем и новую схему, и старые хвосты (если они были) */
export async function deleteChapterFiles(projectId: string, chapterId: string) {
  const base = await appDataDir();

  // ✅ текущая схема:
  // .../ficwriter/projects/<projectId>/<chapterId>/
  const dirNew = await join(base, ROOT_DIR, "projects", projectId, chapterId);

  // ✅ возможные старые схемы (из твоих прошлых версий):
  // .../ficwriter/<projectId>/<chapterId>.txt
  const legacyFile1 = await join(base, ROOT_DIR, projectId, `${chapterId}.txt`);
  // .../ficwriter/projects/<projectId>/chapters/<chapterId>/
  const dirLegacy2 = await join(base, ROOT_DIR, "projects", projectId, "chapters", chapterId);

  // удаляем все варианты тихо, без падений
  const targets = [dirNew, legacyFile1, dirLegacy2];

  for (const t of targets) {
    try {
      if (await exists(t)) {
        await remove(t, { recursive: true });
      }
    } catch (e) {
      console.error("deleteChapterFiles failed for:", t, e);
    }
  }
}
