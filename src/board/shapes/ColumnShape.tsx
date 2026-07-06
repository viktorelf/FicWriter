import {
  BaseBoxShapeUtil,
  HTMLContainer,
  SvgExportContext,
  type TLBaseShape,
  type TLOnResizeHandler,
} from "@tldraw/editor";
import { T } from "@tldraw/validate";

export type ColumnShape = TLBaseShape<
  "column",
  {
    w: number;
    h: number;
    title: string;
    cards: string[];
  }
>;

export class ColumnShapeUtil extends BaseBoxShapeUtil<ColumnShape> {
  static type = "column" as const;
  static props = {
    w: T.number,
    h: T.number,
    title: T.string,
    cards: T.arrayOf(T.string),
  };

  getDefaultProps(): ColumnShape["props"] {
    return { w: 260, h: 340, title: "Колонка", cards: ["", "", ""] };
  }

  indicator(shape: ColumnShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }

  onResize: TLOnResizeHandler<ColumnShape> = (_shape, info) => {
    const nextWidth = Math.abs(info.initialBounds.w * info.scaleX);
    const nextHeight = Math.abs(info.initialBounds.h * info.scaleY);
    return {
      props: {
        w: Math.max(180, nextWidth),
        h: Math.max(200, nextHeight),
      },
    };
  };

  private updateTitle(shape: ColumnShape, value: string) {
    this.editor.updateShapes([
      {
        id: shape.id,
        type: shape.type,
        props: {
          title: value,
        },
      },
    ]);
  }

  private updateCard(shape: ColumnShape, index: number, value: string) {
    const next = shape.props.cards.slice();
    next[index] = value;
    this.editor.updateShapes([
      {
        id: shape.id,
        type: shape.type,
        props: {
          cards: next,
        },
      },
    ]);
  }

  private addCard(shape: ColumnShape) {
    const next = shape.props.cards.slice();
    next.push("");
    const minCardH = 52;
    const headerH = 34;
    const padding = 10;
    const gap = 8;
    const contentH = next.length * minCardH + Math.max(0, next.length - 1) * gap;
    const nextH = Math.max(shape.props.h, headerH + padding * 2 + contentH);
    this.editor.updateShapes([
      {
        id: shape.id,
        type: shape.type,
        props: {
          cards: next,
          h: nextH,
        },
      },
    ]);
  }

  component(shape: ColumnShape) {
    const { w, h, title, cards } = shape.props;

    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: "all" }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 12,
            background: "#ffffff",
            border: "1px solid rgba(0,0,0,0.18)",
            boxShadow: "0 10px 18px rgba(0,0,0,0.08)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              fontWeight: 700,
              fontSize: 13,
              color: "#111",
              borderBottom: "1px solid rgba(0,0,0,0.08)",
              background: "#f7f7f7",
            }}
          >
            <input
              value={title}
              onChange={(event) => this.updateTitle(shape, event.target.value)}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 13,
                fontWeight: 700,
                color: "#111",
                fontFamily: "inherit",
              }}
            />
          </div>
          <div
            style={{
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              overflow: "auto",
            }}
          >
            {cards.length === 0 && (
              <div style={{ fontSize: 12, color: "rgba(0,0,0,0.5)" }}>Пусто</div>
            )}
            {cards.map((card, index) => (
              <textarea
                key={index}
                value={card}
                placeholder="Start typing..."
                onChange={(event) => this.updateCard(shape, index, event.target.value)}
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                style={{
                  borderRadius: 10,
                  padding: "8px 10px",
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.12)",
                  fontSize: 12,
                  color: "#222",
                  minHeight: 48,
                  resize: "vertical",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
            ))}
            <button
              onClick={() => this.addCard(shape)}
              onPointerDown={(event) => event.stopPropagation()}
              style={{
                border: "1px dashed rgba(0,0,0,0.2)",
                background: "transparent",
                color: "#333",
                padding: "6px 8px",
                borderRadius: 8,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              + Добавить строку
            </button>
          </div>
        </div>
      </HTMLContainer>
    );
  }

  toSvg(shape: ColumnShape, _ctx: SvgExportContext) {
    const { w, h, title, cards } = shape.props;
    const headerH = 34;
    const padding = 10;
    const cardH = 52;

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

    return (
      <g>
        <rect width={w} height={h} rx={12} ry={12} fill="#ffffff" stroke="rgba(0,0,0,0.18)" />
        <rect width={w} height={headerH} rx={12} ry={12} fill="#f7f7f7" />
        <line x1={0} y1={headerH} x2={w} y2={headerH} stroke="rgba(0,0,0,0.08)" />
        <text x={12} y={22} fontSize={13} fontWeight={700} fill="#111" fontFamily="Arial, sans-serif">
          {title}
        </text>
        {cards.map((card, index) => {
          const cardY = headerH + padding + index * (cardH + 8);
          const textLines = wrap(card, 24);
          return (
            <g key={`c-${index}`}>
              <rect
                x={padding}
                y={cardY}
                width={w - padding * 2}
                height={cardH}
                rx={10}
                ry={10}
                fill="#ffffff"
                stroke="rgba(0,0,0,0.12)"
              />
              <text
                x={padding + 8}
                y={cardY + 18}
                fontSize={12}
                fill="#222"
                fontFamily="Arial, sans-serif"
              >
                {textLines.map((line, i) => (
                  <tspan key={`cl-${index}-${i}`} x={padding + 8} dy={i === 0 ? 0 : 14}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </g>
    );
  }
}
