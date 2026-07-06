import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import { FontSize } from "../editor/FontSize";
import { confirm } from "../components/confirmService";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import mammoth from "mammoth/mammoth.browser";

import {
  createNote,
  deleteNote,
  loadNote,
  loadNotesIndexSafe,
  saveNote,
  type Note,
  type NoteIndexItem,
} from "../store/notesStore";

import "./editor.css";
import type { EditorView } from "prosemirror-view";

function stripHtml(html: string) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function countWords(text: string) {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const LAST_ACTIVE_KEY = "fw-notes:lastActiveId";
const SCROLL_KEY_PREFIX = "fw-notes:scroll:";
const MAX_CHARS = 10000;

const FONT_FAMILIES = [
  { label: "Inter", value: "Inter, system-ui, Arial" },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Courier New", value: '"Courier New", Courier, monospace' },
];

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px"];

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function textToHtml(text: string) {
  const safe = escapeHtml(text).replace(/\r\n/g, "\n");
  const lines = safe.split("\n");
  return `<p>${lines.join("<br />")}</p>`;
}

function fileBaseName(path: string) {
  const name = path.replace(/\\/g, "/").split("/").pop() ?? "";
  return name.replace(/\.[^.]+$/, "");
}

export default function NotebookScreen() {
  const nav = useNavigate();

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteIndexItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [uiFontFamily, setUiFontFamily] = useState(FONT_FAMILIES[0].value);
  const [uiFontSize, setUiFontSize] = useState("16px");
  const [charCount, setCharCount] = useState(0);
  const [overLimit, setOverLimit] = useState(false);

  const isHydratingRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosavePendingRef = useRef(false);
  const lastSavedRef = useRef<string | null>(null);
  const saveInFlightRef = useRef<Promise<void> | null>(null);
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const titleRef = useRef("");
  const editorScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deletingIdRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ underline: false }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: "",
    onUpdate: () => {
      if (isHydratingRef.current) return;
      if (saveState !== "saving") setSaveState("idle");
      const plain = stripHtml(editor?.getHTML() ?? "");
      setCharCount(plain.length);
      setOverLimit(plain.length > MAX_CHARS);
      if (plain.length <= MAX_CHARS) queueAutosave();
    },
    editorProps: {
      attributes: {
        class: "fw-editor notebook-editor",
        spellcheck: "false",
        autocorrect: "off",
        autocapitalize: "off",
      },
      handleDOMEvents: {
        keydown: (view: EditorView, event: KeyboardEvent) => {
          if (
            overLimit &&
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            event.preventDefault();
            event.stopPropagation();
            return true;
          }
          if (overLimit && event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            return true;
          }
          if (event.key === "Tab") {
            event.preventDefault();
            event.stopPropagation();
            view.dispatch(view.state.tr.insertText("\t"));
            return true;
          }
          return false;
        },
        paste: (_view: EditorView, event: ClipboardEvent) => {
          if (!event.clipboardData) return false;
          const text = event.clipboardData.getData("text/plain");
          if (!text) return false;
          const current = stripHtml(editor?.getHTML() ?? "");
          if (current.length + text.length > MAX_CHARS) {
            event.preventDefault();
            event.stopPropagation();
            setOverLimit(true);
            return true;
          }
          return false;
        },
      },
    },
  });

  function syncUiFromSelection() {
    if (!editor) return;
    const attrs = editor.getAttributes("textStyle") as any;
    const fam = (attrs?.fontFamily as string) || FONT_FAMILIES[0].value;
    const size = (attrs?.fontSize as string) || "16px";
    setUiFontFamily(fam);
    setUiFontSize(size);
  }

  useEffect(() => {
    if (!editor) return;
    const sync = () => syncUiFromSelection();
    editor.on("selectionUpdate", sync);
    editor.on("transaction", sync);
    syncUiFromSelection();
    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("transaction", sync);
    };
  }, [editor]);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    setError(null);

    (async () => {
      try {
        const list = await loadNotesIndexSafe();
        if (!alive) return;
        setNotes(list);
        const lastId = localStorage.getItem(LAST_ACTIVE_KEY);
        const exists = lastId ? list.some((n) => n.id === lastId) : false;
        setActiveId(exists ? lastId : list[0]?.id ?? null);
        setStatus("ready");
      } catch (e: any) {
      deletingIdRef.current = null;
        if (!alive) return;
        setError(e?.message ?? "Ошибка загрузки заметок");
        setStatus("error");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(Boolean(activeId));
  }, [editor, activeId]);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  useEffect(() => {
    if (activeId) localStorage.setItem(LAST_ACTIVE_KEY, activeId);
    else localStorage.removeItem(LAST_ACTIVE_KEY);
  }, [activeId]);

  const restoreScroll = useCallback((noteId: string) => {
    const el = editorScrollRef.current;
    if (!el) return;
    const raw = localStorage.getItem(`${SCROLL_KEY_PREFIX}${noteId}`);
    const v = raw ? Number(raw) : 0;
    if (Number.isFinite(v)) {
      el.scrollTop = v;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!editor) return;

    if (!activeId) {
      isHydratingRef.current = true;
      editor.commands.setContent("<p></p>");
      isHydratingRef.current = false;
      setActiveNote(null);
      setTitle("");
      lastSavedRef.current = null;
      setSaveState("idle");
      return;
    }

    (async () => {
      try {
        const note = await loadNote(activeId);
        if (cancelled) return;

        const next = note ?? {
          id: activeId,
          title: "Без названия",
          content: "<p></p>",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const content = next.content ?? "<p></p>";

        isHydratingRef.current = true;
        editor.commands.setContent(content);
        isHydratingRef.current = false;

        setActiveNote(next);
        setTitle(next.title ?? "");
        lastSavedRef.current = JSON.stringify({
          title: next.title ?? "",
          content,
        });
        const plain = stripHtml(content ?? "<p></p>");
        setCharCount(plain.length);
        setOverLimit(plain.length > MAX_CHARS);
        setSaveState("saved");
        requestAnimationFrame(() => restoreScroll(next.id));
      } catch (e) {
        if (!cancelled) {
          setSaveState("error");
          setSaveError(String((e as any)?.message ?? e));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editor, activeId, restoreScroll]);

  const onEditorScroll = useCallback(() => {
    if (!activeId) return;
    if (scrollSaveTimerRef.current) clearTimeout(scrollSaveTimerRef.current);
    scrollSaveTimerRef.current = setTimeout(() => {
      const el = editorScrollRef.current;
      if (!el) return;
      localStorage.setItem(`${SCROLL_KEY_PREFIX}${activeId}`, String(el.scrollTop));
    }, 200);
  }, [activeId]);

  function updateIndexFromNote(note: Note) {
    if (deletedIdsRef.current.has(note.id)) return;
    setNotes((prev) => {
      const liveTitle =
        note.id === activeId && titleRef.current.trim()
          ? titleRef.current
          : note.title;
      const entry: NoteIndexItem = {
        id: note.id,
        title: liveTitle,
        updatedAt: note.updatedAt,
        createdAt: note.createdAt,
      };
      const idx = prev.findIndex((n) => n.id === note.id);
      if (idx === -1) return [entry, ...prev];
      const next = [...prev];
      next[idx] = entry;
      return next;
    });
  }

  function ensureActiveNoteForSave() {
    if (activeNote && activeNote.id === activeId) return activeNote;
    if (!activeId) return null;
    if (deletedIdsRef.current.has(activeId)) return null;
    const now = Date.now();
    return {
      id: activeId,
      title: titleRef.current.trim() || "Без названия",
      content: editor?.getHTML() ?? "<p></p>",
      createdAt: now,
      updatedAt: now,
    } as Note;
  }

  async function runAutosave() {
    if (!editor) return;
    if (isDeleting) return;
    if (deletingIdRef.current) return;
    const base = ensureActiveNoteForSave();
    if (!base) return;
    if (deletingIdRef.current === base.id) return;
    if (deletedIdsRef.current.has(base.id)) return;
    if (isHydratingRef.current) return;

    if (saveState === "saving") {
      autosavePendingRef.current = true;
      return;
    }

    setSaveState("saving");
    setSaveError("");

    const savePromise = (async () => {
      try {
        const content = editor.getHTML();
        const noteTitle = titleRef.current.trim() || "Без названия";
        const payload = { ...base, title: noteTitle, content };
        const serialized = JSON.stringify({ title: noteTitle, content });

        if (serialized === lastSavedRef.current) {
          setSaveState("saved");
          return;
        }

        const saved = await saveNote(payload);
        if (deletedIdsRef.current.has(saved.id)) return;
        if (deletingIdRef.current === saved.id) return;
        setActiveNote(saved);
        updateIndexFromNote(saved);
        lastSavedRef.current = serialized;
        setSaveState("saved");
      } catch (e: any) {
        deletingIdRef.current = null;
        setIsDeleting(false);
        setSaveState("error");
        setSaveError(String(e?.message ?? e));
      } finally {
        if (autosavePendingRef.current) {
          autosavePendingRef.current = false;
          queueAutosave();
        }
      }
    })();

    saveInFlightRef.current = savePromise;
    try {
      await savePromise;
    } finally {
      if (saveInFlightRef.current === savePromise) saveInFlightRef.current = null;
    }
  }

  function queueAutosave() {
    if (!editor) return;
    if (isHydratingRef.current) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      void runAutosave();
    }, 700);
  }

  async function flushSave() {
    if (!editor) return;
    if (isDeleting) return;
    if (deletingIdRef.current) return;
    const base = ensureActiveNoteForSave();
    if (!base) return;
    if (deletingIdRef.current === base.id) return;
    if (deletedIdsRef.current.has(base.id)) return;
    if (isHydratingRef.current) return;

    const content = editor.getHTML();
    const noteTitle = titleRef.current.trim() || "Без названия";
    const serialized = JSON.stringify({ title: noteTitle, content });
    if (serialized === lastSavedRef.current) return;

    setSaveState("saving");
    setSaveError("");

    const savePromise = (async () => {
      try {
        const saved = await saveNote({ ...base, title: noteTitle, content });
        if (deletedIdsRef.current.has(saved.id)) return;
        if (deletingIdRef.current === saved.id) return;
        setActiveNote(saved);
        updateIndexFromNote(saved);
        lastSavedRef.current = serialized;
        setSaveState("saved");
      } catch (e: any) {
        deletingIdRef.current = null;
        setIsDeleting(false);
        setSaveState("error");
        setSaveError(String(e?.message ?? e));
      }
    })();

    saveInFlightRef.current = savePromise;
    try {
      await savePromise;
    } finally {
      if (saveInFlightRef.current === savePromise) saveInFlightRef.current = null;
    }
  }

  async function forceSave() {
    if (!editor) return;
    if (isDeleting) return;
    if (deletingIdRef.current) return;
    const base = ensureActiveNoteForSave();
    if (!base) return;
    if (deletingIdRef.current === base.id) return;
    if (deletedIdsRef.current.has(base.id)) return;

    const content = editor.getHTML();
    const noteTitle = titleRef.current.trim() || "Без названия";
    const serialized = JSON.stringify({ title: noteTitle, content });

    setSaveState("saving");
    setSaveError("");

    const savePromise = (async () => {
      try {
        const saved = await saveNote({ ...base, title: noteTitle, content });
        if (deletedIdsRef.current.has(saved.id)) return;
        if (deletingIdRef.current === saved.id) return;
        setActiveNote(saved);
        updateIndexFromNote(saved);
        lastSavedRef.current = serialized;
        setSaveState("saved");
      } catch (e: any) {
        deletingIdRef.current = null;
        setIsDeleting(false);
        setSaveState("error");
        setSaveError(String(e?.message ?? e));
      }
    })();

    saveInFlightRef.current = savePromise;
    try {
      await savePromise;
    } finally {
      if (saveInFlightRef.current === savePromise) saveInFlightRef.current = null;
    }
  }

  async function selectNote(noteId: string) {
    if (noteId === activeId) return;
    if (isDeleting) return;
    await forceSave();
    setActiveId(noteId);
  }

  async function onCreateNote() {
    if (isDeleting) return;
    await forceSave();
    const note = await createNote();
    updateIndexFromNote(note);
    setActiveNote(note);
    setActiveId(note.id);
  }

  async function onSaveClick() {
    if (isDeleting) return;
    await forceSave();
  }

  async function onDeleteActive() {
    if (!activeId) return;
    if (isDeleting) return;
    const ok = await confirm("\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u044d\u0442\u0443 \u0437\u0430\u043f\u0438\u0441\u044c?", {
      title: "\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435",
      kind: "warning",
      okLabel: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c",
      cancelLabel: "\u041e\u0442\u043c\u0435\u043d\u0430",
    });
    if (!ok) return;

    const deletingId = activeId;
    deletingIdRef.current = deletingId;
    deletedIdsRef.current.add(deletingId);
    setIsDeleting(true);
    autosavePendingRef.current = false;
    lastSavedRef.current = null;
    setNotes((prev) => prev.filter((n) => n.id !== deletingId));
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (scrollSaveTimerRef.current) {
      clearTimeout(scrollSaveTimerRef.current);
      scrollSaveTimerRef.current = null;
    }

    try {
      localStorage.removeItem(`${SCROLL_KEY_PREFIX}${deletingId}`);
      if (localStorage.getItem(LAST_ACTIVE_KEY) === deletingId) {
        localStorage.removeItem(LAST_ACTIVE_KEY);
      }
      if (saveInFlightRef.current) {
        try {
          await saveInFlightRef.current;
        } catch {
          // ignore in-flight save errors before delete
        }
      }

      await deleteNote(deletingId);
      setNotes((prev) => prev.filter((n) => n.id !== deletingId));
      const refreshed = await loadNotesIndexSafe();
      const filtered = refreshed.filter((n) => n.id !== deletingId);
      setNotes(filtered);
      const nextActive = filtered[0]?.id ?? null;
      setActiveId(nextActive);
      deletingIdRef.current = null;
      setIsDeleting(false);
      if (!nextActive) {
        setActiveNote(null);
        setTitle("");
        lastSavedRef.current = null;
        isHydratingRef.current = true;
        editor?.commands.setContent("<p></p>");
        isHydratingRef.current = false;
        setSaveState("idle");
      }
    } catch (e: any) {
      deletingIdRef.current = null;
      setIsDeleting(false);
      setSaveState("error");
      setSaveError(String(e?.message ?? e));
    }
  }

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const currentHtml = editor?.getHTML() ?? "";
      const dirty =
        Boolean(activeId) &&
        JSON.stringify({
          title: titleRef.current.trim() || "Без названия",
          content: currentHtml,
        }) !== lastSavedRef.current;

      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
      void flushSave();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      if (scrollSaveTimerRef.current) {
        clearTimeout(scrollSaveTimerRef.current);
        scrollSaveTimerRef.current = null;
      }
      void flushSave();
    };
  }, [activeNote, title, editor, activeId]);

  async function onImport() {
    if (!editor) return;
    const selected = await open({
      multiple: false,
      filters: [
        { name: "Документы", extensions: ["txt", "docx", "doc", "odt", "rtf"] },
        { name: "Все файлы", extensions: ["*"] },
      ],
    });

    if (!selected || Array.isArray(selected)) return;

    try {
      const bytes = await readFile(selected);
      const lower = selected.toLowerCase();
      const isDocx = lower.endsWith(".docx");
      const isTxt = lower.endsWith(".txt");
      if (!isDocx && !isTxt) {
        throw new Error(
          "Поддерживаются только .docx и .txt. Сохраните файл как .docx или .txt."
        );
      }
      let html = "";
      let plain = "";

      if (isDocx) {
        const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        const res = await mammoth.convertToHtml({ arrayBuffer });
        html = res.value ?? "<p></p>";
        plain = stripHtml(html);
        if (plain.length > MAX_CHARS) {
          plain = plain.slice(0, MAX_CHARS);
          html = textToHtml(plain);
        }
      } else {
        let text = "";
        try {
          text = new TextDecoder("utf-8").decode(bytes);
        } catch {
          text = new TextDecoder("windows-1251").decode(bytes);
        }
        plain = text.slice(0, MAX_CHARS);
        html = textToHtml(plain);
      }

      isHydratingRef.current = true;
      editor.commands.setContent(html);
      isHydratingRef.current = false;

      const nextTitle = fileBaseName(selected) || "Без названия";
      setTitle(nextTitle);
      if (activeId) {
        setNotes((prev) =>
          prev.map((n) => (n.id === activeId ? { ...n, title: nextTitle } : n))
        );
      }
      setCharCount(plain.length);
      setOverLimit(plain.length >= MAX_CHARS);
      setSaveState("idle");
      lastSavedRef.current = null;
      queueAutosave();
      await new Promise((r) => setTimeout(r, 0));
      await forceSave();
    } catch (e: any) {
      deletingIdRef.current = null;
      setIsDeleting(false);
      setSaveState("error");
      setSaveError(String(e?.message ?? e));
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => (n.title || "").toLowerCase().includes(q));
  }, [notes, search]);

  const html = editor?.getHTML() ?? "";
  const words = countWords(stripHtml(html));
  const hasUnsavedChanges =
    Boolean(activeId) &&
    JSON.stringify({
      title: title.trim() || "Без названия",
      content: html,
    }) !== lastSavedRef.current;

  async function handleBackToLibrary() {
    if (hasUnsavedChanges) {
      const ok = await confirm("Изменения в блокноте еще не сохранены. Сохранить их и закрыть блокнот?", {
        title: "Несохраненные изменения",
        okLabel: "Сохранить и выйти",
        cancelLabel: "Остаться",
        kind: "warning",
      });
      if (!ok) return;
      await forceSave();
    }

    nav("/");
  }

  return (
    <div className="notebook-root">
      <aside className="notebook-sidebar">
        <button className="notebook-new-btn" onClick={onCreateNote}>
          + Создать новую запись
        </button>

        <div className="notebook-search">
          <input
            className="notebook-search-input"
            placeholder="Найти..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="notebook-list">
          {status === "loading" && <div className="notebook-empty">Загружаю…</div>}
          {status === "error" && (
            <div className="notebook-empty notebook-error">
              {error ?? "Ошибка"}
            </div>
          )}
          {status === "ready" && filtered.length === 0 && (
            <div className="notebook-empty">Нет сохраненных заметок.</div>
          )}
          {filtered.map((n) => (
            <button
              key={n.id}
              className={`notebook-item ${n.id === activeId ? "is-active" : ""}`}
              onClick={() => void selectNote(n.id)}
            >
              <div className="notebook-item-title">{n.title || "Без названия"}</div>
              <div className="notebook-item-meta">{formatDate(n.updatedAt)}</div>
            </button>
          ))}
        </div>
      </aside>

      <section className="notebook-main">
        <div className="notebook-menubar">
          <div className="notebook-menubar-left">
            <button className="notebook-back" onClick={() => void handleBackToLibrary()}>← Библиотека</button>
          </div>

          <div className="notebook-menubar-right">
            <button className="notebook-import" onClick={() => void onImport()} disabled={!activeId}>
              Импорт
            </button>
            <button
              className={`notebook-save${saveState === "saving" ? " is-saving" : ""}${
                saveState === "saved" ? " is-saved" : ""
              }`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); void onSaveClick(); }}
              disabled={!activeId}
            >
              {saveState === "saving"
                ? "Сохраняю…"
                : saveState === "saved"
                ? "Сохранено"
                : "Сохранить"}
            </button>
            <button
              className="notebook-trash"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); void onDeleteActive(); }}
              disabled={!activeId}
              title="Удалить"
            >
              🗑
            </button>
          </div>
        </div>

        {activeId ? (
          <>
            <input
              className="notebook-title-input"
              placeholder="Введите название"
              value={title}
              onChange={(e) => {
                const nextTitle = e.target.value;
                setTitle(nextTitle);
                if (activeId) {
                  setNotes((prev) =>
                    prev.map((n) => (n.id === activeId ? { ...n, title: nextTitle } : n))
                  );
                }
                queueAutosave();
              }}
            />

            <div className="notebook-toolbar">
              <button className="tool-btn" onClick={() => editor?.chain().focus().toggleBold().run()}>
                B
              </button>
              <button className="tool-btn" onClick={() => editor?.chain().focus().toggleItalic().run()}>
                I
              </button>
              <button className="tool-btn" onClick={() => editor?.chain().focus().toggleUnderline().run()}>
                U
              </button>

              <div className="tool-sep" />

              <button className="tool-btn" onClick={() => editor?.chain().focus().setTextAlign("left").run()}>
                ←
              </button>
              <button className="tool-btn" onClick={() => editor?.chain().focus().setTextAlign("center").run()}>
                ≡
              </button>
              <button className="tool-btn" onClick={() => editor?.chain().focus().setTextAlign("right").run()}>
                →
              </button>

              <div className="tool-sep" />

              <select
                className="tool-select"
                value={uiFontFamily}
                onChange={(e) => {
                  const v = e.target.value;
                  setUiFontFamily(v);
                  editor?.chain().focus().setFontFamily(v).run();
                }}
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.label} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>

              <select
                className="tool-select"
                value={uiFontSize}
                onChange={(e) => {
                  const v = e.target.value;
                  setUiFontSize(v);
                  editor?.chain().focus().setFontSize(v).run();
                }}
              >
                {FONT_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="notebook-editor-wrap">
              <div
                className="notebook-editor-surface"
                ref={editorScrollRef}
                onScroll={onEditorScroll}
              >
                <EditorContent editor={editor} />
              </div>
            </div>

            <div className="notebook-footer">
              Слов: {words} · Символы: {charCount}/{MAX_CHARS}
              {overLimit ? <span className="notebook-save-error"> · Лимит достигнут</span> : null}
              {saveState === "error" ? (
                <span className="notebook-save-error"> · {saveError || "Ошибка сохранения"}</span>
              ) : null}
            </div>
          </>
        ) : (
          <div className="notebook-blank">
            <div className="notebook-blank-title">Блокнот</div>
            <div className="notebook-blank-sub">
              Создай первую запись, чтобы начать.
            </div>
            <button className="notebook-new-btn" onClick={onCreateNote}>
              + Создать новую запись
            </button>
          </div>
        )}
      </section>
    </div>
  );
}



