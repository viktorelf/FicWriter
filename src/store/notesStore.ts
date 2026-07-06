import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, remove, rename, writeTextFile } from "@tauri-apps/plugin-fs";

const ROOT_DIR = "ficwriter";

export type NoteIndexItem = {
  id: string;
  title: string;
  updatedAt: number;
  createdAt: number;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  createdAt: number;
};

function id(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function ensureNotesRoot(): Promise<string> {
  const base = await appDataDir();
  const dir = await join(base, ROOT_DIR, "notes");
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

async function notesIndexPath(): Promise<string> {
  const root = await ensureNotesRoot();
  return await join(root, "index.json");
}

async function notePath(noteId: string): Promise<string> {
  const root = await ensureNotesRoot();
  return await join(root, `${noteId}.json`);
}

async function writeTextFileAtomic(finalPath: string, content: string) {
  const tmpPath = `${finalPath}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  await writeTextFile(tmpPath, content);

  try {
    await rename(tmpPath, finalPath);
    return;
  } catch {
    // fall through to replacement
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
    // fallback: direct write
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

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function saveNotesIndex(items: NoteIndexItem[]) {
  const p = await notesIndexPath();
  const payload = JSON.stringify(items, null, 2);
  await writeTextFileAtomic(p, payload);
}

export async function loadNotesIndex(): Promise<NoteIndexItem[]> {
  const p = await notesIndexPath();
  if (!(await exists(p))) return [];

  const raw = await readTextFile(p);
  const data = safeJsonParse<unknown>(raw);
  if (!Array.isArray(data)) return [];

  return (data as NoteIndexItem[]).filter((x) => Boolean(x?.id));
}

export async function loadNotesIndexSafe(): Promise<NoteIndexItem[]> {
  const index = await loadNotesIndex();
  if (!index.length) return [];

  const next: NoteIndexItem[] = [];
  for (const item of index) {
    const p = await notePath(item.id);
    if (await exists(p)) next.push(item);
  }

  if (next.length !== index.length) {
    await saveNotesIndex(next);
  }

  next.sort((a, b) => b.updatedAt - a.updatedAt);
  return next;
}

export async function loadNote(noteId: string): Promise<Note | null> {
  const p = await notePath(noteId);
  if (!(await exists(p))) return null;

  const raw = await readTextFile(p);
  const data = safeJsonParse<Note>(raw);
  if (!data?.id) return null;

  return {
    id: String(data.id),
    title: typeof data.title === "string" ? data.title : "",
    content: typeof data.content === "string" ? data.content : "",
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
    createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
  };
}

export async function createNote(): Promise<Note> {
  const now = Date.now();
  const note: Note = {
    id: id(),
    title: "Новая запись",
    content: "<p></p>",
    createdAt: now,
    updatedAt: now,
  };

  await saveNote(note);
  return note;
}

export async function saveNote(note: Note): Promise<Note> {
  const now = Date.now();
  const title = note.title?.trim() || "Без названия";
  const next: Note = {
    ...note,
    title,
    content: note.content ?? "",
    createdAt: note.createdAt ?? now,
    updatedAt: now,
  };

  const p = await notePath(next.id);
  await writeTextFileAtomic(p, JSON.stringify(next, null, 2));

  const index = await loadNotesIndex();
  const idx = index.findIndex((x) => x.id === next.id);
  const entry: NoteIndexItem = {
    id: next.id,
    title: next.title,
    updatedAt: next.updatedAt,
    createdAt: next.createdAt,
  };

  if (idx >= 0) index[idx] = entry;
  else index.unshift(entry);

  await saveNotesIndex(index);
  return next;
}

export async function deleteNote(noteId: string) {
  const p = await notePath(noteId);
  if (await exists(p)) {
    try {
      await remove(p);
    } catch {
      // ignore file removal errors, still update index
    }
  }

  const index = await loadNotesIndex();
  const next = index.filter((x) => x.id !== noteId);
  await saveNotesIndex(next);
}

