import type { Editor } from "tldraw";

export function BoardBottomToolbar({ editor }: { editor: Editor | null }) {
  const disabled = !editor;

  const Tool = ({
    tool,
    label,
    icon,
  }: {
    tool: string;
    label: string;
    icon: string;
  }) => (
    <button
      className="toolbtn"
      disabled={disabled}
      onClick={() => editor?.setCurrentTool(tool)}
      title={label}
      type="button"
    >
      <span className="toolicon">{icon}</span>
    </button>
  );

  return (
    <div className="board-bottombar">
      <Tool tool="select" label="Курсор" icon="▢" />
      <Tool tool="hand" label="Рука" icon="✋" />
      <Tool tool="draw" label="Рисование" icon="✎" />
      <Tool tool="eraser" label="Ластик" icon="⌫" />
      <Tool tool="arrow" label="Стрелка" icon="↗" />
      <Tool tool="text" label="Текст" icon="T" />
      <Tool tool="note" label="Стикер" icon="🗒" />
      <Tool tool="image" label="Фото" icon="🖼" />
      <Tool tool="geo" label="Прямоугольник" icon="▭" />
      <button
        className="toolbtn toolbtn--menu"
        disabled={disabled}
        onClick={() => editor?.setCurrentTool("geo")}
        title="Фигуры"
        type="button"
      >
        ▾
      </button>
    </div>
  );
}
