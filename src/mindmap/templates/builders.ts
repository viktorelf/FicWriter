import type { Editor } from "tldraw";
import { createShapeId } from "@tldraw/tlschema";
import { confirm } from "../../components/confirmService";

export function getViewportCenter(editor: Editor) {
  const center = editor.getViewportPageBounds().center;
  return { x: center.x, y: center.y };
}

export function clearCanvas(editor: Editor) {
  const ids = Array.from(editor.getCurrentPageShapeIds());
  if (!ids.length) return;
  editor.deleteShapes(ids as any);
}

export async function askReplace(editor: Editor) {
  const ids = editor.getCurrentPageShapeIds() as any;
  const hasShapes = Array.isArray(ids) ? ids.length > 0 : ids?.size > 0;
  if (!hasShapes) return true;
  return confirm("Заменить текущую доску шаблоном? Текущее содержимое будет удалено.");
}

export function createGeoBlock(editor: Editor, x: number, y: number, w: number, h: number, text: string) {
  const id = createShapeId();
  editor.createShape({
    id,
    type: "geo",
    x,
    y,
    props: { geo: "rectangle", w, h, text, align: "middle", verticalAlign: "middle" },
  });
  return id;
}

export function createNote(editor: Editor, x: number, y: number, text: string, color: string = "yellow") {
  const id = createShapeId();
  editor.createShape({
    id,
    type: "note",
    x,
    y,
    props: { text, color },
  });
  return id;
}

export function createArrowBetween(editor: Editor, startId: string, endId: string, bend: number = 0) {
  const startBounds = editor.getShapePageBounds(startId as any);
  const endBounds = editor.getShapePageBounds(endId as any);
  if (!startBounds || !endBounds) return;

  const arrowId = createShapeId();
  editor.createShape({
    id: arrowId,
    type: "arrow",
    x: 0,
    y: 0,
    props: {
      start: { x: startBounds.center.x, y: startBounds.center.y },
      end: { x: endBounds.center.x, y: endBounds.center.y },
      bend,
      arrowheadEnd: "arrow",
    },
  });

  editor.createBindings([
    {
      type: "arrow",
      fromId: arrowId,
      toId: startId as any,
      props: {
        terminal: "start",
        normalizedAnchor: { x: 0.5, y: 0.5 },
        isExact: false,
        isPrecise: false,
      },
    },
    {
      type: "arrow",
      fromId: arrowId,
      toId: endId as any,
      props: {
        terminal: "end",
        normalizedAnchor: { x: 0.5, y: 0.5 },
        isExact: false,
        isPrecise: false,
      },
    },
  ]);
}

export function addTable(editor: Editor) {
  const { x, y } = getViewportCenter(editor);
  editor.createShape({
    type: "table",
    x: x - 360,
    y: y - 90,
    props: {
      w: 720,
      h: 180,
      rows: 3,
      cols: 6,
      cells: Array.from({ length: 18 }, () => ""),
    },
  });
}

export function addColumn(editor: Editor) {
  const { x, y } = getViewportCenter(editor);
  editor.createShape({
    type: "column",
    x: x - 140,
    y: y - 180,
    props: {
      w: 280,
      h: 360,
      title: "Тайтл",
      cards: ["Start typing...", "Start typing...", "Start typing..."],
    },
  });
}
