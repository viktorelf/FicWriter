import "tldraw/tldraw.css";
import "./board.css";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DefaultActionsMenu,
  DefaultMenuPanel,
  DefaultMinimap,
  DefaultNavigationPanel,
  DefaultPageMenu,
  Tldraw,
  type Editor,
} from "tldraw";

import { confirm } from "../components/confirmService";
import { useBoardAutosave } from "./logic/useBoardAutosave";
import { ColumnShapeUtil } from "./shapes/ColumnShape";
import { TableShapeUtil } from "./shapes/TableShape";
import { BoardMainMenu } from "./ui/BoardMainMenu";
import { BoardActions } from "./ui/BoardActions";
import { BoardTopBar } from "./ui/BoardTopBar";

declare global {
  interface Window {
    __fwBeforeWindowClose?: (() => Promise<boolean> | boolean) | null;
  }
}

const BOARD_OPTIONS = {
  edgeScrollSpeed: 8,
  edgeScrollDistance: 6,
  edgeScrollEaseDuration: 260,
};

const CULLING_SCREEN_MARGIN_PX = 900;
const CULLING_SCREEN_MARGIN_MIN_PX = 600;

function installBufferedCulling(editor: Editor) {
  const originalGetCulledShapes = editor.getCulledShapes.bind(editor);

  editor.getCulledShapes = () => {
    try {
      const viewport = editor.getViewportPageBounds().clone();
      const zoom = Math.max(editor.getZoomLevel(), 0.05);
      const marginInPageUnits = Math.max(CULLING_SCREEN_MARGIN_PX / zoom, CULLING_SCREEN_MARGIN_MIN_PX / zoom);
      const bufferedViewport = viewport.expandBy(marginInPageUnits);

      const culledShapes = new Set(editor.getCurrentPageShapeIds());
      const editingId = editor.getEditingShapeId();

      for (const id of editor.getCurrentPageShapeIds()) {
        const maskedPageBounds = editor.getShapeMaskedPageBounds(id);
        if (maskedPageBounds && bufferedViewport.includes(maskedPageBounds)) {
          culledShapes.delete(id);
        }
      }

      if (editingId) {
        culledShapes.delete(editingId);
      }

      editor.getSelectedShapeIds().forEach((id) => {
        culledShapes.delete(id);
      });

      return culledShapes;
    } catch {
      return originalGetCulledShapes();
    }
  };
}

export default function InteractiveBoardScreen() {
  const nav = useNavigate();
  const [editor, setEditor] = useState<Editor | null>(null);

  const { saveNow, hasUnsavedChanges } = useBoardAutosave(editor);

  useEffect(() => {
    // Ensure minimap is expanded by default.
    localStorage.setItem("minimap", "false");
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    window.__fwBeforeWindowClose = async () => {
      if (!hasUnsavedChanges) return true;

      const ok = await confirm("Изменения на доске не сохранены. Сохранить их и закрыть окно?", {
        title: "Несохраненные изменения",
        okLabel: "Сохранить и закрыть",
        cancelLabel: "Остаться",
        kind: "warning",
      });
      if (!ok) return false;

      return await saveNow();
    };

    return () => {
      if (window.__fwBeforeWindowClose) {
        window.__fwBeforeWindowClose = null;
      }
    };
  }, [hasUnsavedChanges, saveNow]);

  async function handleBack() {
    if (hasUnsavedChanges) {
      const ok = await confirm("Изменения на доске не сохранены. Сохранить их и закрыть доску?", {
        title: "Несохраненные изменения",
        okLabel: "Сохранить и выйти",
        cancelLabel: "Остаться",
        kind: "warning",
      });
      if (!ok) return;
    }

    const saved = await saveNow();
    if (!saved) return;
    nav("/");
  }

  function handleMount(next: Editor) {
    // Keep normal culling behavior, but render a buffered area around the viewport
    // so large images don't disappear near the edges during resize / zoom / pan.
    installBufferedCulling(next);
    next.updateInstanceState({
      isGridMode: true,
    });
    next.user.updateUserPreferences({ colorScheme: "light" });
    setEditor(next);
  }

  return (
    <div className="board-root">
      <div className="board-stage">
        <Tldraw
          shapeUtils={[TableShapeUtil, ColumnShapeUtil]}
          onMount={handleMount}
          options={BOARD_OPTIONS}
          components={{
            MainMenu: BoardMainMenu,
            MenuPanel: DefaultMenuPanel,
            ActionsMenu: DefaultActionsMenu,
            PageMenu: DefaultPageMenu,
            Minimap: DefaultMinimap,
            NavigationPanel: DefaultNavigationPanel,
          }}
        />
      </div>

      <BoardTopBar editor={editor} />
      <BoardActions editor={editor} onBack={handleBack} onSave={saveNow} />
    </div>
  );
}
