import { useState } from "react";
import type { Editor } from "tldraw";
import {
  DefaultColorStyle,
  DefaultDashStyle,
  DefaultFillStyle,
  DefaultSizeStyle,
  type TLDefaultColorStyle,
  type TLDefaultDashStyle,
  type TLDefaultFillStyle,
  type TLDefaultSizeStyle,
} from "@tldraw/tlschema";

const COLORS: TLDefaultColorStyle[] = [
  "black",
  "grey",
  "violet",
  "blue",
  "light-blue",
  "green",
  "light-green",
  "yellow",
  "orange",
  "red",
];

export function BoardRightStylePanel({ editor }: { editor: Editor | null }) {
  const [fillColor, setFillColor] = useState<TLDefaultColorStyle>("yellow");
  const [strokeColor, setStrokeColor] = useState<TLDefaultColorStyle>("black");
  const [dash, setDash] = useState<TLDefaultDashStyle>("solid");
  const fill: TLDefaultFillStyle = "solid";
  const [size, setSize] = useState<TLDefaultSizeStyle>("m");

  const disabled = !editor;

  function applyStyles() {
    if (!editor) return;
    editor.setStyleForNextShapes(DefaultColorStyle, fillColor);
    editor.setStyleForNextShapes(DefaultFillStyle, fill);
    editor.setStyleForNextShapes(DefaultDashStyle, dash);
    editor.setStyleForNextShapes(DefaultSizeStyle, size);

    const selected = editor.getSelectedShapeIds();
    if (selected.length > 0) {
      editor.setStyleForSelectedShapes(DefaultColorStyle, fillColor);
      editor.setStyleForSelectedShapes(DefaultFillStyle, fill);
      editor.setStyleForSelectedShapes(DefaultDashStyle, dash);
      editor.setStyleForSelectedShapes(DefaultSizeStyle, size);
    }
  }

  function updateFillColor(next: TLDefaultColorStyle) {
    setFillColor(next);
    applyStyles();
  }

  function updateStrokeColor(next: TLDefaultColorStyle) {
    setStrokeColor(next);
    if (!editor) return;
    editor.setStyleForNextShapes(DefaultColorStyle, next);
    const selected = editor.getSelectedShapeIds();
    if (selected.length > 0) {
      editor.setStyleForSelectedShapes(DefaultColorStyle, next);
    }
  }

  return (
    <div className="board-stylepanel">
      <div className="style-colors">
        {COLORS.map((color) => (
          <button
            key={color}
            className={`dot ${fillColor === color ? "active" : ""}`}
            data-color={color}
            disabled={disabled}
            onClick={() => updateFillColor(color)}
            title={color}
            type="button"
          />
        ))}
      </div>

      <div className="style-row">
        <div className="style-stroke">
          <button
            className={`stroke-btn ${dash === "solid" ? "active" : ""}`}
            disabled={disabled}
            onClick={() => {
              setDash("solid");
              applyStyles();
            }}
            title="Контур"
          >
            <span className="stroke-solid" />
          </button>
          <button
            className={`stroke-btn ${dash === "dashed" ? "active" : ""}`}
            disabled={disabled}
            onClick={() => {
              setDash("dashed");
              applyStyles();
            }}
            title="Пунктир"
          >
            <span className="stroke-dashed" />
          </button>
          <button
            className={`stroke-btn ${dash === "dotted" ? "active" : ""}`}
            disabled={disabled}
            onClick={() => {
              setDash("dotted");
              applyStyles();
            }}
            title="Точки"
          >
            <span className="stroke-dotted" />
          </button>
        </div>
        <div className="stroke-colors">
          {COLORS.slice(0, 6).map((color) => (
            <button
              key={color}
              className={`dot dot--small ${strokeColor === color ? "active" : ""}`}
              data-color={color}
              disabled={disabled}
              onClick={() => updateStrokeColor(color)}
              title={`Контур ${color}`}
              type="button"
            />
          ))}
        </div>
      </div>

      <div className="style-row style-shapes">
        {["rect", "ellipse", "diamond", "triangle"].map((shape) => (
          <button
            key={shape}
            className="shape-btn"
            disabled={disabled}
            title="Фигура"
            onClick={() => editor?.setCurrentTool("geo")}
          >
            <span className={`shape-icon shape-${shape}`} />
          </button>
        ))}
      </div>

      <div className="style-sizes">
        {(["s", "m", "l", "xl"] as TLDefaultSizeStyle[]).map((value) => (
          <button
            key={value}
            className={`size-btn ${size === value ? "active" : ""}`}
            disabled={disabled}
            onClick={() => {
              setSize(value);
              applyStyles();
            }}
            title={value.toUpperCase()}
          >
            {value.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
