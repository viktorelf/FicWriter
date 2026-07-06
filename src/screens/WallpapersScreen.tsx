import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteUserWallpaper,
  getSelectedWallpaperId,
  importWallpaperFromPc,
  loadAllWallpapers,
  setSelectedWallpaper,
  type WallpaperItem,
} from "../store/wallpapersStore";
import { appDataDir, join } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";
import { confirm } from "../components/confirmService";

function builtinAssetUrl(assetKey: string) {
  // важно: расширение .jpg (если sunset.png — лучше переименовать в sunset.jpg)
  return new URL(`../assets/wallpapers/${assetKey}.png`, import.meta.url).href;
}

async function toPreviewSrc(item: WallpaperItem) {
  try {
    if (item.kind === "builtin" && item.assetKey) {
      return builtinAssetUrl(item.assetKey);
    }

    if (item.kind === "user" && item.relPath) {
      const base = await appDataDir();
      const abs = await join(base, "ficwriter", item.relPath.replace(/\\/g, "/"));
      return `${convertFileSrc(abs)}?v=${Date.now()}`;
    }
  } catch (err) {
    console.warn("wallpaper preview error", item.id, err);
  }

  return null;
}

export default function WallpapersScreen() {
  const DEFAULT_WALLPAPER_ID = "builtin:bridgerton";
  const nav = useNavigate();

  const [items, setItems] = useState<WallpaperItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [srcMap, setSrcMap] = useState<Record<string, string>>({});

  const selectedIndex = useMemo(
    () => items.findIndex((x) => x.id === (selectedId ?? DEFAULT_WALLPAPER_ID)),
    [items, selectedId]
  );

  async function refreshAll() {
    const all = await loadAllWallpapers();
    setItems(all);

    const sel = await getSelectedWallpaperId();
    setSelectedId(sel);

    // превью-источники
    const map: Record<string, string> = {};
    for (const w of all) {
      try {
        const src = await toPreviewSrc(w);
        if (src) map[w.id] = src;
      } catch (err) {
        console.warn("wallpaper preview build error", w.id, err);
      }
    }
    setSrcMap(map);

    // верхнее превью
    if (sel && map[sel]) setPreviewSrc(map[sel]);
    else if (map[DEFAULT_WALLPAPER_ID]) setPreviewSrc(map[DEFAULT_WALLPAPER_ID]);
    else if (all[0] && map[all[0].id]) setPreviewSrc(map[all[0].id]);
    else setPreviewSrc(null);
  }

  useEffect(() => {
    refreshAll();
  }, []);

  async function onPickFromPc() {
    const added = await importWallpaperFromPc();
    if (!added) return;

    // сразу применяем
    await setSelectedWallpaper(added.id);
    await refreshAll();
  }

  async function onApply(id: string) {
    setSelectedId(id);
    setPreviewSrc(srcMap[id] ?? null);
    await setSelectedWallpaper(id);
  }

  async function onReset() {
    await setSelectedWallpaper(DEFAULT_WALLPAPER_ID);
    await refreshAll();
  }

  async function onDelete(id: string) {
    const ok = await confirm("Удалить эти обои? Они исчезнут из списка.", {
      title: "Подтверждение",
      kind: "warning",
      okLabel: "Удалить",
      cancelLabel: "Отмена",
    });
    if (!ok) return;

    await deleteUserWallpaper(id);
    await refreshAll();
  }

  return (
    <div className="app-root" style={{ padding: 24 }}>
      {/* top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="ghost-btn" onClick={() => nav("/")}>
          ← Назад
        </button>

        <div style={{ fontSize: 20, fontWeight: 700 }}>Тема</div>

        <div style={{ flex: 1 }} />

        <button className="ghost-btn" onClick={onReset} title="Сбросить к стандартной теме">
          ↩ Сбросить по умолчанию
        </button>
      </div>

      {/* main card */}
      <div
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(20,20,24,0.58)",
          backdropFilter: "blur(6px)",
        }}
      >
        {/* header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 700, opacity: 0.9 }}>Тема изображения</div>
          <div style={{ flex: 1 }} />
          <button className="primary-btn" onClick={onPickFromPc}>
            + Добавить обои
          </button>
        </div>

        {/* preview */}
        <div
          style={{
            marginTop: 14,
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.25)",
          }}
        >
          <div
            style={{
              height: 260,
              backgroundImage: previewSrc ? `url(${previewSrc})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "saturate(1.05) contrast(1.05)",
            }}
          />
          <div
            style={{
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderTop: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <div style={{ opacity: 0.8, fontSize: 13 }}>
              {selectedIndex >= 0 ? `Выбрано: № ${selectedIndex + 1}` : "Выбрана стандартная тема"}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ opacity: 0.55, fontSize: 12 }}>Применяется ко всем экранам</div>
          </div>
        </div>

        {/* grid */}
        <div style={{ marginTop: 14, opacity: 0.75, fontSize: 12 }}>
          Стандартные и ваши обои (клик — применить)
        </div>

        <div
          className="wallpapers-scroll"
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            gap: 12,
            maxHeight: "calc(100vh - 560px)",
            overflowY: "auto",
            paddingRight: 6,
          }}
        >
          {items.map((w, idx) => {
            const src = srcMap[w.id];
            const active = w.id === (selectedId ?? DEFAULT_WALLPAPER_ID);
            const displayTitle = String(idx + 1);

            return (
              <div
                key={w.id}
                role="button"
                tabIndex={0}
                onClick={() => onApply(w.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onApply(w.id);
                }}
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  border: active
                    ? "2px solid rgba(255,255,255,0.65)"
                    : "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(0,0,0,0.25)",
                  cursor: "pointer",
                  position: "relative",
                }}
                title={w.title}
              >
                <div
                  style={{
                    height: 110,
                    backgroundImage: src ? `url(${src})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    opacity: src ? 1 : 0.35,
                  }}
                />

                <div style={{ padding: "10px 10px 12px 10px" }}>
                  <div style={{ fontSize: 13, fontWeight: 650 }}>{displayTitle}</div>
                  <div style={{ opacity: 0.65, fontSize: 12, marginTop: 3 }}>
                    {w.kind === "builtin" ? "Стандартные" : "Мои обои"}
                  </div>
                </div>

                {w.kind === "user" && (
                  <button
                    className="ghost-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete(w.id);
                    }}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: 8,
                      padding: "6px 8px",
                      borderRadius: 10,
                      background: "rgba(0,0,0,0.45)",
                      border: "1px solid rgba(255,255,255,0.14)",
                    }}
                    title="Удалить"
                  >
                    🗑️
                  </button>
                )}

                {active && (
                  <div
                    style={{
                      position: "absolute",
                      left: 8,
                      top: 8,
                      padding: "6px 8px",
                      borderRadius: 10,
                      background: "rgba(0,0,0,0.55)",
                      border: "1px solid rgba(255,255,255,0.18)",
                      fontSize: 12,
                    }}
                  >
                    ✓ Активно
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
