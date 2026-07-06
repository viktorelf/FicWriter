import { useEffect, useRef } from "react";
import { loadSnapshot, type Editor } from "tldraw";
import { loadMindMapSnapshot } from "../../store/mindmapStore";

export function useMindMapSnapshot(editor: Editor | null, mindmapId: string | null) {
  const isLoading = useRef(false);

  useEffect(() => {
    if (!editor || !mindmapId) return;

    let alive = true;

    (async () => {
      const snapshot = await loadMindMapSnapshot(mindmapId);
      if (!alive || !snapshot) return;

      isLoading.current = true;
      try {
        // Load tldraw snapshot safely.
        loadSnapshot(editor.store, snapshot);
      } finally {
        isLoading.current = false;
      }
    })();

    return () => { alive = false; };
  }, [editor, mindmapId]);
}
