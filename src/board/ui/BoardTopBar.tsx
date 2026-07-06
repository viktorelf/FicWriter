import type { Editor } from "tldraw";
import {
  addTable,
  addColumn,
  templateClassic,
  templateCauseEffect,
  templateStickyBoard,
  templateCharacterBoard,
} from "../templates/templates";

export function BoardTopBar({ editor }: { editor: Editor | null }) {
  const disabled = !editor;

  return (
    <div className="board-topbar">
      <button className="pill" disabled={disabled} onClick={() => editor?.setCurrentTool("note")}>
        <span className="pill-icon">🗒</span>
        Стикер
      </button>
      <button className="pill" disabled={disabled} onClick={() => editor?.setCurrentTool("arrow")}>
        <span className="pill-icon">↗</span>
        Стрелка
      </button>
      <button className="pill" disabled={disabled} onClick={() => editor && addTable(editor)}>
        <span className="pill-icon">▦</span>
        Таблица
      </button>
      <button className="pill" disabled={disabled} onClick={() => editor && addColumn(editor)}>
        <span className="pill-icon">▤</span>
        Колонка
      </button>

      <span className="pill-divider" />

      <button className="pill" disabled={disabled} onClick={async () => editor && (await templateClassic(editor))}>
        <span className="pill-icon">✦</span>
        Классика
      </button>
      <button className="pill" disabled={disabled} onClick={async () => editor && (await templateCauseEffect(editor))}>
        <span className="pill-icon">➜</span>
        Причина
      </button>
      <button className="pill" disabled={disabled} onClick={async () => editor && (await templateStickyBoard(editor))}>
        <span className="pill-icon">■</span>
        Стикеры
      </button>
      <button className="pill" disabled={disabled} onClick={async () => editor && (await templateCharacterBoard(editor))}>
        <span className="pill-icon">★</span>
        Персонаж
      </button>
    </div>
  );
}
