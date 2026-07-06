import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

declare global {
  interface Window {
    __fwBeforeWindowClose?: (() => Promise<boolean> | boolean) | null;
  }
}

type Props = { title?: string };

export default function TitleBar({ title = "FicWriter" }: Props) {
  const win = getCurrentWindow();
  const [isMax, setIsMax] = useState(false);
  const dragTimerRef = useRef<number | null>(null);

  const setDragging = useCallback((value: boolean) => {
    document.body.classList.toggle("is-window-drag", value);
  }, []);

  const pingDragging = useCallback(() => {
    setDragging(true);
    if (dragTimerRef.current !== null) {
      window.clearTimeout(dragTimerRef.current);
    }
    dragTimerRef.current = window.setTimeout(() => {
      setDragging(false);
      dragTimerRef.current = null;
    }, 120);
  }, [setDragging]);

  const syncMax = useCallback(async () => {
    try {
      setIsMax(await win.isMaximized());
    } catch {}
  }, [win]);

  useEffect(() => {
    syncMax();
    const onFocus = () => syncMax();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [syncMax]);

  useEffect(() => {
    const stop = () => setDragging(false);
    window.addEventListener("mouseup", stop);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("blur", stop);
    };
  }, [setDragging]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let alive = true;

    (async () => {
      try {
        const u = await win.onMoved(() => pingDragging());
        if (alive) unlisten = u;
        else u();
      } catch {}
    })();

    return () => {
      alive = false;
      if (unlisten) unlisten();
      if (dragTimerRef.current !== null) {
        window.clearTimeout(dragTimerRef.current);
        dragTimerRef.current = null;
      }
      setDragging(false);
    };
  }, [pingDragging, setDragging, win]);

  const onMinimize = async () => win.minimize();

  const onToggleMax = async () => {
    const m = await win.isMaximized();
    if (m) await win.unmaximize();
    else await win.maximize();
    await syncMax();
  };

  const onClose = async () => {
    const guard = window.__fwBeforeWindowClose;
    if (guard) {
      const shouldClose = await guard();
      if (!shouldClose) return;
    }

    await win.close();
  };

  return (
    <div
      className="fw-titlebar"
      data-tauri-drag-region
      onMouseDown={() => setDragging(true)}
      onMouseUp={() => setDragging(false)}
    >
      {/* Левая зона (drag) */}
      <div className="fw-titlebar__drag" data-tauri-drag-region>
        <div className="fw-titlebar__left" data-tauri-drag-region>
          {/* ПЕРО */}
          <div className="fw-titlebar__logo" aria-hidden="true" data-tauri-drag-region>
            <svg
              className="fw-logo-ico"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20.2 3.8c-3.9-2.2-9.2.9-12.9 4.6C4 11.7 2.5 15.1 3 18.6c.1.7.7 1.3 1.4 1.4 3.5.5 6.9-1 10.2-4.3 3.7-3.7 6.8-9 4.6-12.9Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M9 15l-3 6 6-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M8 16c2.5 0 5-1.2 7.4-3.6C17.8 10 19 7.5 19 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="fw-titlebar__title" data-tauri-drag-region>
            {title}
          </div>
        </div>
      </div>

      {/* Кнопки (не drag) */}
      <div className="fw-titlebar__right">
        <button className="fw-winbtn" onClick={onMinimize} title="Свернуть">
          —
        </button>

        <button
          className="fw-winbtn"
          onClick={onToggleMax}
          title={isMax ? "Восстановить" : "Развернуть"}
        >
          {isMax ? "🗗" : "▢"}
        </button>

        <button className="fw-winbtn fw-winbtn--close" onClick={onClose} title="Закрыть">
          ✕
        </button>
      </div>
    </div>
  );
}
