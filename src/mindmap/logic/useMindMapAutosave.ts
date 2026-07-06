import { useEffect, useRef } from "react";
import type { Editor } from "tldraw";
import { saveMindMapSnapshot } from "../../store/mindmapStore";

export function useMindMapAutosave(editor: Editor | null, mindmapId: string | null) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  useEffect(() => {
    if (!editor || !mindmapId) return;

    const scheduleSave = () => {
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(async () => {
        try {
          const snapshot = editor.store.getSnapshot();
          const serialized = JSON.stringify(snapshot);

          if (serialized === lastSavedRef.current) return;
          lastSavedRef.current = serialized;

          await saveMindMapSnapshot(mindmapId, snapshot);
        } catch (e) {
          console.error("Mindmap autosave failed:", e);
        }
      }, 500);
    };

    const unlisten = editor.store.listen(
      () => scheduleSave(),
      { scope: "document", source: "user" }
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      unlisten();
    };
  }, [editor, mindmapId]);
}
