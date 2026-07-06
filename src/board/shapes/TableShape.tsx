import {
  BaseBoxShapeUtil,
  HTMLContainer,
  SvgExportContext,
  type TLBaseShape,
  type TLOnResizeHandler,
} from "@tldraw/editor";
import { T } from "@tldraw/validate";

export type TableShape = TLBaseShape<
  "table",
  {
    w: number;
    h: number;
    rows: number;
    cols: number;
    cells: string[];
  }
>;

export class TableShapeUtil extends BaseBoxShapeUtil<TableShape> {
  static type = "table" as const;
  static props = {
    w: T.number,
    h: T.number,
    rows: T.number,
    cols: T.number,
    cells: T.arrayOf(T.string),
  };

  getDefaultProps(): TableShape["props"] {
    return { w: 480, h: 240, rows: 3, cols: 4, cells: [] };
  }

  indicator(shape: TableShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }

  onResize: TLOnResizeHandler<TableShape> = (_shape, info) => {
    const nextWidth = Math.abs(info.initialBounds.w * info.scaleX);
    const nextHeight = Math.abs(info.initialBounds.h * info.scaleY);
    return {
      props: {
        w: Math.max(200, nextWidth),
        h: Math.max(120, nextHeight),
      },
    };
  };

  private updateCell(shape: TableShape, index: number, value: string) {
    const next = shape.props.cells.slice();
    next[index] = value;
    this.editor.updateShapes([
      {
        id: shape.id,
        type: shape.type,
        props: {
          cells: next,
        },
      },
    ]);
  }

  private addRow(shape: TableShape) {
    const { rows, cols, cells } = shape.props;
    const nextRows = rows + 1;
    const nextCells = cells.slice();
    for (let i = 0; i < cols; i += 1) nextCells.push("");
    const minCellH = 36;
    const nextH = Math.max(shape.props.h, nextRows * minCellH);
    this.editor.updateShapes([
      {
        id: shape.id,
        type: shape.type,
        props: {
          rows: nextRows,
          cells: nextCells,
          h: nextH,
        },
      },
    ]);
  }

  private addCol(shape: TableShape) {
    const { rows, cols, cells } = shape.props;
    const nextCols = cols + 1;
    const nextCells: string[] = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < nextCols; c += 1) {
        if (c === nextCols - 1) {
          nextCells.push("");
        } else {
          nextCells.push(cells[r * cols + c] ?? "");
        }
      }
    }
    const minCellW = 120;
    const nextW = Math.max(shape.props.w, nextCols * minCellW);
    this.editor.updateShapes([
      {
        id: shape.id,
        type: shape.type,
        props: {
          cols: nextCols,
          cells: nextCells,
          w: nextW,
        },
      },
    ]);
  }

  component(shape: TableShape) {
    const { w, h, rows, cols, cells } = shape.props;
    const cellW = w / cols;
    const cellH = h / rows;

    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: "all" }}>
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <div
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              display: "flex",
              gap: 6,
              zIndex: 2,
            }}
          >
            <button
              onClick={() => this.addRow(shape)}
              onPointerDown={(event) => event.stopPropagation()}
              style={{
                border: "1px solid rgba(0,0,0,0.18)",
                background: "#fff",
                color: "#111",
                padding: "2px 6px",
                borderRadius: 6,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              + строка
            </button>
            <button
              onClick={() => this.addCol(shape)}
              onPointerDown={(event) => event.stopPropagation()}
              style={{
                border: "1px solid rgba(0,0,0,0.18)",
                background: "#fff",
                color: "#111",
                padding: "2px 6px",
                borderRadius: 6,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              + столбец
            </button>
          </div>
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 10,
              background: "#ffffff",
              border: "1px solid rgba(0,0,0,0.2)",
              overflow: "hidden",
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, 1fr)`,
            }}
          >
            {Array.from({ length: rows * cols }).map((_, index) => (
              <div
                key={index}
                style={{
                  borderRight: (index + 1) % cols === 0 ? "none" : "1px solid rgba(0,0,0,0.12)",
                  borderBottom: index >= cols * (rows - 1) ? "none" : "1px solid rgba(0,0,0,0.12)",
                  background: index < cols ? "#f0f0f0" : "transparent",
                  minWidth: cellW,
                  minHeight: cellH,
                  padding: 6,
                  display: "flex",
                  alignItems: "stretch",
                  justifyContent: "stretch",
                }}
              >
                <textarea
                  value={cells[index] ?? ""}
                  onChange={(event) => this.updateCell(shape, index, event.target.value)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    outline: "none",
                    resize: "none",
                    background: "transparent",
                    fontSize: 12,
                    color: "#222",
                    lineHeight: 1.3,
                    fontFamily: "inherit",
                    fontWeight: index < cols ? 600 : 400,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </HTMLContainer>
    );
  }

  toSvg(shape: TableShape, _ctx: SvgExportContext) {
    const { w, h, rows, cols, cells } = shape.props;
    const cellW = w / cols;
    const cellH = h / rows;

    const wrap = (text: string, maxChars: number) => {
      const lines: string[] = [];
      const parts = text.split("\n");
      for (const part of parts) {
        let rest = part;
        while (rest.length > maxChars) {
          lines.push(rest.slice(0, maxChars));
          rest = rest.slice(maxChars);
        }
        lines.push(rest);
      }
      return lines.filter((l, i, arr) => !(l === "" && i === arr.length - 1));
    };

    const texts = Array.from({ length: rows * cols }).map((_, index) => {
      const text = cells[index] ?? "";
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = col * cellW;
      const y = row * cellH;
      const lines = wrap(text, 18);
      return (
        <text
          key={`t-${index}`}
          x={x + 8}
          y={y + 16}
          fontSize={12}
          fill="#222"
          fontFamily="Arial, sans-serif"
        >
          {lines.map((line, i) => (
            <tspan key={`l-${index}-${i}`} x={x + 8} dy={i === 0 ? 0 : 14}>
              {line}
            </tspan>
          ))}
        </text>
      );
    });

    return (
      <g>
        <rect width={w} height={h} rx={10} ry={10} fill="#ffffff" stroke="rgba(0,0,0,0.2)" />
        {Array.from({ length: cols }).map((_, c) => (
          <rect
            key={`hdr-${c}`}
            x={c * cellW}
            y={0}
            width={cellW}
            height={cellH}
            fill="#f0f0f0"
          />
        ))}
        {Array.from({ length: cols - 1 }).map((_, c) => (
          <line
            key={`v-${c}`}
            x1={(c + 1) * cellW}
            y1={0}
            x2={(c + 1) * cellW}
            y2={h}
            stroke="rgba(0,0,0,0.12)"
          />
        ))}
        {Array.from({ length: rows - 1 }).map((_, r) => (
          <line
            key={`h-${r}`}
            x1={0}
            y1={(r + 1) * cellH}
            x2={w}
            y2={(r + 1) * cellH}
            stroke="rgba(0,0,0,0.12)"
          />
        ))}
        {texts}
      </g>
    );
  }
}
