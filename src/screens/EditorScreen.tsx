import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  loadChapterText,
  saveChapterText,
  loadChapterTitle,
  saveChapterTitle,
  loadChapterNotes,
  saveChapterNotes,
  loadChapterPinnedPhotos,
  saveChapterPinnedPhotos,
  type ChapterNotes,
  type ChapterPinnedPhoto,
} from "../store/fsStore";
import {
  loadProject,
  importCharacterAvatar,
  deleteCharacterAvatar,
  importReferenceAsset,
  deleteReferenceAsset,
  updateProjectMeta,
  updateChapterTitle,
  type CharacterCard,
  type CharacterField,
} from "../store/projectsStore";
import { open } from "@tauri-apps/plugin-dialog";
import { appDataDir, join } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm } from "../components/confirmService";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import { FontSize } from "../editor/FontSize";
import "./editor.css";
import { Fragment, Slice } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";

function countWords(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function insertPlainText(view: EditorView, rawText: string) {
  const normalized = rawText.replace(/\r\n?/g, "\n");
  const { schema } = view.state;
  const paragraphs = normalized.split(/\n{2,}/);
  const paragraphNodes = paragraphs.map((paragraph) => {
    const lines = paragraph.split("\n");
    const content: any[] = [];

    lines.forEach((line, index) => {
      if (index > 0 && schema.nodes.hardBreak) {
        content.push(schema.nodes.hardBreak.create());
      }
      if (line.length > 0) {
        content.push(schema.text(line));
      }
    });

    return schema.nodes.paragraph.create(null, content.length ? content : undefined);
  });

  const fragment = Fragment.fromArray(paragraphNodes);
  const slice = new Slice(fragment, 0, 0);
  view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
}

const FONT_FAMILIES = [
  { label: "Inter (по умолчанию)", value: "Inter, system-ui, Arial" },
  { label: "Nunito", value: '"Nunito", system-ui, "Segoe UI", sans-serif' },
  { label: "Segoe UI", value: '"Segoe UI", Tahoma, sans-serif' },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Verdana, sans-serif" },
  { label: "Trebuchet MS", value: '"Trebuchet MS", Verdana, sans-serif' },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Cambria", value: "Cambria, Georgia, serif" },
  { label: "PT Serif", value: '"PT Serif", Georgia, serif' },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Courier New", value: '"Courier New", Courier, monospace' },
];

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px"];

const DEFAULT_CHARACTER_FIELDS: CharacterField[] = [
  { id: "age", label: "Возраст" },
  { id: "role", label: "Роль" },
  { id: "details", label: "Особые детали" },
];

const MAX_PINNED_PHOTOS = 3;
const PINNED_PHOTO_MAX_WIDTH = 240;
const PINNED_PHOTO_MAX_HEIGHT = 220;
const PINNED_PHOTO_MIN_EDGE = 96;

function getFileLabel(path: string) {
  const normalized = path.replace(/\\/g, "/");
  const name = normalized.split("/").pop() || "Фото";
  return name.replace(/\.[^.]+$/, "") || "Фото";
}

function fitPinnedPhotoSize(width: number, height: number) {
  if (!width || !height) {
    return { width: 180, height: 180 };
  }

  let nextWidth = width;
  let nextHeight = height;
  const shrink = Math.min(PINNED_PHOTO_MAX_WIDTH / nextWidth, PINNED_PHOTO_MAX_HEIGHT / nextHeight, 1);
  nextWidth *= shrink;
  nextHeight *= shrink;

  if (nextWidth < PINNED_PHOTO_MIN_EDGE && nextHeight < PINNED_PHOTO_MIN_EDGE) {
    const boost = Math.min(
      PINNED_PHOTO_MIN_EDGE / Math.max(nextWidth, 1),
      PINNED_PHOTO_MIN_EDGE / Math.max(nextHeight, 1)
    );
    nextWidth *= boost;
    nextHeight *= boost;
  }

  const finalShrink = Math.min(
    PINNED_PHOTO_MAX_WIDTH / nextWidth,
    PINNED_PHOTO_MAX_HEIGHT / nextHeight,
    1
  );

  return {
    width: Math.max(72, Math.round(nextWidth * finalShrink)),
    height: Math.max(72, Math.round(nextHeight * finalShrink)),
  };
}

export default function EditorScreen() {
  const nav = useNavigate();
  const { projectId, chapterId } = useParams();
  const win = getCurrentWindow();

  const [uiColor, setUiColor] = useState("#ffffff");
  const [uiFontFamily, setUiFontFamily] = useState(FONT_FAMILIES[0].value);
  const [uiFontSize, setUiFontSize] = useState("16px");
  const [isFocusMode, setIsFocusMode] = useState(false);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const saveStateRef = useRef(saveState);

  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const countJobRef = useRef<{ type: "idle" | "timeout"; id: number } | null>(null);
  const lastCountTextRef = useRef("");

  const isHydratingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const hasMetaLoadedRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosavePendingRef = useRef(false);
  const lastSavedHtmlRef = useRef<string | null>(null);
  const lastSavedTitleRef = useRef<string | null>(null);
  const lastSavedNotesRef = useRef<string | null>(null);

  const [chapterTitle, setChapterTitle] = useState("");
  const [titleDirty, setTitleDirty] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);

  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState<ChapterNotes>({ a: "", b: "", c: "", refs: [] });

  const [emDashAuto, setEmDashAuto] = useState(true);
  const emDashAutoRef = useRef(true);

  const [charactersOpen, setCharactersOpen] = useState(false);
  const [characterFields, setCharacterFields] = useState<CharacterField[]>(DEFAULT_CHARACTER_FIELDS);
  const [characters, setCharacters] = useState<CharacterCard[]>([]);
  const [charactersDirty, setCharactersDirty] = useState(false);
  const [openCharacterId, setOpenCharacterId] = useState<string | null>(null);
  const [avatarSrcById, setAvatarSrcById] = useState<Record<string, string>>({});
  const characterAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedCharactersRef = useRef<string | null>(null);

  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [pinnedPhotos, setPinnedPhotos] = useState<ChapterPinnedPhoto[]>([]);
  const [pinnedPhotosDirty, setPinnedPhotosDirty] = useState(false);
  const [pinnedPhotoSrcById, setPinnedPhotoSrcById] = useState<Record<string, string>>({});
  const pinnedPhotosRef = useRef<ChapterPinnedPhoto[]>([]);
  const editorStageRef = useRef<HTMLDivElement | null>(null);
  const draggingPinnedRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    width: number;
    height: number;
  } | null>(null);
  const resizingPinnedRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    ratio: number;
  } | null>(null);

  useEffect(() => {
    emDashAutoRef.current = emDashAuto;
  }, [emDashAuto]);

  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  useEffect(() => {
    let alive = true;

    const syncFullscreen = async () => {
      try {
        const fullscreen = await win.isFullscreen();
        if (alive) setIsFocusMode(fullscreen);
      } catch {}
    };

    void syncFullscreen();
    window.addEventListener("focus", syncFullscreen);

    return () => {
      alive = false;
      window.removeEventListener("focus", syncFullscreen);
    };
  }, [win]);

  useEffect(() => {
    pinnedPhotosRef.current = pinnedPhotos;
  }, [pinnedPhotos]);

  function makeId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function markUnsaved() {
    if (saveStateRef.current !== "saving" && saveStateRef.current !== "idle") {
      setSaveState("idle");
    }
  }

  function clampPinnedPosition(x: number, y: number, width: number, height: number) {
    const stage = editorStageRef.current;
    if (!stage) return { x: Math.max(12, x), y: Math.max(12, y) };
    const maxX = Math.max(12, stage.clientWidth - width - 12);
    const maxY = Math.max(12, stage.clientHeight - height - 12);
    return {
      x: Math.min(Math.max(12, Math.round(x)), maxX),
      y: Math.min(Math.max(12, Math.round(y)), maxY),
    };
  }

  function clampPinnedSize(photo: ChapterPinnedPhoto, width: number, height: number) {
    const stage = editorStageRef.current;
    const ratio = width / Math.max(height, 1);
    const minWidth = PINNED_PHOTO_MIN_EDGE;
    const minHeight = Math.max(72, Math.round(minWidth / Math.max(ratio, 0.1)));

    if (!stage) {
      return {
        width: Math.max(minWidth, Math.round(width)),
        height: Math.max(minHeight, Math.round(height)),
      };
    }

    const maxWidthByStage = Math.max(minWidth, Math.floor(stage.clientWidth * 0.4));
    const maxHeightByStage = Math.max(minHeight, Math.floor(stage.clientHeight * 0.45));
    const maxWidthByPosition = Math.max(minWidth, stage.clientWidth - photo.x - 12);
    const maxHeightByPosition = Math.max(minHeight, stage.clientHeight - photo.y - 12);

    const hardMaxWidth = Math.min(maxWidthByStage, maxWidthByPosition);
    const hardMaxHeight = Math.min(maxHeightByStage, maxHeightByPosition);

    let nextWidth = Math.max(minWidth, Math.round(width));
    let nextHeight = Math.max(minHeight, Math.round(height));

    const shrink = Math.min(hardMaxWidth / nextWidth, hardMaxHeight / nextHeight, 1);
    nextWidth = Math.round(nextWidth * shrink);
    nextHeight = Math.round(nextHeight * shrink);

    return {
      width: Math.max(minWidth, nextWidth),
      height: Math.max(minHeight, nextHeight),
    };
  }

  function updatePinnedPhotos(next: ChapterPinnedPhoto[], queueSave = true) {
    setPinnedPhotos(next);
    setPinnedPhotosDirty(true);
    markUnsaved();
    if (queueSave) queueAutosave();
  }

  async function relativeAssetToSrc(relativePath: string) {
    if (!projectId) throw new Error("Проект не найден");
    const base = await appDataDir();
    const absolute = await join(
      base,
      "ficwriter",
      "projects",
      projectId,
      relativePath.replace(/\\/g, "/")
    );
    return `${convertFileSrc(absolute)}?v=${Date.now()}`;
  }

  async function getImageSize(src: string) {
    return await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        resolve({
          width: image.naturalWidth || image.width || 1,
          height: image.naturalHeight || image.height || 1,
        });
      };
      image.onerror = () => reject(new Error("Не удалось прочитать размер изображения"));
      image.src = src;
    });
  }

  function normalizeCharacters(
    fields: CharacterField[],
    input: CharacterCard[] | undefined
  ): CharacterCard[] {
    const fieldIds = fields.map((field) => field.id);
    return (input ?? []).map((character) => {
      const nextFields: Record<string, string> = {};
      for (const id of fieldIds) {
        nextFields[id] = character.fields?.[id] ?? "";
      }
      return { ...character, fields: nextFields };
    });
  }

  function setCharactersAndDirty(next: CharacterCard[]) {
    setCharacters(next);
    setCharactersDirty(true);
    queueCharactersAutosave();
  }

  function updateCharacterName(id: string, name: string) {
    setCharactersAndDirty(characters.map((character) => (
      character.id === id ? { ...character, name } : character
    )));
  }

  function updateCharacterAvatar(id: string, avatar: string) {
    setCharactersAndDirty(characters.map((character) => (
      character.id === id ? { ...character, avatar } : character
    )));
  }

  function updateCharacterField(id: string, fieldId: string, value: string) {
    setCharactersAndDirty(
      characters.map((character) => (
        character.id === id
          ? { ...character, fields: { ...character.fields, [fieldId]: value } }
          : character
      ))
    );
  }

  function addCharacter() {
    const next: CharacterCard = {
      id: makeId("char"),
      name: "Новый персонаж",
      fields: Object.fromEntries(characterFields.map((field) => [field.id, ""])),
    };
    setCharactersAndDirty([...characters, next]);
    setOpenCharacterId(next.id);
  }

  function removeCharacter(id: string) {
    setCharactersAndDirty(characters.filter((character) => character.id !== id));
    if (openCharacterId === id) setOpenCharacterId(null);
  }

  async function pickCharacterAvatar(id: string) {
    if (!projectId) return;

    const selected = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });

    if (!selected || Array.isArray(selected)) return;

    try {
      const current = characters.find((character) => character.id === id)?.avatar;
      const relativePath = await importCharacterAvatar(projectId, id, selected);
      if (current && current !== relativePath) {
        await deleteCharacterAvatar(projectId, current);
      }
      updateCharacterAvatar(id, relativePath);
    } catch (error) {
      console.error("Avatar upload error:", error);
    }
  }

  function queueCharactersAutosave() {
    if (!projectId) return;
    if (characterAutosaveTimerRef.current) clearTimeout(characterAutosaveTimerRef.current);
    characterAutosaveTimerRef.current = setTimeout(() => {
      void runCharactersAutosave();
    }, 1000);
  }

  async function runCharactersAutosave() {
    if (!projectId) return;

    const payload = { characterFields, characters };
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedCharactersRef.current) {
      if (charactersDirty) setCharactersDirty(false);
      return;
    }

    try {
      await updateProjectMeta(projectId, payload);
      lastSavedCharactersRef.current = serialized;
      setCharactersDirty(false);
    } catch (error) {
      console.error("CHARACTERS AUTOSAVE ERROR:", error);
    }
  }

  async function importPinnedPhoto() {
    if (!projectId) return;
    if (pinnedPhotosRef.current.length >= MAX_PINNED_PHOTOS) {
      alert(`Можно закрепить не больше ${MAX_PINNED_PHOTOS} фото.`);
      setPinPromptOpen(false);
      return;
    }

    const selected = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });

    if (!selected || Array.isArray(selected)) return;

    let relativePath: string | null = null;

    try {
      const nextId = makeId("pin");
      relativePath = await importReferenceAsset(projectId, nextId, selected);
      const src = await relativeAssetToSrc(relativePath);
      const natural = await getImageSize(src);
      const size = fitPinnedPhotoSize(natural.width, natural.height);
      const position = clampPinnedPosition(
        24 + pinnedPhotosRef.current.length * 26,
        24 + pinnedPhotosRef.current.length * 34,
        size.width,
        size.height
      );

      setPinnedPhotoSrcById((current) => ({ ...current, [nextId]: src }));
      updatePinnedPhotos([
        ...pinnedPhotosRef.current,
        {
          id: nextId,
          name: getFileLabel(selected),
          path: relativePath,
          width: size.width,
          height: size.height,
          x: position.x,
          y: position.y,
        },
      ]);
      setPinPromptOpen(false);
    } catch (error) {
      if (relativePath) {
        await deleteReferenceAsset(projectId, relativePath);
      }
      console.error("PIN PHOTO IMPORT ERROR:", error);
      alert("Не получилось закрепить фото");
    }
  }

  async function removePinnedPhoto(id: string) {
    const current = pinnedPhotosRef.current.find((photo) => photo.id === id);
    if (!current) return;

    setPinnedPhotoSrcById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    updatePinnedPhotos(pinnedPhotosRef.current.filter((photo) => photo.id !== id));

    if (projectId) {
      await deleteReferenceAsset(projectId, current.path);
    }
  }

  function startPinnedPhotoDrag(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    const current = pinnedPhotosRef.current.find((photo) => photo.id === id);
    if (!current) return;
    draggingPinnedRef.current = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      originX: current.x,
      originY: current.y,
      width: current.width,
      height: current.height,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function startPinnedPhotoResize(event: ReactPointerEvent<HTMLButtonElement>, photo: ChapterPinnedPhoto) {
    resizingPinnedRef.current = {
      id: photo.id,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: photo.width,
      startHeight: photo.height,
      ratio: photo.width / Math.max(photo.height, 1),
    };
    event.preventDefault();
    event.stopPropagation();
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
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
      if (saveStateRef.current !== "saving" && saveStateRef.current !== "idle") {
        setSaveState("idle");
      }
      scheduleCounts();
      queueAutosave();
    },
    editorProps: {
      attributes: {
        class: "fw-editor",
        spellcheck: "false",
        autocorrect: "off",
        autocapitalize: "off",
      },
      handleDOMEvents: {
        keydown: (view: EditorView, event: KeyboardEvent) => {
          if (event.key === "Tab") {
            event.preventDefault();
            event.stopPropagation();
            view.dispatch(view.state.tr.insertText("\t"));
            return true;
          }

          if (
            emDashAutoRef.current &&
            event.key === "-" &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            const { state } = view;
            const { from, empty } = state.selection;

            if (empty && from >= 2) {
              const prevChar = state.doc.textBetween(from - 1, from, "\n", "\n");
              if (prevChar === "-") {
                event.preventDefault();
                event.stopPropagation();
                const transaction = state.tr.insertText("—", from - 1, from);
                view.dispatch(transaction);
                return true;
              }
            }
          }

          return false;
        },
        paste: (view: EditorView, event: ClipboardEvent) => {
          if (!event.clipboardData) return false;
          const text = event.clipboardData.getData("text/plain");
          if (!text) return false;

          event.preventDefault();
          event.stopPropagation();
          insertPlainText(view, text);
          return true;
        },
      },
    },
  });

  function syncUiFromSelection() {
    if (!editor) return;
    const attrs = editor.getAttributes("textStyle") as {
      fontFamily?: string;
      fontSize?: string;
    };
    setUiFontFamily(attrs.fontFamily || FONT_FAMILIES[0].value);
    setUiFontSize(attrs.fontSize || "16px");
  }

  useEffect(() => {
    if (!editor) return;

    const sync = () => {
      syncUiFromSelection();
      const color = editor.getAttributes("textStyle").color as string | null | undefined;
      setUiColor(color && typeof color === "string" ? color : "#ffffff");
    };

    editor.on("selectionUpdate", sync);
    editor.on("transaction", sync);
    sync();

    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("transaction", sync);
    };
  }, [editor]);

  async function runAutosave() {
    if (!editor || !projectId || !chapterId) return;
    if (isHydratingRef.current) return;
    if (!hasLoadedRef.current || !hasMetaLoadedRef.current) return;

    if (saveStateRef.current === "saving") {
      autosavePendingRef.current = true;
      return;
    }

    setSaveState("saving");
    setSaveError("");

    try {
      const html = editor.getHTML();
      const title = chapterTitle.trim() || "Без названия";
      const notesPayload = notes;
      const pinnedPhotosPayload = pinnedPhotos;
      const notesJson = JSON.stringify({
        notes: notesPayload,
        pinnedPhotos: pinnedPhotosPayload,
      });

      const needText = html !== lastSavedHtmlRef.current;
      const needTitle = title !== lastSavedTitleRef.current;
      const needNotes = notesJson !== lastSavedNotesRef.current;

      if (!needText && !needTitle && !needNotes) {
        setSaveState("saved");
        setTitleDirty(false);
        setNotesDirty(false);
        setPinnedPhotosDirty(false);
        return;
      }

      await saveChapterText(projectId, chapterId, html);
      await saveChapterTitle(projectId, chapterId, title);
      await updateChapterTitle(projectId, chapterId, title);
      await saveChapterNotes(projectId, chapterId, notesPayload);
      await saveChapterPinnedPhotos(projectId, chapterId, pinnedPhotosPayload);

      lastSavedHtmlRef.current = html;
      lastSavedTitleRef.current = title;
      lastSavedNotesRef.current = notesJson;
      setTitleDirty(false);
      setNotesDirty(false);
      setPinnedPhotosDirty(false);
      setSaveState("saved");
    } catch (error: any) {
      setSaveState("error");
      setSaveError(String(error?.message ?? error));
    } finally {
      if (autosavePendingRef.current) {
        autosavePendingRef.current = false;
        queueAutosave();
      }
    }
  }

  function queueAutosave() {
    if (!editor || !projectId || !chapterId) return;
    if (isHydratingRef.current) return;
    if (!hasLoadedRef.current || !hasMetaLoadedRef.current) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      void runAutosave();
    }, 1000);
  }

  useEffect(() => {
    let cancelled = false;
    if (!editor || !projectId || !chapterId) return;
    hasLoadedRef.current = false;

    void (async () => {
      try {
        const saved = await loadChapterText(projectId, chapterId);
        if (cancelled) return;

        isHydratingRef.current = true;
        editor.commands.setContent(saved ?? "");
        isHydratingRef.current = false;

        setSaveState(saved ? "saved" : "idle");
        setSaveError("");
        lastSavedHtmlRef.current = saved ?? "";
        hasLoadedRef.current = true;
        scheduleCounts();
        syncUiFromSelection();
      } catch (error) {
        console.error("LOAD ERROR:", error);
        hasLoadedRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editor, projectId, chapterId]);

  useEffect(() => {
    let cancelled = false;
    if (!projectId || !chapterId) return;
    hasMetaLoadedRef.current = false;

    void (async () => {
      try {
        const savedTitle = await loadChapterTitle(projectId, chapterId);
        if (!cancelled) {
          setChapterTitle(savedTitle ?? "");
          setTitleDirty(false);
          lastSavedTitleRef.current = (savedTitle ?? "").trim() || "Без названия";
        }

        const savedNotes = await loadChapterNotes(projectId, chapterId);
        if (!cancelled) {
          setNotes(savedNotes);
          setNotesDirty(false);
        }

        const savedPinnedPhotos = await loadChapterPinnedPhotos(projectId, chapterId);
        if (!cancelled) {
          setPinnedPhotos(savedPinnedPhotos);
          setPinnedPhotosDirty(false);
          lastSavedNotesRef.current = JSON.stringify({
            notes: savedNotes,
            pinnedPhotos: savedPinnedPhotos,
          });
          hasMetaLoadedRef.current = true;
        }
      } catch (error) {
        console.error("META LOAD ERROR:", error);
        if (!cancelled) hasMetaLoadedRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, chapterId]);

  useEffect(() => {
    let alive = true;
    if (!projectId) return;

    void (async () => {
      const nextMap: Record<string, string> = {};
      for (const photo of pinnedPhotos) {
        if (!photo.path) continue;
        try {
          nextMap[photo.id] = await relativeAssetToSrc(photo.path);
        } catch {
          // ignore broken pinned photo path
        }
      }
      if (alive) setPinnedPhotoSrcById(nextMap);
    })();

    return () => {
      alive = false;
    };
  }, [projectId, pinnedPhotos]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const resize = resizingPinnedRef.current;
      if (resize) {
        const current = pinnedPhotosRef.current.find((photo) => photo.id === resize.id);
        if (!current) return;

        const scaleX = (resize.startWidth + (event.clientX - resize.startX)) / resize.startWidth;
        const scaleY = (resize.startHeight + (event.clientY - resize.startY)) / resize.startHeight;
        const nextScale = Math.max(0.45, Math.max(scaleX, scaleY));
        const nextWidth = resize.startWidth * nextScale;
        const nextHeight = nextWidth / Math.max(resize.ratio, 0.1);
        const size = clampPinnedSize(current, nextWidth, nextHeight);

        setPinnedPhotos((photos) =>
          photos.map((photo) =>
            photo.id === resize.id
              ? {
                  ...photo,
                  width: size.width,
                  height: size.height,
                }
              : photo
          )
        );
        setPinnedPhotosDirty(true);
        markUnsaved();
        return;
      }

      const drag = draggingPinnedRef.current;
      if (!drag || !editorStageRef.current) return;
      const position = clampPinnedPosition(
        drag.originX + (event.clientX - drag.startX),
        drag.originY + (event.clientY - drag.startY),
        drag.width,
        drag.height
      );

      setPinnedPhotos((photos) =>
        photos.map((photo) =>
          photo.id === drag.id ? { ...photo, x: position.x, y: position.y } : photo
        )
      );
      setPinnedPhotosDirty(true);
      markUnsaved();
    };

    const onPointerUp = () => {
      if (!draggingPinnedRef.current && !resizingPinnedRef.current) return;
      draggingPinnedRef.current = null;
      resizingPinnedRef.current = null;
      queueAutosave();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [projectId, chapterId, editor]);

  useEffect(() => {
    let cancelled = false;
    if (!projectId) return;

    void (async () => {
      try {
        const project = await loadProject(projectId);
        if (cancelled || !project) return;

        const fields =
          project.characterFields && project.characterFields.length > 0
            ? project.characterFields
            : DEFAULT_CHARACTER_FIELDS;
        const nextCharacters = normalizeCharacters(fields, project.characters);

        setCharacterFields(fields);
        setCharacters(nextCharacters);
        setCharactersDirty(false);
        lastSavedCharactersRef.current = JSON.stringify({
          characterFields: fields,
          characters: nextCharacters,
        });
      } catch (error) {
        console.error("CHARACTERS LOAD ERROR:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    if (!projectId) return;

    void (async () => {
      const nextMap: Record<string, string> = {};
      for (const character of characters) {
        if (!character.avatar) continue;
        if (/^(https?:|data:|blob:|file:)/.test(character.avatar)) {
          nextMap[character.id] = character.avatar;
          continue;
        }
        try {
          const base = await appDataDir();
          const absolute = await join(
            base,
            "ficwriter",
            "projects",
            projectId,
            character.avatar.replace(/\\/g, "/")
          );
          nextMap[character.id] = `${convertFileSrc(absolute)}?v=${Date.now()}`;
        } catch {
          // ignore broken avatar path
        }
      }

      if (alive) setAvatarSrcById(nextMap);
    })();

    return () => {
      alive = false;
    };
  }, [projectId, characters]);

  useEffect(() => {
    if (!projectId || !charactersDirty) return;
    queueCharactersAutosave();
    return () => {
      if (characterAutosaveTimerRef.current) {
        clearTimeout(characterAutosaveTimerRef.current);
        characterAutosaveTimerRef.current = null;
      }
    };
  }, [projectId, charactersDirty, characterFields, characters]);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (charactersDirty) {
        void runCharactersAutosave();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (characterAutosaveTimerRef.current) {
        clearTimeout(characterAutosaveTimerRef.current);
        characterAutosaveTimerRef.current = null;
      }
      if (charactersDirty) {
        void runCharactersAutosave();
      }
    };
  }, [charactersDirty, characterFields, characters, projectId]);

  useEffect(() => {
    if (!editor || !projectId || !chapterId) return;
    if (isHydratingRef.current) return;
    if (!titleDirty && !notesDirty && !pinnedPhotosDirty && saveState !== "idle") return;
    queueAutosave();
  }, [editor, projectId, chapterId, chapterTitle, notes, pinnedPhotos, titleDirty, notesDirty, pinnedPhotosDirty, saveState]);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (!editor || !projectId || !chapterId) return;
      if (!hasLoadedRef.current || !hasMetaLoadedRef.current) return;
      if (titleDirty || notesDirty || pinnedPhotosDirty || saveState === "idle") {
        void runAutosave();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      if (!hasLoadedRef.current || !hasMetaLoadedRef.current) return;
      if (titleDirty || notesDirty || pinnedPhotosDirty || saveState === "idle") {
        void runAutosave();
      }
    };
  }, [editor, projectId, chapterId, chapterTitle, notes, pinnedPhotos, titleDirty, notesDirty, pinnedPhotosDirty, saveState]);

  useEffect(() => {
    return () => {
      const job = countJobRef.current;
      if (!job) return;
      if (job.type === "idle") {
        (window as any).cancelIdleCallback?.(job.id);
      } else {
        clearTimeout(job.id);
      }
      countJobRef.current = null;
    };
  }, []);

  function scheduleCounts() {
    if (!editor) return;

    const job = countJobRef.current;
    if (job) {
      if (job.type === "idle") {
        (window as any).cancelIdleCallback?.(job.id);
      } else {
        clearTimeout(job.id);
      }
      countJobRef.current = null;
    }

    const run = () => {
      const text = editor.getText();
      if (text === lastCountTextRef.current) return;
      lastCountTextRef.current = text;
      setWordCount(countWords(text));
      setCharCount(text.length);
    };

    const requestIdle = (window as any).requestIdleCallback as ((cb: () => void) => number) | undefined;
    if (requestIdle) {
      countJobRef.current = { type: "idle", id: requestIdle(run) };
    } else {
      countJobRef.current = { type: "timeout", id: window.setTimeout(run, 120) };
    }
  }

  async function onSave() {
    if (!editor || !projectId || !chapterId) return;

    setSaveState("saving");
    setSaveError("");

    try {
      const html = editor.getHTML();
      const title = chapterTitle.trim() || "Без названия";
      await saveChapterText(projectId, chapterId, html);
      await saveChapterTitle(projectId, chapterId, title);
      await updateChapterTitle(projectId, chapterId, title);
      const notesSnapshot = JSON.stringify({
        notes,
        pinnedPhotos,
      });
      await saveChapterNotes(projectId, chapterId, notes);
      await saveChapterPinnedPhotos(projectId, chapterId, pinnedPhotos);

      lastSavedHtmlRef.current = html;
      lastSavedTitleRef.current = title;
      lastSavedNotesRef.current = notesSnapshot;
      setTitleDirty(false);
      setNotesDirty(false);
      setPinnedPhotosDirty(false);
      setSaveState("saved");
    } catch (error: any) {
      setSaveState("error");
      setSaveError(String(error?.message ?? error));
    }
  }

  function insertEmDash() {
    editor?.chain().focus().insertContent("—").run();
  }

  const hasUnsavedChanges =
    (editor?.getHTML() ?? "") !== (lastSavedHtmlRef.current ?? "") ||
    (chapterTitle.trim() || "Без названия") !== (lastSavedTitleRef.current ?? "Без названия") ||
    JSON.stringify({ notes, pinnedPhotos }) !==
      (lastSavedNotesRef.current ?? JSON.stringify({ notes: { a: "", b: "", c: "", refs: [] }, pinnedPhotos: [] })) ||
    titleDirty ||
    notesDirty ||
    pinnedPhotosDirty ||
    charactersDirty;

  async function handleBackToProject() {
    if (saveState === "saving") return;

    if (hasUnsavedChanges) {
      const ok = await confirm(
        "Изменения в главе еще не сохранены. Сохранить их и закрыть редактор?",
        {
          title: "Несохраненные изменения",
          okLabel: "Сохранить и выйти",
          cancelLabel: "Остаться",
          kind: "warning",
        }
      );
      if (!ok) return;
      await onSave();
      if (saveStateRef.current === "error") return;
    }

    nav(`/project/${projectId}`);
  }

  async function toggleFocusMode() {
    try {
      const next = !(await win.isFullscreen());
      if (next) {
        await Promise.allSettled([win.setShadow(false), win.setResizable(false)]);
        await win.setFullscreen(true);
      } else {
        await win.setFullscreen(false);
        await Promise.allSettled([win.setResizable(true), win.setShadow(true)]);
      }
      setIsFocusMode(next);
    } catch (e: any) {
      alert(e?.message ?? "Не удалось переключить режим фокуса");
    }
  }

  if (!projectId || !chapterId) {
    return (
      <div style={{ padding: 24 }}>
        <button className="ghost-btn" onClick={() => nav(-1)}>
          ← Назад
        </button>
        <p>Загружаю главу…</p>
      </div>
    );
  }

  return (
    <div className="editor-root">
      <div className="editor-top">
        <button className="ghost-btn" onClick={() => void handleBackToProject()}>
          ← К списку глав
        </button>

        <input
          className="editor-title-input"
          value={chapterTitle}
          onChange={(event) => {
            setChapterTitle(event.target.value);
            setTitleDirty(true);
            queueAutosave();
          }}
          placeholder="Название главы…"
        />

        <div className="editor-top-right">
          <button className="ghost-btn" onClick={() => void toggleFocusMode()}>
            {isFocusMode ? "Выйти из режима фокуса" : "Режим фокуса"}
          </button>
          <div className="editor-counter">Слова: {wordCount} · Символы: {charCount}</div>
          <button
            className={`save-btn ${saveState === "saved" ? "is-saved" : ""}`}
            onClick={() => void onSave()}
            disabled={saveState === "saving"}
            title={saveState === "saved" ? "Сохранено" : "Сохранить"}
          >
            {saveState === "saving" ? "Сохраняю…" : "Сохранить"}
          </button>
        </div>
      </div>

      <div className="editor-toolbar">
        <button className="tool-btn" onClick={() => editor?.chain().focus().toggleItalic().run()}>
          I
        </button>
        <button className="tool-btn" onClick={() => editor?.chain().focus().toggleBold().run()}>
          B
        </button>
        <button className="tool-btn" onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          U
        </button>

        <div className="tool-sep" />

        <button className="tool-btn" onClick={() => editor?.chain().focus().setTextAlign("left").run()}>
          <span className="align-icon align-icon--left" aria-hidden="true" />
        </button>
        <button className="tool-btn" onClick={() => editor?.chain().focus().setTextAlign("center").run()}>
          <span className="align-icon align-icon--center" aria-hidden="true" />
        </button>
        <button className="tool-btn" onClick={() => editor?.chain().focus().setTextAlign("right").run()}>
          <span className="align-icon align-icon--right" aria-hidden="true" />
        </button>

        <div className="tool-sep" />

        <select
          className="tool-select"
          value={uiFontFamily}
          onChange={(event) => {
            const value = event.target.value;
            setUiFontFamily(value);
            editor?.chain().focus().setFontFamily(value).run();
          }}
        >
          {FONT_FAMILIES.map((font) => (
            <option key={font.label} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>

        <select
          className="tool-select"
          value={uiFontSize}
          onChange={(event) => {
            const value = event.target.value;
            setUiFontSize(value);
            editor?.chain().focus().setFontSize(value).run();
          }}
        >
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>

        <input
          className="tool-color"
          type="color"
          value={uiColor}
          onChange={(event) => {
            const value = event.target.value;
            setUiColor(value);
            editor?.chain().focus().setColor(value).run();
          }}
          title="Цвет"
        />

        <button
          className="tool-btn"
          onClick={() => {
            setUiColor("#ffffff");
            editor?.chain().focus().unsetColor().run();
          }}
          title="Сбросить цвет"
        >
          ×
        </button>

        <div className="tool-sep" />

        <button className="tool-btn" onClick={() => editor?.chain().focus().undo().run()}>
          ↶
        </button>
        <button className="tool-btn" onClick={() => editor?.chain().focus().redo().run()}>
          ↷
        </button>

        <div className="tool-sep" />

        <button className="tool-btn is-wide" onClick={() => editor?.chain().focus().insertContent("\t").run()}>
          Tab
        </button>

        <button
          className="tool-btn is-auto-dash"
          onClick={() => setEmDashAuto((value) => !value)}
          title="-- → —"
        >
          <span className="auto-dash-top">—</span>
          <span className="auto-dash-bottom">{emDashAuto ? "авто: ON" : "авто: OFF"}</span>
        </button>

        <button className="tool-btn" onClick={() => editor?.chain().focus().insertContent("***").run()}>
          ***
        </button>

        <button className="tool-btn" onClick={insertEmDash}>
          —
        </button>
      </div>

      {saveState === "error" ? (
        <div className="save-error">
          Ошибка сохранения.
          <br />
          <span className="save-error-details">{saveError}</span>
        </div>
      ) : null}

      <div className="editor-area" ref={editorStageRef}>
        <div className="editor-paper">
          <EditorContent editor={editor} />
        </div>
        <div className="pinned-photos-layer" aria-hidden={pinnedPhotos.length === 0}>
          {pinnedPhotos.map((photo) => (
            <div
              className="pinned-photo-card"
              key={photo.id}
              style={{
                width: `${photo.width}px`,
                height: `${photo.height}px`,
                transform: `translate(${photo.x}px, ${photo.y}px)`,
              }}
            >
              <button
                className="pinned-photo-handle"
                type="button"
                onPointerDown={(event) => startPinnedPhotoDrag(event, photo.id)}
                title="Перетащить фото"
              >
                📌
              </button>
              <button
                className="pinned-photo-remove"
                type="button"
                onClick={() => void removePinnedPhoto(photo.id)}
                title="Убрать фото"
              >
                ×
              </button>
              <button
                className="pinned-photo-resize"
                type="button"
                onPointerDown={(event) => startPinnedPhotoResize(event, photo)}
                title="Изменить размер"
              >
                ↘
              </button>
              <div className="pinned-photo-frame">
                {pinnedPhotoSrcById[photo.id] ? (
                  <img className="pinned-photo-image" src={pinnedPhotoSrcById[photo.id]} alt={photo.name} />
                ) : (
                  <div className="pinned-photo-placeholder">Фото</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        className="pin-fab"
        onClick={() => {
          if (pinnedPhotos.length >= MAX_PINNED_PHOTOS) {
            alert(`Можно закрепить не больше ${MAX_PINNED_PHOTOS} фото.`);
            return;
          }
          setPinPromptOpen(true);
        }}
        title="Закрепить фото"
      >
        📌
      </button>

      <button
        className="characters-fab"
        onClick={() => setCharactersOpen((value) => !value)}
        title="Персонажи"
      >
        👤
      </button>

      <button className="notes-fab" onClick={() => setNotesOpen((value) => !value)} title="Заметки">
        🗒️
      </button>

      <div className={`characters-panel ${charactersOpen ? "is-open" : ""}`}>
        <div className="characters-head">
          <div className="characters-title">Персонажи</div>
          <div className="characters-head-actions">
            <button className="tool-btn" onClick={addCharacter} title="Добавить персонажа">
              +
            </button>
            <button className="tool-btn" onClick={() => setCharactersOpen(false)} title="Закрыть">
              ×
            </button>
          </div>
        </div>

        <div className="characters-list">
          {characters.length === 0 ? (
            <div className="characters-empty">Пока нет карточек. Нажми +, чтобы добавить.</div>
          ) : (
            characters.map((character) => {
              const isOpen = openCharacterId === character.id;
              return (
                <div className={`character-card ${isOpen ? "is-open" : ""}`} key={character.id}>
                  <button
                    className="character-card__toggle"
                    onClick={() => setOpenCharacterId(isOpen ? null : character.id)}
                    title={isOpen ? "Свернуть" : "Развернуть"}
                  >
                    <span className="character-card__name">{character.name || "Без имени"}</span>
                    <span className="character-card__chev">{isOpen ? "▾" : "▸"}</span>
                  </button>

                  {isOpen ? (
                    <div className="character-card__body">
                      <div className="character-card__row">
                        {avatarSrcById[character.id] ? (
                          <img className="character-avatar" src={avatarSrcById[character.id]} alt="" />
                        ) : (
                          <div className="character-avatar placeholder">👤</div>
                        )}

                        <div className="character-card__main">
                          <input
                            className="form-input character-input"
                            value={character.name}
                            onChange={(event) => updateCharacterName(character.id, event.target.value)}
                            placeholder="Имя персонажа"
                          />
                          <input
                            className="form-input character-input"
                            value={character.avatar ?? ""}
                            onChange={(event) => updateCharacterAvatar(character.id, event.target.value)}
                            placeholder="Портрет (URL)"
                          />
                          <button
                            className="ghost-btn character-upload"
                            onClick={() => void pickCharacterAvatar(character.id)}
                            type="button"
                          >
                            Загрузить фото
                          </button>
                        </div>
                      </div>

                      <div className="character-fields">
                        {characterFields.map((field) => (
                          <div className="character-field" key={`${character.id}-${field.id}`}>
                            <div className="character-field__label">{field.label}</div>
                            <textarea
                              className="form-textarea character-textarea"
                              value={character.fields?.[field.id] ?? ""}
                              onChange={(event) =>
                                updateCharacterField(character.id, field.id, event.target.value)
                              }
                              placeholder={field.label}
                            />
                          </div>
                        ))}
                      </div>

                      <button
                        className="ghost-btn character-remove"
                        onClick={() => removeCharacter(character.id)}
                      >
                        Удалить персонажа
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className={`notes-panel ${notesOpen ? "is-open" : ""}`}>
        <div className="notes-head">
          <div className="notes-title">Заметки</div>
          <button className="tool-btn" onClick={() => setNotesOpen(false)} title="Закрыть">
            ×
          </button>
        </div>

        <div className="notes-grid">
          <textarea
            className="note"
            placeholder="Стикер 1 (план сцены, поворот, цель)…"
            value={notes.a}
            onChange={(event) => {
              setNotes((current) => ({ ...current, a: event.target.value }));
              setNotesDirty(true);
              queueAutosave();
            }}
          />
          <textarea
            className="note"
            placeholder="Стикер 2 (возраст, детали, факты)…"
            value={notes.b}
            onChange={(event) => {
              setNotes((current) => ({ ...current, b: event.target.value }));
              setNotesDirty(true);
              queueAutosave();
            }}
          />
          <textarea
            className="note"
            placeholder="Стикер 3 (таймлайн, предметы, подсказки)…"
            value={notes.c}
            onChange={(event) => {
              setNotes((current) => ({ ...current, c: event.target.value }));
              setNotesDirty(true);
              queueAutosave();
            }}
          />
        </div>

        <div className="notes-hint">Сохраняется вместе с главой по кнопке «Сохранить».</div>
      </div>

      {pinPromptOpen ? (
        <div className="pin-photo-popover-backdrop" onClick={() => setPinPromptOpen(false)}>
          <div className="pin-photo-popover" onClick={(event) => event.stopPropagation()}>
            <button
              className="pin-photo-popover-close"
              type="button"
              onClick={() => setPinPromptOpen(false)}
              title="Закрыть"
            >
              ×
            </button>
            <div className="pin-photo-popover-title">Закрепить фото на экране</div>
            <div className="pin-photo-popover-text">
              Импортируйте фото-референс. Оно появится поверх редактора, будет свободно
              перетаскиваться по экрану и сохранится отдельно для этой главы.
            </div>
            <div className="pin-photo-popover-hint">
              Лимит: до {MAX_PINNED_PHOTOS} фото одновременно.
            </div>
            <button className="pin-photo-popover-action" type="button" onClick={() => void importPinnedPhoto()}>
              Импортировать фото →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
