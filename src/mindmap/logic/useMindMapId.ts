import { useEffect, useState } from "react";
import { createMindMap, listMindMaps } from "../../store/mindmapStore";

export function useMindMapId() {
  const [mindmapId, setMindmapId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const list = await listMindMaps();
      if (!alive) return;

      if (list.length > 0) {
        setMindmapId(list[0].id);
        return;
      }

      const created = await createMindMap("Майндмэп");
      if (!alive) return;
      setMindmapId(created.id);
    })();

    return () => { alive = false; };
  }, []);

  return mindmapId;
}

