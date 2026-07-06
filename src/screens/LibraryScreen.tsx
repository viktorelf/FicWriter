import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  cleanupAllProjectsAssets,
  createProject,
  loadProjectsSafe,
  setProjectPinned,
  type Project,
} from "../store/projectsStore";
import { convertFileSrc } from "@tauri-apps/api/core";
import { join, appDataDir } from "@tauri-apps/api/path";
import { confirm } from "../components/confirmService";
import pinIcon from "../assets/pin.png";

type LibraryProjectView = Project & {
  chaptersCount: number;
  updatedLabel: string;
};

async function coverToSrc(projectId: string, rel: string | undefined, v?: number) {
  if (!rel) return null;

  const base = await appDataDir();
  const parts = rel.replace(/\\/g, "/").split("/").filter(Boolean);
  const abs = await join(base, "ficwriter", "projects", projectId, ...parts);

  const ver = v ?? Date.now();
  return `${convertFileSrc(abs)}?v=${ver}`;
}

function formatUpdatedLabel(project: Project) {
  const timestamp =
    project.chapters && project.chapters.length
      ? Math.max(...project.chapters.map((chapter) => chapter.updatedAt || chapter.createdAt))
      : project.createdAt;

  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function LibraryScreen() {
  const nav = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [coverSrc, setCoverSrc] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const refreshInFlightRef = useRef(false);
  const lastRefreshAtRef = useRef(0);

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupInfo, setCleanupInfo] = useState<string | null>(null);
  const [pinBusyId, setPinBusyId] = useState<string | null>(null);
  const [showLibraryScrollbar, setShowLibraryScrollbar] = useState(false);

  async function refreshProjects() {
    if (refreshInFlightRef.current) return;
    const now = Date.now();
    if (now - lastRefreshAtRef.current < 800) return;
    refreshInFlightRef.current = true;
    lastRefreshAtRef.current = now;

    setStatus("loading");
    setError(null);

    try {
      const list = await loadProjectsSafe();
      setProjects(list);
      setStatus("ready");
    } catch (e: any) {
      setError(e?.message ?? "Ошибка загрузки проектов");
      setStatus("error");
    } finally {
      refreshInFlightRef.current = false;
    }
  }

  useEffect(() => {
    void refreshProjects();
  }, []);

  useEffect(() => {
    document.body.classList.add("is-library");
    return () => document.body.classList.remove("is-library");
  }, []);

  useEffect(() => {
    try {
      setShowLibraryScrollbar(localStorage.getItem("ficwriter.library.visibleScrollbar") === "1");
    } catch {
      setShowLibraryScrollbar(false);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("ficwriter.library.visibleScrollbar", showLibraryScrollbar ? "1" : "0");
    } catch {
      // ignore storage failures and keep the preference in memory
    }
  }, [showLibraryScrollbar]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshProjects();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const view = useMemo<LibraryProjectView[]>(() => {
    return projects.map((project) => ({
      ...project,
      chaptersCount: project.chapters?.length ?? 0,
      updatedLabel: formatUpdatedLabel(project),
    }));
  }, [projects]);

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();

  const filteredView = useMemo(() => {
    if (!normalizedSearch) return view;
    return view.filter((project) => project.title.toLocaleLowerCase().includes(normalizedSearch));
  }, [normalizedSearch, view]);

  const pinnedProjects = useMemo(() => {
    return [...filteredView]
      .filter((project) => typeof project.pinnedAt === "number" && project.pinnedAt > 0)
      .sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0));
  }, [filteredView]);

  useEffect(() => {
    let alive = true;

    (async () => {
      const map: Record<string, string> = {};

      for (const project of projects) {
        const src = await coverToSrc(project.id, project.cover, project.updatedAt ?? project.createdAt);
        if (src) map[project.id] = src;
      }

      if (alive) setCoverSrc(map);
    })();

    return () => {
      alive = false;
    };
  }, [projects]);

  async function onCreateProject() {
    const title = newProjectTitle.trim();
    if (!title) return;

    setCreatingProject(true);
    try {
      const project = await createProject({ title });
      setShowCreateProject(false);
      setNewProjectTitle("");
      nav(`/project/${project.id}`);
    } catch (e: any) {
      alert(e?.message ?? "Ошибка создания фанфика");
    } finally {
      setCreatingProject(false);
    }
  }

  async function onCleanupAllAssets() {
    if (cleanupRunning) return;
    const ok = await confirm(
      "Удалить старые обложки и неиспользуемые аватары во всех фанфиках?",
      { title: "Очистка файлов", kind: "warning", okLabel: "Очистить", cancelLabel: "Отмена" }
    );
    if (!ok) return;

    setCleanupRunning(true);
    setCleanupInfo(null);
    try {
      const res = await cleanupAllProjectsAssets();
      setCleanupInfo(`Удалено файлов: ${res.removed}`);
    } catch (e: any) {
      setCleanupInfo(`Ошибка очистки: ${e?.message ?? e}`);
    } finally {
      setCleanupRunning(false);
    }
  }

  async function onTogglePin(projectId: string, nextPinned: boolean) {
    if (pinBusyId) return;

    const nextPinnedAt = nextPinned ? Date.now() : null;
    const previous = projects;

    setPinBusyId(projectId);
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? { ...project, pinnedAt: nextPinnedAt, updatedAt: project.updatedAt ?? project.createdAt }
          : project
      )
    );

    try {
      const updated = await setProjectPinned(projectId, nextPinned);
      setProjects((current) => current.map((project) => (project.id === projectId ? updated : project)));
    } catch (e: any) {
      setProjects(previous);
      alert(e?.message ?? "Не удалось обновить закреп фанфика");
    } finally {
      setPinBusyId(null);
    }
  }

  function renderCard(project: LibraryProjectView, source: "pinned" | "all") {
    const isPinned = typeof project.pinnedAt === "number" && project.pinnedAt > 0;

    return (
      <div
        key={`${source}-${project.id}`}
        className={`book-card ${source === "pinned" ? "book-card-pinned" : ""}`}
        onClick={() => nav(`/project/${project.id}`)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            nav(`/project/${project.id}`);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div
          className="book-cover"
          style={
            coverSrc[project.id]
              ? {
                  backgroundImage: `url(${coverSrc[project.id]})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <button
            className={`book-pin-btn ${isPinned ? "is-active" : ""}`}
            type="button"
            title={isPinned ? "Убрать из закреплённых" : "Закрепить сверху"}
            aria-label={isPinned ? "Убрать из закреплённых" : "Закрепить сверху"}
            disabled={pinBusyId === project.id}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void onTogglePin(project.id, !isPinned);
            }}
          >
            <img src={pinIcon} alt="" className="book-pin-btn-icon" />
          </button>
        </div>

        <div className="book-meta">
          <div className="book-title">{project.title}</div>
          <div className="book-info">
            {project.chaptersCount} глав(ы) · {project.updatedLabel}
          </div>
        </div>
      </div>
    );
  }

  const hasProjects = view.length > 0;
  const hasSearch = normalizedSearch.length > 0;
  const hasFilteredProjects = filteredView.length > 0;

  return (
    <div className="app-root">
      <div className="library-bg">
        <div className="library-topbar">
          <div className="library-bar">
            <h1 className="library-title">Библиотека</h1>

            <div className="library-actions">
              <button className="primary-btn topbar-btn" onClick={() => setShowCreateProject(true)}>
                + Новый фанфик
              </button>

              <button className="ghost-btn topbar-btn" onClick={() => nav("/notes")}>
                Блокнот
              </button>
              <button className="ghost-btn topbar-btn" onClick={() => nav("/wallpapers")}>
                <span>Обои</span>
              </button>
              <button className="ghost-btn topbar-btn" onClick={() => nav("/board")}>
                Интерактивная доска
              </button>
              <button className="topbar-gear" onClick={() => setShowSettings(true)} title="Настройки">
                ⚙
              </button>
            </div>
          </div>

          <div className="library-search-wrap">
            <label className="library-search" aria-label="Поиск фанфика по названию">
              <span className="library-search-icon">⌕</span>
              <input
                className="library-search-input"
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Поиск по названию фанфика"
              />
            </label>
          </div>
        </div>

        <div className={`library-overlay ${showLibraryScrollbar ? "is-scrollbar-visible" : ""}`}>
          <div className="library-overlay-fade" aria-hidden="true" />

          {status === "loading" && <div style={{ marginTop: 16, opacity: 0.8 }}>Загружаю проекты…</div>}

          {status === "error" && (
            <div style={{ marginTop: 16, color: "tomato" }}>
              {error ?? "Ошибка"}
              <button className="ghost-btn" style={{ marginLeft: 10 }} onClick={() => void refreshProjects()}>
                Повторить
              </button>
            </div>
          )}

          {status === "ready" && !hasProjects && (
            <div style={{ marginTop: 16, opacity: 0.85 }}>
              Пока тут пусто. Нажми <b>“+ Новый фанфик”</b> — и поехали.
            </div>
          )}

          {status === "ready" && hasProjects && (
            <>
              {pinnedProjects.length > 0 ? (
                <section className="library-section library-section-pinned">
                  <div className="library-section-head">
                    <div>
                      <div className="library-section-title">Закрепленные фанфики</div>
                      <div className="library-section-subtitle">Быстрый доступ к самым важным историям.</div>
                    </div>
                  </div>

                  <div className="library-grid library-grid-pinned">
                    {pinnedProjects.map((project) => renderCard(project, "pinned"))}
                  </div>
                </section>
              ) : null}

              <div className="library-divider">
                <span>{hasSearch ? "Результаты поиска" : "Все фанфики"}</span>
              </div>

              {!hasFilteredProjects ? (
                <div className="library-empty-search">
                  По запросу <b>{searchQuery.trim()}</b> ничего не нашлось.
                </div>
              ) : (
                <div className="library-grid">{filteredView.map((project) => renderCard(project, "all"))}</div>
              )}
            </>
          )}
        </div>
      </div>

      {showCreateProject && (
        <div className="modal-backdrop">
          <div className="modal-sheet">
            <div className="modal-title">Новый фанфик</div>

            <input
              className="form-input"
              placeholder="Название фанфика"
              value={newProjectTitle}
              onChange={(event) => setNewProjectTitle(event.target.value)}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") void onCreateProject();
                if (event.key === "Escape") setShowCreateProject(false);
              }}
            />

            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setShowCreateProject(false)}>
                Отмена
              </button>
              <button className="primary-btn" onClick={() => void onCreateProject()} disabled={creatingProject}>
                {creatingProject ? "Создаю…" : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-backdrop">
          <div className="modal-sheet">
            <div className="modal-title">Настройки</div>

            <div className="danger-zone">
              <div className="danger-title">Скролл библиотеки</div>
              <div className="danger-actions">
                <button className="ghost-btn" onClick={() => setShowLibraryScrollbar((value) => !value)}>
                  {showLibraryScrollbar ? "Скрыть видимый скролл" : "Показать видимый скролл"}
                </button>
                <div className="settings-hint">
                  Показывает небольшой аккуратный бегунок, который удобно тянуть вниз на ноутбуке и тачпаде.
                </div>
              </div>
            </div>

            <div className="danger-zone">
              <div className="danger-title">Очистка файлов</div>
              <div className="danger-actions">
                <button className="ghost-btn" onClick={() => void onCleanupAllAssets()} disabled={cleanupRunning}>
                  {cleanupRunning ? "Очищаю…" : "Очистить неиспользуемые файлы во всех фанфиках"}
                </button>
                {cleanupInfo && <div className="settings-hint">{cleanupInfo}</div>}
              </div>
            </div>

            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setShowSettings(false)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
