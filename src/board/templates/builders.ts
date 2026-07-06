import { createShapeId, type Editor, type TLShapeId } from "tldraw";

export function createNote(
  editor: Editor,
  x: number,
  y: number,
  text: string,
  color = "yellow"
): TLShapeId {
  const id = createShapeId();
  editor.createShapes([
    {
      id,
      type: "note",
      x,
      y,
      props: {
        text,
        color,
      },
    },
  ]);
  return id;
}

export function createText(editor: Editor, x: number, y: number, text: string): TLShapeId {
  const id = createShapeId();
  editor.createShapes([
    {
      id,
      type: "text",
      x,
      y,
      props: {
        text,
      },
    },
  ]);
  return id;
}

export function createBox(
  editor: Editor,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string
): TLShapeId {
  const id = createShapeId();
  editor.createShapes([
    {
      id,
      type: "geo",
      x,
      y,
      props: {
        geo: "rectangle",
        w,
        h,
        color: "black",
        fill: "solid",
        text,
      },
    },
  ]);
  return id;
}

export function createTable(
  editor: Editor,
  x: number,
  y: number,
  w: number,
  h: number,
  rows = 4,
  cols = 3
): TLShapeId {
  const id = createShapeId();
  editor.createShapes([
    {
      id,
      type: "table",
      x,
      y,
      props: {
        w,
        h,
        rows,
        cols,
        cells: [],
      },
    },
  ]);
  return id;
}

export function createColumn(
  editor: Editor,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  cards: string[] = []
): TLShapeId {
  const id = createShapeId();
  editor.createShapes([
    {
      id,
      type: "column",
      x,
      y,
      props: {
        w,
        h,
        title,
        cards,
      },
    },
  ]);
  return id;
}

export function createArrow(editor: Editor, startId: TLShapeId, endId: TLShapeId) {
  const startBounds = editor.getShapePageBounds(startId);
  const endBounds = editor.getShapePageBounds(endId);
  const startPoint = startBounds
    ? { x: startBounds.x + startBounds.w / 2, y: startBounds.y + startBounds.h / 2 }
    : { x: 0, y: 0 };
  const endPoint = endBounds
    ? { x: endBounds.x + endBounds.w / 2, y: endBounds.y + endBounds.h / 2 }
    : { x: 0, y: 0 };
  const baseX = Math.min(startPoint.x, endPoint.x);
  const baseY = Math.min(startPoint.y, endPoint.y);
  const startLocal = { x: startPoint.x - baseX, y: startPoint.y - baseY };
  const endLocal = { x: endPoint.x - baseX, y: endPoint.y - baseY };

  const arrowId = createShapeId();
  editor.createShapes([
    {
      id: arrowId,
      type: "arrow",
      x: baseX,
      y: baseY,
      props: {
        start: startLocal,
        end: endLocal,
        color: "black",
      },
    },
  ]);
  editor.createBindings([
    {
      type: "arrow",
      fromId: arrowId,
      toId: startId,
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
      toId: endId,
      props: {
        terminal: "end",
        normalizedAnchor: { x: 0.5, y: 0.5 },
        isExact: false,
        isPrecise: false,
      },
    },
  ]);
}
