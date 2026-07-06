import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import {
  ensureWallpaperSystem,
  getSelectedWallpaperCssValue,
  WALLPAPER_CHANGED_EVENT,
} from "../store/wallpapersStore";
import TitleBar from "../components/TitleBar";
import { ConfirmProvider } from "../components/ConfirmProvider";

function preloadCssBackground(cssVal: string) {
  // ожидаем строку вида: url("...") или url(...)
  const m = cssVal.match(/url\((['"]?)(.*?)\1\)/i);
  const url = m?.[2];
  if (!url) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // не блокируемся на ошибке
    img.src = url;
  });
}

export default function RootLayout() {
  const [bg, setBg] = useState<string>("none");

  const refreshBg = useCallback(async () => {
    try {
      await ensureWallpaperSystem();
      const cssVal = await getSelectedWallpaperCssValue(); // например: url("asset:...")
      if (!cssVal) {
        setBg("none");
        return;
      }

      // ✅ сначала грузим, потом применяем
      await preloadCssBackground(cssVal);
      setBg(cssVal);
    } catch {
      setBg("none");
    }
  }, []);

  useEffect(() => {
    refreshBg();

    const onChange = () => refreshBg();
    window.addEventListener(WALLPAPER_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(WALLPAPER_CHANGED_EVENT, onChange);
  }, [refreshBg]);

  return (
    <ConfirmProvider>
      <div className="app-shell" style={{ ["--app-wallpaper" as any]: bg }}>
        <div className="app-wallpaper" />
        <div className="app-overlay" />
        <div className="app-content">
          <TitleBar title="FicWriter" />
          <Outlet />
        </div>
      </div>
    </ConfirmProvider>
  );
}
