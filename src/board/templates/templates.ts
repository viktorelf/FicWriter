import type { Editor } from "tldraw";
import { createArrow, createBox, createColumn, createNote, createTable } from "./builders";

export function clearCanvas(editor: Editor) {
  const ids = Array.from(editor.getCurrentPageShapeIds());
  if (ids.length) editor.deleteShapes(ids);
}

export function addTable(editor: Editor) {
  createTable(editor, 200, 200, 420, 220, 4, 3);
}

export function addColumn(editor: Editor) {
  createColumn(editor, 200, 200, 260, 340, "New Column", ["", "", ""]);
}

export function templateCharacterBoard(editor: Editor) {
  clearCanvas(editor);

  createBox(editor, 260, 80, 780, 70, "Карточка персонажа");

  createColumn(editor, 220, 190, 260, 320, "Профиль", ["Имя", "Возраст", "Роль"]);
  createColumn(editor, 520, 190, 260, 320, "Характер", ["Черты", "Привычки", "Мотивы"]);
  createColumn(editor, 820, 190, 260, 320, "Слабости", ["Страхи", "Триггеры", "Секрет"]);

  createNote(editor, 260, 560, "Роль", "orange");
  createNote(editor, 520, 560, "Бэкстори", "light-green");
  createNote(editor, 780, 560, "Цель", "yellow");
}

export function templateStickyBoard(editor: Editor) {
  clearCanvas(editor);

  createBox(editor, 280, 80, 700, 70, "Доска идей");

  createNote(editor, 320, 200, "Идея 1", "yellow");
  createNote(editor, 520, 200, "Идея 2", "light-green");
  createNote(editor, 720, 200, "Идея 3", "light-blue");

  createNote(editor, 320, 400, "Идея 4", "red");
  createNote(editor, 520, 400, "Идея 5", "orange");
  createNote(editor, 720, 400, "Идея 6", "violet");

  createNote(editor, 520, 600, "Вывод", "yellow");
}

export function templateCauseEffect(editor: Editor) {
  clearCanvas(editor);

  createBox(editor, 300, 80, 700, 70, "Цепочка причин и следствий");

  const cause = createBox(editor, 240, 220, 220, 70, "Причина");
  const effect = createBox(editor, 520, 220, 220, 70, "Следствие");
  const result = createBox(editor, 800, 220, 220, 70, "Результат");

  createArrow(editor, cause, effect);
  createArrow(editor, effect, result);

  createNote(editor, 240, 320, "Фактор 1", "yellow");
  createNote(editor, 520, 320, "Фактор 2", "orange");
  createNote(editor, 800, 320, "Фактор 3", "red");
}

export function templateClassic(editor: Editor) {
  clearCanvas(editor);

  createBox(editor, 420, 100, 520, 70, "Тема / проблема");

  const center = createBox(editor, 520, 260, 320, 80, "Центральная идея");
  const b1 = createNote(editor, 240, 260, "Ветка 1", "yellow");
  const b2 = createNote(editor, 800, 260, "Ветка 2", "light-green");
  const b3 = createNote(editor, 520, 170, "Ветка 3", "light-blue");
  const b4 = createNote(editor, 520, 370, "Ветка 4", "violet");

  createArrow(editor, center, b1);
  createArrow(editor, center, b2);
  createArrow(editor, center, b3);
  createArrow(editor, center, b4);

  const subLeft = createNote(editor, 80, 230, "Подветка", "orange");
  const subRight = createNote(editor, 1040, 230, "Подветка", "red");
  createArrow(editor, b1, subLeft);
  createArrow(editor, b2, subRight);
}
