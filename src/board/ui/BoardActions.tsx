import type { Editor } from "tldraw";
import { clearCanvas } from "../templates/templates";

export function BoardActions({
  editor,
  onBack,
  onSave,
}: {
  editor: Editor | null;
  onBack: () => void | Promise<void>;
  onSave: () => boolean | Promise<boolean>;
}) {
  const disabled = !editor;

  return (
    <div className="board-actions">
      <button className="action-btn" onClick={onBack} type="button">
        Назад
      </button>
      <button
        className="action-btn"
        disabled={disabled}
        onClick={() => onSave()}
        type="button"
      >
        Сохранить
      </button>
      <button
        className="action-btn danger"
        disabled={disabled}
        onClick={() => editor && clearCanvas(editor)}
        type="button"
      >
        Очистить
      </button>
    </div>
  );
}

