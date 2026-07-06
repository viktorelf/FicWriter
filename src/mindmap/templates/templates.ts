import type { Editor } from "tldraw";
import {
  askReplace,
  clearCanvas,
  createArrowBetween,
  createGeoBlock,
  createNote,
  getViewportCenter,
  addTable,
  addColumn,
} from "./builders";

export { addTable, addColumn, clearCanvas };

export async function templateClassic(editor: Editor) {
  if (!(await askReplace(editor))) return;
  clearCanvas(editor);

  const { x, y } = getViewportCenter(editor);
  const cx = x;
  const cy = y;

  const centralId = createGeoBlock(editor, cx - 160, cy - 55, 320, 110, "Центральная идея");
  createGeoBlock(editor, cx - 220, cy - 220, 440, 60, "Тема / проблема");

  const branch1Id = createNote(editor, cx - 360, cy - 60, "Ветка 1", "yellow");
  const branch2Id = createNote(editor, cx + 220, cy - 60, "Ветка 2", "green");
  const branch3Id = createNote(editor, cx - 60, cy - 240, "Ветка 3", "blue");
  const branch4Id = createNote(editor, cx - 60, cy + 150, "Ветка 4", "violet");

  createArrowBetween(editor, centralId, branch1Id, -12);
  createArrowBetween(editor, centralId, branch2Id, 12);
  createArrowBetween(editor, centralId, branch3Id, 0);
  createArrowBetween(editor, centralId, branch4Id, 0);

  const subLeftId = createNote(editor, cx - 520, cy - 160, "Подветка", "orange");
  const subRightId = createNote(editor, cx + 420, cy - 160, "Подветка", "red");
  createArrowBetween(editor, branch1Id, subLeftId, -18);
  createArrowBetween(editor, branch2Id, subRightId, 18);
}

export async function templateCauseEffect(editor: Editor) {
  if (!(await askReplace(editor))) return;
  clearCanvas(editor);

  const { x, y } = getViewportCenter(editor);
  const ox = x - 420;
  const oy = y - 220;

  createGeoBlock(editor, ox + 160, oy, 420, 60, "Цепочка причин и следствий");
  const causeId = createGeoBlock(editor, ox, oy + 160, 200, 80, "Причина");
  const effectId = createGeoBlock(editor, ox + 260, oy + 160, 200, 80, "Следствие");
  const resultId = createGeoBlock(editor, ox + 520, oy + 160, 200, 80, "Результат");

  const factor1Id = createNote(editor, ox, oy + 260, "Фактор 1", "yellow");
  const factor2Id = createNote(editor, ox + 260, oy + 260, "Фактор 2", "orange");
  const factor3Id = createNote(editor, ox + 520, oy + 260, "Фактор 3", "red");

  createArrowBetween(editor, causeId, effectId, 8);
  createArrowBetween(editor, effectId, resultId, 8);
  createArrowBetween(editor, causeId, factor1Id, 0);
  createArrowBetween(editor, effectId, factor2Id, 0);
  createArrowBetween(editor, resultId, factor3Id, 0);
}

export async function templateStickyBoard(editor: Editor) {
  if (!(await askReplace(editor))) return;
  clearCanvas(editor);

  const { x, y } = getViewportCenter(editor);
  const ox = x - 420;
  const oy = y - 300;

  createGeoBlock(editor, ox + 60, oy, 560, 70, "Доска идей");
  createNote(editor, ox + 120, oy + 90, "Идея 1", "yellow");
  createNote(editor, ox + 300, oy + 90, "Идея 2", "green");
  createNote(editor, ox + 480, oy + 90, "Идея 3", "blue");
  createNote(editor, ox + 120, oy + 270, "Идея 4", "red");
  createNote(editor, ox + 300, oy + 270, "Идея 5", "orange");
  createNote(editor, ox + 480, oy + 270, "Идея 6", "violet");
  createNote(editor, ox + 300, oy + 450, "Вывод", "yellow");
}

export async function templateCharacterBoard(editor: Editor) {
  if (!(await askReplace(editor))) return;
  clearCanvas(editor);

  const { x, y } = getViewportCenter(editor);
  const ox = x - 480;
  const oy = y - 320;

  createGeoBlock(editor, ox + 60, oy, 860, 60, "Карточка персонажа");

  editor.createShape({
    type: "column",
    x: ox + 60,
    y: oy + 80,
    props: { w: 280, h: 360, title: "Профиль", cards: ["Имя", "Возраст", "Роль"] },
  });
  createNote(editor, ox + 60, oy + 460, "Роль", "yellow");

  editor.createShape({
    type: "column",
    x: ox + 360,
    y: oy + 80,
    props: { w: 280, h: 360, title: "Характер", cards: ["Черты", "Привычки", "Мотивы"] },
  });

  editor.createShape({
    type: "column",
    x: ox + 660,
    y: oy + 80,
    props: { w: 280, h: 360, title: "Слабости", cards: ["Страхи", "Триггеры", "Секрет"] },
  });

  createNote(editor, ox + 360, oy + 460, "Бэкстори", "green");
  createNote(editor, ox + 660, oy + 460, "Цель", "yellow");
}
