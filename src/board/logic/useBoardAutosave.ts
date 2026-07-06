import { useCallback, useEffect, useRef, useState } from "react";
import { loadSnapshot, type Editor } from "tldraw";
import { loadBoardSnapshot, saveBoardSnapshot } from "./boardSnapshotStore";

export function useBoardAutosave(editor: Editor | null) {
  const lastSaved = useRef<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const saveNow = useCallback(async () => {
    if (!editor) return false;
    try {
      const snapshot = editor.store.getSnapshot();
      const payload = JSON.stringify(snapshot);
      if (payload !== lastSaved.current) {
        lastSaved.current = payload;
        await saveBoardSnapshot(payload);
      }
      setHasUnsavedChanges(false);
      return true;
    } catch {
      return false;
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    let alive = true;
    void (async () => {
      const raw = await loadBoardSnapshot();
      if (!alive || !raw) return;
      try {
        const snapshot = JSON.parse(raw);
        loadSnapshot(editor.store, snapshot);
        lastSaved.current = raw;
        setHasUnsavedChanges(false);
      } catch {
        // ignore bad snapshots
      }
    })();

    let timer: number | null = null;
    const unsub = editor.store.listen(
      () => {
        try {
          const payload = JSON.stringify(editor.store.getSnapshot());
          setHasUnsavedChanges(payload !== lastSaved.current);
        } catch {
          setHasUnsavedChanges(true);
        }
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          void saveNow();
        }, 400);
      },
      { scope: "document", source: "user" }
    );

    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
      unsub();
      void saveNow();
    };
  }, [editor, saveNow]);

  return { saveNow, hasUnsavedChanges };
}
