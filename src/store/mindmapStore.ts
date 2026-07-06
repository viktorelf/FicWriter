import type { TLStoreSnapshot } from "tldraw";

type MindMapMeta = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

const INDEX_KEY = "ficwriter:mindmap:index";
const SNAPSHOT_PREFIX = "ficwriter:mindmap:snapshot:";

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readIndex(): MindMapMeta[] {
  const raw = localStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  const parsed = safeJsonParse<MindMapMeta[]>(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function writeIndex(list: MindMapMeta[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function listMindMaps(): Promise<MindMapMeta[]> {
  return readIndex();
}

export async function createMindMap(title: string): Promise<MindMapMeta> {
  const now = Date.now();
  const entry: MindMapMeta = {
    id: createId(),
    title: title.trim() || "Майндмэп",
    createdAt: now,
    updatedAt: now,
  };
  const list = readIndex();
  list.unshift(entry);
  writeIndex(list);
  return entry;
}

export async function saveMindMapSnapshot(id: string, snapshot: TLStoreSnapshot) {
  localStorage.setItem(`${SNAPSHOT_PREFIX}${id}`, JSON.stringify(snapshot));

  const list = readIndex();
  const next = list.map((item) =>
    item.id === id ? { ...item, updatedAt: Date.now() } : item
  );
  writeIndex(next);
}

export async function loadMindMapSnapshot(id: string): Promise<TLStoreSnapshot | null> {
  const raw = localStorage.getItem(`${SNAPSHOT_PREFIX}${id}`);
  if (!raw) return null;
  return safeJsonParse<TLStoreSnapshot>(raw);
}
