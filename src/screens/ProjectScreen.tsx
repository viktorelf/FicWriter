import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  createChapter,
  loadProject,
  deleteChapter,
  type Project,
  type CharacterCard,
  type CharacterField,
  importProjectCover,
  clearProjectCover,
  importCharacterAvatar,
  deleteCharacterAvatar,
  updateChapterTitle,
  updateProjectMeta,
  cleanupProjectAssets,
} from "../store/projectsStore";
import { loadChapterTitle, saveChapterTitle } from "../store/fsStore";
import { open } from "@tauri-apps/plugin-dialog";
import { confirm } from "../components/confirmService";
import { appDataDir, join } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";
import { deleteProject } from "../store/projectsStore";



function formatChapterLabel(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });
}

type ChapterCtx = { id: string; title: string };

type ProjectMetaDraft = Pick<
  Project,
  "workType"
  | "fandom"
  | "pairing"
  | "rating"
  | "direction"
  | "tags"
  | "shortDescription"
  | "notes"
  | "characterFields"
  | "characters"
>;

const PROJECT_TITLE_MAX_LENGTH = 120;

export default function ProjectScreen() {
  const nav = useNavigate();
  const location = useLocation();

  const { projectId } = useParams<{ projectId: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");

  const [metaSaving, setMetaSaving] = useState(false);
  const [metaDirty, setMetaDirty] = useState(false);
  const metaAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedMetaRef = useRef<string | null>(null);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupInfo, setCleanupInfo] = useState<string | null>(null);
  const [metaReady, setMetaReady] = useState(false);

  // главы: реальные названия
  const [titlesById, setTitlesById] = useState<Record<string, string>>({});
  const [titlesLoaded, setTitlesLoaded] = useState(false);

  // контекстное меню
  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 });
  const [ctxChapter, setCtxChapter] = useState<ChapterCtx | null>(null);

  // обложка
  const [coverSrc, setCoverSrc] = useState<string | null>(null);

  // ===== редактирование названия фанфика =====
  const [titleDraft, setTitleDraft] = useState("");
  const [titleSaving, setTitleSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
const [chapterTitleDraft, setChapterTitleDraft] = useState("");
const chapterTitleInputRef = useRef<HTMLInputElement | null>(null);

const [tab, setTab] = useState<"chapters" | "settings">("chapters");


// где-то сверху файла (вне компонента) можешь держать подсказки:
const TAG_CATEGORIES = [
  {
    title: "Базовые",
    tags: [
      "Омегаверс",
      "hurt/comfort",
      "AU",
      "slow burn",
      "От врагов к любовникам",
      "От друзей к любовникам",
      "angst",
      "fluff",
      "pwp",
    ],
  },
  {
    title: "Жанры и темы",
    tags: [
      "Детектив",
      "Мафия",
      "Драма",
      "Романтика",
      "Фэнтези",
      "Приключения",
      "Научная фантастика",
      "Психология",
      "Триллер",
      "Хоррор",
      "Мистика",
      "Современность",
      "Историческое",
      "Постапокалипсис",
      "Киберпанк",
      "Стимпанк",
      "Нуар",
      "Готика",
      "Магический реализм",
    ],
  },
  {
    title: "Миры и существа",
    tags: [
      "Ведьмы",
      "Волшебники",
      "Магические существа",
      "Демоны",
      "Боги",
      "Ангелы",
      "Драконы",
      "Эльфы",
      "Русалки",
      "Феи",
      "Андроиды",
      "Мутанты",
      "Разумные растения",
      "Боги Египта",
      "Древняя Греция",
      "Вампиры",
      "Оборотни",
    ],
  },
  {
    title: "Отношения",
    tags: [
      "Сложные отношения",
      "Неравные отношения",
      "Здоровые отношения",
      "Токсичные отношения",
      "Созависимость",
      "Запретная любовь",
      "Любовный треугольник",
      "Ревность",
      "Одержимость",
      "Манипуляции",
      "Предательство",
      "Искупление",
      "Прощение",
      "Моральный выбор",
      "Внутренний конфликт",
      "Медленное сближение",
      "Невзаимная любовь",
      "Тайные отношения",
      "Разлука",
      "Воссоединение",
      "Брак по расчёту",
      "Фиктивные отношения",
      "Договорные отношения",
      "Соперники",
      "Наставник / ученик",
      "Телохранитель / клиент",
      "Начальник / подчинённый",
      "Первый раз",
      "Первый раз вместе",
      "Бывшие",
    ],
  },
  {
    title: "Атмосфера",
    tags: [
      "Стекло",
      "Эмоциональные качели",
      "Медленно и больно",
      "Тепло и уютно",
      "Мрачная атмосфера",
      "Светлая история",
      "Трагедия",
      "Меланхолия",
      "Надежда",
      "Катартсис",
      "Лирика",
      "Саспенс",
      "Нерв",
      "Горько-сладкий финал",
      "Хэппи энд (с трудом)",
      "Счастливый конец",
      "Несчастливый финал",
      "Открытый финал",
      "Терапия / исцеление",
      "Стыд / вина",
      "Реванш",
      "Принятие себя",
      "Самопожертвование",
    ],
  },
  {
    title: "Сюжетные тропы",
    tags: [
      "Вынужденное соседство",
      "Одна кровать",
      "Фальшивое свидание",
      "Секретная личность",
      "Скрытая личность",
      "Двойная жизнь",
      "Потеря памяти",
      "Альтернативная реальность",
      "Путешествия во времени",
      "Петля времени",
      "Судьбоносная встреча",
      "Перерождение",
      "Вторая попытка",
      "От ненависти к любви",
      "От любви к ненависти",
      "Сделка с дьяволом",
      "Мир без гомофобии",
      "Жертва ради любви",
      "Френды с бенефитами",
      "Фейковый брак",
      "Секретные письма",
      "Долгая разлука",
      "Судьбоносная ошибка",
    ],
  },
  {
    title: "Дарк / напряжение",
    tags: [
      "Темный роман",
      "Морально серые персонажи",
      "Антигерой",
      "Падение героя",
      "Коррупция",
      "Месть",
      "Психологическое давление",
      "Опасная привязанность",
      "Игры разума",
      "Контроль",
      "Зависимость",
      "Дарк",
      "Жестокость",
      "Убийство",
      "Криминал",
      "Заболевания",
      "Смерть",
      "Депрессия",
    ],
  },
  {
    title: "Интимные и 18+",
    tags: [
      "Эротика",
      "Бладгейм",
      "БДСМ",
      "Сексуальное напряжение",
      "Медленное соблазнение",
      "Запретное желание",
      "Сильное влечение",
      "Страсть",
      "Одержимая страсть",
      "Доминирование",
      "Сладкая пытка",
      "Долгая прелюдия",
      "Дразнение",
      "Смущение",
      "Неловкий первый раз",
      "Подчинение",
      "Dom/Sub",
      "Power play",
      "Контроль и доверие",
      "Грубый секс",
      "Нежный, чувственный секс",
      "После ссоры",
      "Примирительный секс",
      "Сексуальное пробуждение",
      "Исследование желаний",
      "Сексуальное развитие",
      "Сексуальная трансформация",
      "Грубые игры",
      "Грязные разговоры",
      "Грязьные фантазии",
      "Порка",
      "Кинк на мольбы",
      "Кинк на отказ",
      "Кинк на слёзы",
      "Кинк на унижение",
      "Кинк на публичность",
      "Кинк на наблюдение",
      "Кинк на ролевые игры",
      "Кинк на игрушки",
      "Кинк на контроль",
      "Сексуальная неопытность",
      "Секуальная непослушность",
      "Мужская беременность",
      "Павер Боттом",
      "Альфа/Альфа",
      "Омега/Омега",
      "Сигма/Сигма",
      "Сигма/Энигма",
      "Незащищённый секс",
      "Засосы/Укусы",
      "Потеря девственности",
      "Игры с кровью",
      "Ксенофилия/Секс между разными видами",
      "Грязные разговоры",
      "Обездвиживание/Шибари",
      "Кунилингус",
      "Течка/Гон",
      "Жидкости тела",
      "Спонтанный секс",
      "Универсалы",
      "Кинк на похвалу",
      "Сайз-кинк",
      "Дэдди-кинк",
      "Чувственная близость",
      "Эротические сны",
      "Фроттаж/Трение",
      "Виртуальный секс",
      "Секс в транспорте",
      "Игры с температурой",
      "Обнажение",
      "Петтинг",
      "Секстинг",
      "Межбедерный секс",
      "Тентакли",
      "Кноттинг",
      "Кинк на нижнее бельё",
      "Афродизиак",
      "Секс перед зеркалом",
      "Секс с незнакомцем",
      "Секс по телефону",
      "Секс в душе/ванной",
      "Секс на кухне",
      "Секс на рабочем месте",
      "Секс на природе",
      "Фистинг",
      "Игры с болью",
      "Шугар дэдди",
      "Gangbang/Толпа",
      "Секс магия",
      "Поза 69",
      "Knife play",
      "Doggy style",
      "Сквирт",
      "Кинк на грудь",
      "Просмотр порно",
      "Эротическая лактация",
      "Gun play",
      "Ролевые игры",
      "Игрушки",
      "Сексуальные эксперименты",
      "Секс с использованием предметов",
      "В троём",
      "Групповой секс",
      "Свингеры",
      "Изнасилование (согласие!)",
      "Изнасилование (без согласия!)",
      "Асфиксиофилия/удушение",
      "Контроль над оргазмом",
      "Вагинальный секс",
      "Оральный секс",
      "Гермафродитный секс",
      "Римминг",
      "Минет",
      "Двойной вход",
      "Два пениса/Двойное проникновение",
      "Грудной секс",
      "Игра с границами",
      "Медленный секс",
      "Интенсивная близость",
      "Эмоциональная близость",
      "Физическая зависимость",
      "Тайная связь",
      "Запретные прикосновения",
      "Первый опыт",
      "Неожиданная близость",
      "Соблазнение",
      "Искушение",
      "Секс в публичных местах",
      "Нежный секс",
      "Анальный секс",
    ],
  },
  {
    title: "Социальные / сеттинги",
    tags: [
      "Академия",
      "Университет",
      "Школа магии",
      "Королевский двор",
      "Дворцовые интриги",
      "Подпольный мир",
      "Преступный синдикат",
      "Шоу-бизнес",
      "Модельный бизнес",
      "Музыкальная индустрия",
      "Военные",
      "Наёмники",
      "Шпионы",
      "Корпорации",
      "Эксперименты",
      "Лаборатории",
      "Цирк",
      "Балет",
      "Архитекторы",
      "Интерпол/ФБР/ЦРУ",
      "Аристократы",
      "Разница в возрасте",
      "Врачи",
      "Юристы",
      "Журналисты",
      "Спорт",
      "Музыканты",
      "Киллеры",
      "Гангстеры",
      "Серийные киллеры",
      "Полицейские",
      "Детективы",
      "Следователи",
      "Адвокаты",
      "Прокуроры",
      "Частные детективы",
      "Охотники за головами",
      "Медсёстры",
      "Психологи",
      "Психиатры",
      "Студенты",
      "Учителя",
      "Преподаватели",
      "Писатели",
      "Художники",
      "Актёры",
      "Певцы",
      "Дизайнеры",
      "Фотографы",
      "Хакеры",
      "Хактивисты",
      "Учёные",
      "Инженеры",
      "Пилоты",
      "Моряки",
      "Военные врачи",
      "Телохранители",
      "Провинциальный город",
      "Большой город",
      "Космос",
      "Далёкое будущее",
      "90-е",
    ],
  },
  {
    title: "География",
    tags: [
      "Великобритания",
      "США",
      "Канада",
      "Корея",
      "Франция",
      "Германия",
      "Рим",
      "Италия",
      "Джунгли",
      "Острова",
    ],
  },
];
const TAG_SUGGESTIONS = Array.from(new Set(
  TAG_CATEGORIES.flatMap((c) => c.tags)
));

const DEFAULT_CHARACTER_FIELDS: CharacterField[] = [
  { id: "age", label: "Возраст" },
  { id: "role", label: "Роль" },
  { id: "details", label: "Особые детали" },
];

function startEditChapter(id: string, currentTitle: string) {
  setEditingChapterId(id);
  setChapterTitleDraft(currentTitle);
  // фокус после рендера
  setTimeout(() => chapterTitleInputRef.current?.focus(), 0);
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeCharacters(
  fields: CharacterField[],
  characters: CharacterCard[] | undefined
) {
  const fieldIds = fields.map((f) => f.id);
  return (characters ?? []).map((c) => {
    const nextFields: Record<string, string> = {};
    for (const id of fieldIds) {
      nextFields[id] = c.fields?.[id] ?? "";
    }
    return { ...c, fields: nextFields };
  });
}

  // ===== meta draft =====
  const [metaDraft, setMetaDraft] = useState<ProjectMetaDraft>({
    workType: "fanfic",
    fandom: "",
    pairing: "",
    rating: "NC-17",
    direction: "slash",
    tags: [],
    shortDescription: "",
    notes: "",
    characterFields: DEFAULT_CHARACTER_FIELDS,
    characters: [],
  });

  // 1) Загружаем проект
useEffect(() => {
  let alive = true;

  (async () => {
    try {
      if (!projectId) {
        setProject(null);
        setMetaReady(true);
        setStatus("ready");
        return;
      }

      setStatus("loading");
      setMetaReady(false);
      const p = await loadProject(projectId);
      if (!alive) return;

      if (!p) {
        setProject(null);
        setTitleDraft("");
        setMetaReady(true);
        setStatus("ready");
        return;
      }

      setProject(p);
      setTitleDraft(p.title ?? "");
      setStatus("ready");
    } catch (e: any) {
      if (!alive) return;
      setError(e?.message ?? "Ошибка загрузки проекта");
      setStatus("error");
    }
  })();

  return () => {
    alive = false;
  };
}, [projectId, location.key]);

useEffect(() => {
  const st = location.state as any;

  if (st?.openSettings) {
    setTab("settings");
    nav(location.pathname, { replace: true, state: null });
  }
}, [location.state, location.pathname, nav]);


  // 1.1) при смене проекта — обновляем черновик meta
  useEffect(() => {
    if (!project) return;

    const fields =
      project.characterFields && project.characterFields.length > 0
        ? project.characterFields
        : DEFAULT_CHARACTER_FIELDS;
    const chars = normalizeCharacters(fields, project.characters);

    setMetaDraft({
      workType: project.workType ?? "fanfic",
      fandom: project.fandom ?? "",
      pairing: project.pairing ?? "",
      rating: (project.rating ?? "NC-17") as any,
      direction: (project.direction ?? "slash") as any,
      tags: project.tags ?? [],
      shortDescription: project.shortDescription ?? "",
      notes: project.notes ?? "",
      characterFields: fields,
      characters: chars,
    });

    setMetaDirty(false);
    setMetaReady(true);
    lastSavedMetaRef.current = JSON.stringify({
      workType: project.workType ?? "fanfic",
      fandom: project.fandom ?? "",
      pairing: project.pairing ?? "",
      rating: project.rating ?? "NC-17",
      direction: project.direction ?? "slash",
      tags: project.tags ?? [],
      shortDescription: project.shortDescription ?? "",
      notes: project.notes ?? "",
      characterFields: fields,
      characters: chars,
    });
  }, [project?.id]);

  // 2) Обложка: формируем src
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!projectId || !project?.cover) {
        if (alive) setCoverSrc(null);
        return;
      }

      const base = await appDataDir();
      const abs = await join(
        base,
        "ficwriter",
        "projects",
        projectId,
        project.cover.replace(/\\/g, "/")
      );

      const v = project.updatedAt ?? Date.now();
      const src = `${convertFileSrc(abs)}?v=${v}`;

      if (alive) setCoverSrc(src);
    })();

    return () => {
      alive = false;
    };
  }, [projectId, project?.cover, project?.updatedAt]);

  // 3) Подтягиваем реальные названия глав из fsStore
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!projectId || !project?.chapters?.length) {
        if (alive) setTitlesById({});
        if (alive) setTitlesLoaded(true);
        return;
      }

      try {
        if (alive) setTitlesLoaded(false);
        const entries = await Promise.all(
          project.chapters.map(async (ch) => {
            const t = await loadChapterTitle(projectId, ch.id);
            return [ch.id, t ?? ""] as const;
          })
        );

        if (!alive) return;

        const map: Record<string, string> = {};
        for (const [id, t] of entries) {
          if (t) map[id] = t;
        }
        setTitlesById(map);
        setTitlesLoaded(true);
      } catch {
        if (!alive) return;
        setTitlesById({});
        setTitlesLoaded(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [projectId, project?.chapters]);

  // 4) закрытие контекстного меню по клику вне / Esc
  useEffect(() => {
    if (!ctxOpen) return;

    const onDown = () => setCtxOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCtxOpen(false);
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [ctxOpen]);

  const chaptersView = useMemo(() => {
    const list = project?.chapters ?? [];
    const sorted = [...list].sort(
      (a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)
    );

    return sorted.map((ch) => ({
      ...ch,
      title: titlesById[ch.id] || (titlesLoaded ? ch.title : "Загружаю…"),
      updatedLabel: formatChapterLabel(ch.updatedAt || ch.createdAt),
    }));
  }, [project?.chapters, titlesById, titlesLoaded]);

  // ===== actions =====

  async function onCreateChapter(title: string) {
    if (!projectId) return;

    setCreating(true);
    try {
      const meta = await createChapter(projectId, title);

      const updated = await loadProject(projectId);
      setProject(updated);

      setShowCreateModal(false);
      nav(`/project/${projectId}/chapter/${meta.id}`);
    } catch (e: any) {
      alert(e?.message ?? "Ошибка создания главы");
    } finally {
      setCreating(false);
    }
  }

  async function onDeleteProject() {
  if (!projectId || !project) return;

  const ok = await confirm(
    `Удалить фанфик "${project.title}"?\n\nЭто действие безвозвратное: удалятся главы, обложка и все файлы.`,
    {
      title: "Подтверждение",
      kind: "warning",
      okLabel: "Удалить",
      cancelLabel: "Отмена",
    }
  );
  if (!ok) return;

  try {
    await deleteProject(projectId);
    nav("/"); // назад в библиотеку
  } catch (e: any) {
    alert(e?.message ?? "Ошибка удаления фанфика");
  }
}

  async function onDeleteChapter(chId: string, chTitle: string) {
    if (!projectId) return;

    const ok = await confirm(`Удалить главу "${chTitle}"? Это действие нельзя отменить.`, {
      title: "Подтверждение",
      kind: "warning",
      okLabel: "Удалить",
      cancelLabel: "Отмена",
    });
    if (!ok) return;

    try {
      await deleteChapter(projectId, chId);

      const updated = await loadProject(projectId);
      setProject(updated);

      setTitlesById((prev) => {
        const copy = { ...prev };
        delete copy[chId];
        return copy;
      });
    } catch (err: any) {
      console.error("Delete chapter error:", err);
      alert(err?.message ?? String(err));
    }
  }

  function setDraft<K extends keyof ProjectMetaDraft>(key: K, value: ProjectMetaDraft[K]) {
    setMetaDraft((prev) => ({ ...prev, [key]: value }));
    setMetaDirty(true);
  }

  function setCharacterFields(nextFields: CharacterField[], nextCharacters?: CharacterCard[]) {
    setMetaDraft((prev) => ({
      ...prev,
      characterFields: nextFields,
      characters: nextCharacters ?? prev.characters,
    }));
    setMetaDirty(true);
  }

  function setCharacters(nextCharacters: CharacterCard[]) {
    setMetaDraft((prev) => ({ ...prev, characters: nextCharacters }));
    setMetaDirty(true);
  }

  function addCharacter() {
    const fields = metaDraft.characterFields ?? DEFAULT_CHARACTER_FIELDS;
    const next: CharacterCard = {
      id: makeId("char"),
      name: "Новый персонаж",
      fields: Object.fromEntries(fields.map((f) => [f.id, ""])),
    };
    setCharacters([...(metaDraft.characters ?? []), next]);
  }

  function removeCharacter(id: string) {
    const next = (metaDraft.characters ?? []).filter((c) => c.id !== id);
    setCharacters(next);
  }

  function updateCharacterName(id: string, name: string) {
    const next = (metaDraft.characters ?? []).map((c) => (c.id === id ? { ...c, name } : c));
    setCharacters(next);
  }

  function updateCharacterField(id: string, fieldId: string, value: string) {
    const next = (metaDraft.characters ?? []).map((c) =>
      c.id === id ? { ...c, fields: { ...c.fields, [fieldId]: value } } : c
    );
    setCharacters(next);
  }

  function updateCharacterAvatar(id: string, value: string) {
    const next = (metaDraft.characters ?? []).map((c) =>
      c.id === id ? { ...c, avatar: value } : c
    );
    setCharacters(next);
  }

  async function pickCharacterAvatar(id: string) {
    if (!projectId) return;
    const selected = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });

    if (!selected || Array.isArray(selected)) return;

    try {
      const current = (metaDraft.characters ?? []).find((c) => c.id === id)?.avatar;
      const rel = await importCharacterAvatar(projectId, id, selected);
      if (current && current !== rel) {
        await deleteCharacterAvatar(projectId, current);
      }
      updateCharacterAvatar(id, rel);
    } catch (e: any) {
      alert(e?.message ?? "Ошибка загрузки изображения");
    }
  }

  function addCharacterField() {
    const label = newFieldLabel.trim();
    if (!label) return;
    const id = makeId("field");
    const nextFields = [...(metaDraft.characterFields ?? DEFAULT_CHARACTER_FIELDS), { id, label }];
    const nextChars = (metaDraft.characters ?? []).map((c) => ({
      ...c,
      fields: { ...c.fields, [id]: "" },
    }));
    setNewFieldLabel("");
    setCharacterFields(nextFields, nextChars);
  }

  function updateCharacterFieldLabel(id: string, label: string) {
    const nextFields = (metaDraft.characterFields ?? DEFAULT_CHARACTER_FIELDS).map((f) =>
      f.id === id ? { ...f, label } : f
    );
    setCharacterFields(nextFields);
  }

  function removeCharacterField(id: string) {
    const nextFields = (metaDraft.characterFields ?? DEFAULT_CHARACTER_FIELDS).filter((f) => f.id !== id);
    const nextChars = (metaDraft.characters ?? []).map((c) => {
      const fields = { ...c.fields };
      delete fields[id];
      return { ...c, fields };
    });
    setCharacterFields(nextFields, nextChars);
  }

  async function runMetaAutosave() {
    if (!projectId) return;
    if (metaSaving) return;

    const serialized = JSON.stringify(metaDraft);
    if (serialized === lastSavedMetaRef.current) {
      if (metaDirty) setMetaDirty(false);
      return;
    }

    try {
      setMetaSaving(true);
      await updateProjectMeta(projectId, { ...metaDraft });
      const updated = await loadProject(projectId);
      setProject(updated);
      setMetaDirty(false);
      lastSavedMetaRef.current = serialized;
    } catch (e) {
      console.error("META AUTOSAVE ERROR:", e);
    } finally {
      setMetaSaving(false);
    }
  }

  function queueMetaAutosave() {
    if (!projectId) return;
    if (metaAutosaveTimerRef.current) clearTimeout(metaAutosaveTimerRef.current);
    metaAutosaveTimerRef.current = setTimeout(() => {
      void runMetaAutosave();
    }, 1000);
  }

  function addTag(tag: string) {
    const current = metaDraft.tags ?? [];
    if (current.includes(tag)) return;
    setDraft("tags", [...current, tag].slice(0, 50));
  }

  async function onSaveMeta() {
    if (!projectId) return;

    try {
      setMetaSaving(true);

      await updateProjectMeta(projectId, { ...metaDraft });

      const updated = await loadProject(projectId);
      setProject(updated);

      setMetaDirty(false);
      lastSavedMetaRef.current = JSON.stringify(metaDraft);
    } catch (e: any) {
      alert(e?.message ?? "Ошибка сохранения настроек");
    } finally {
      setMetaSaving(false);
    }
  }

  async function onCleanupAssets() {
    if (!projectId) return;
    if (cleanupRunning) return;
    setCleanupRunning(true);
    setCleanupInfo(null);
    try {
      const res = await cleanupProjectAssets(projectId);
      setCleanupInfo(`Удалено файлов: ${res.removed}`);
    } catch (e: any) {
      setCleanupInfo(`Ошибка очистки: ${e?.message ?? e}`);
    } finally {
      setCleanupRunning(false);
    }
  }

  // автосейв метаданных
  useEffect(() => {
    if (!projectId) return;
    if (!metaDirty) return;
    if (metaSaving) return;
    queueMetaAutosave();
    return () => {
      if (metaAutosaveTimerRef.current) {
        clearTimeout(metaAutosaveTimerRef.current);
        metaAutosaveTimerRef.current = null;
      }
    };
  }, [projectId, metaDraft, metaDirty, metaSaving]);

  // форсируем сохранение при уходе/закрытии
  useEffect(() => {
    const onBeforeUnload = () => {
      if (metaDirty) {
        void runMetaAutosave();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (metaAutosaveTimerRef.current) {
        clearTimeout(metaAutosaveTimerRef.current);
        metaAutosaveTimerRef.current = null;
      }
      if (metaDirty) {
        void runMetaAutosave();
      }
    };
  }, [metaDirty, metaDraft, projectId]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!metaDirty) return;
      event.preventDefault();
      event.returnValue = "";
      void runMetaAutosave();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [metaDirty, metaDraft, projectId]);

  // ✅ сохранение названия фанфика (отдельно от metaDraft)
async function saveProjectTitle(nextRaw: string) {
  if (!projectId || !project) return;

  const next = nextRaw.trim().slice(0, PROJECT_TITLE_MAX_LENGTH);

  // пустое — откат
  if (!next) {
    setTitleDraft(project.title ?? "");
    return;
  }

  // не изменилось — ничего
  if (next === project.title) return;

  try {
    setTitleSaving(true);
    await updateProjectMeta(projectId, { title: next } as any);

    const updated = await loadProject(projectId);

    // если вдруг loadProject вернул null — не падаем
    if (!updated) {
      setProject((prev) => (prev ? { ...prev, title: next } : prev));
      setTitleDraft(next);
      return;
    }

    setProject(updated);
    setTitleDraft(updated.title ?? next);
  } catch (e: any) {
    alert(e?.message ?? "Ошибка сохранения названия");
    setTitleDraft(project.title ?? "");
  } finally {
    setTitleSaving(false);
  }
}

  async function handleBackToLibrary() {
    const nextTitle = titleDraft.trim().slice(0, PROJECT_TITLE_MAX_LENGTH);
    if (nextTitle && nextTitle !== (project?.title ?? "")) {
      await saveProjectTitle(nextTitle);
    }

    if (metaDirty) {
      const ok = await confirm("Изменения в настройках фанфика еще не сохранены. Сохранить их и закрыть страницу?", {
        title: "Несохраненные изменения",
        okLabel: "Сохранить и выйти",
        cancelLabel: "Остаться",
        kind: "warning",
      });
      if (!ok) return;
      await onSaveMeta();
    }

    nav("/");
  }

  function openCtx(e: any, ch: { id: string; title: string }) {
    e.preventDefault();
    e.stopPropagation();

    setCtxChapter({ id: ch.id, title: ch.title });
    setCtxPos({ x: e.clientX, y: e.clientY });
    setCtxOpen(true);
  }

  function ctxOpenChapter() {
    if (!projectId || !ctxChapter) return;
    setCtxOpen(false);
    nav(`/project/${projectId}/chapter/${ctxChapter.id}`);
  }

  async function ctxRename() {
    if (!projectId || !ctxChapter) return;

    const next = window.prompt("Новое название главы:", ctxChapter.title);
    if (next == null) return;

    const title = next.trim();
    if (!title) return;

    try {
      await saveChapterTitle(projectId, ctxChapter.id, title);
      await updateChapterTitle(projectId, ctxChapter.id, title);
      setTitlesById((prev) => ({ ...prev, [ctxChapter.id]: title }));
      setCtxOpen(false);
    } catch (e: any) {
      alert(e?.message ?? "Ошибка переименования");
    }
  }

  async function ctxDelete() {
    if (!ctxChapter) return;
    setCtxOpen(false);
    await onDeleteChapter(ctxChapter.id, ctxChapter.title);
  }

  async function pickCover() {
    if (!projectId) return;

    const selected = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });

    if (!selected || Array.isArray(selected)) return;

    try {
      await importProjectCover(projectId, selected);
      const updated = await loadProject(projectId);
      setProject(updated);
    } catch (e: any) {
      console.error("pickCover error:", e);
      alert(e?.message ?? String(e));
    }
  }

  async function onRemoveCover() {
    if (!projectId) return;

    const ok = await confirm("Удалить обложку?", {
      title: "Подтверждение",
      kind: "warning",
      okLabel: "Удалить",
      cancelLabel: "Отмена",
    });
    if (!ok) return;

    try {
      await clearProjectCover(projectId);
      setCoverSrc(null);

      const updated = await loadProject(projectId);
      setProject(updated);
    } catch (e: any) {
      alert(e?.message ?? "Ошибка удаления обложки");
    }
  }

  async function commitEditChapter() {
  if (!projectId || !editingChapterId) return;

  const next = chapterTitleDraft.trim();
  const id = editingChapterId;

  setEditingChapterId(null);

  if (!next) return;

  try {
    await saveChapterTitle(projectId, id, next);
    await updateChapterTitle(projectId, id, next);
    setTitlesById((prev) => ({ ...prev, [id]: next }));
  } catch (e: any) {
    alert(e?.message ?? "Ошибка переименования");
  }
}

function cancelEditChapter() {
  setEditingChapterId(null);
  setChapterTitleDraft("");
}
  // ===== UI states =====
  if (status === "loading") {
    return (
      <div style={{ padding: 24 }}>
        <button className="ghost-btn" onClick={() => nav("/")}>
          ← Библиотека
        </button>
        <p style={{ opacity: 0.85, marginTop: 12 }}>Загружаю фанфик…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ padding: 24 }}>
        <button className="ghost-btn" onClick={() => nav("/")}>
          ← Библиотека
        </button>
        <p style={{ color: "tomato", marginTop: 12 }}>{error ?? "Ошибка"}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: 24 }}>
        <button className="ghost-btn" onClick={() => void handleBackToLibrary()}>
          ← Библиотека
        </button>
        <p>Фанфик не найден.</p>
      </div>
    );
  }

  const characterFields = metaDraft.characterFields ?? DEFAULT_CHARACTER_FIELDS;
  const characters = metaDraft.characters ?? [];
  return (
    <div className="project-root">
      {/* TOP */}
      <div className="project-top">
        <button className="ghost-btn" onClick={() => void handleBackToLibrary()}>
          ← Библиотека
        </button>

        {/* ✅ editable title in the center */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <input
            ref={titleInputRef}
            className="project-title-input"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value.slice(0, PROJECT_TITLE_MAX_LENGTH))}
            placeholder="Название фанфика"
            maxLength={PROJECT_TITLE_MAX_LENGTH}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setTitleDraft(project.title ?? "");
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            onBlur={() => saveProjectTitle(titleDraft)}
            disabled={titleSaving}
            title={titleSaving ? "Сохраняю…" : "Нажми и переименуй"}
          />
        </div>

        <button
          className="primary-btn"
          onClick={() => {
            setNewChapterTitle(`Глава ${(project?.chapters?.length ?? 0) + 1}`);
            setShowCreateModal(true);
          }}
        >
          + Глава
        </button>
      </div>

<div className="project-body">
  {tab === "chapters" ? (
    <div className="chapters-panel">
      {project.description ? <div className="project-desc">{project.description}</div> : null}

      <div className="chapters-title">Главы</div>

      <div className="chapters-list">
        {chaptersView.length === 0 ? (
          <div className="chapters-empty">
            Глав пока нет. Жми <b>“+ Глава”</b> 😌
          </div>
        ) : (
          chaptersView.map((ch) => (
            <div
              key={ch.id}
              className="chapter-item"
              onClick={() => nav(`/project/${project.id}/chapter/${ch.id}`)}
              onContextMenu={(e) => openCtx(e, { id: ch.id, title: ch.title })}
              role="button"
              tabIndex={0}
            >
              <div className="chapter-left">
                {editingChapterId === ch.id ? (
                  <input
                    ref={chapterTitleInputRef}
                    className="chapter-title-input"
                    value={chapterTitleDraft}
                    onChange={(e) => setChapterTitleDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={commitEditChapter}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEditChapter();
                      if (e.key === "Escape") cancelEditChapter();
                    }}
                  />
                ) : (
                  <div
                    className="chapter-name"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startEditChapter(ch.id, ch.title);
                    }}
                    title="Двойной клик — переименовать"
                  >
                    {ch.title}
                  </div>
                )}
                <div className="chapter-meta">{ch.updatedLabel}</div>
              </div>

              <button
                className="chapter-del"
                title="Удалить главу"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDeleteChapter(ch.id, ch.title);
                }}
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  ) : (
    <div className="settings-panel">
      {/* 👇 сюда вставь твой UI настроек фанфика (обложка, теги, рейтинг, и т.д.) */}
      SETTINGS HERE
    </div>
  )}

        {/* RIGHT: settings */}
        <div className="project-empty">
        <div
          className="settings-sheet"
          style={{
            opacity: metaReady ? 1 : 0,
            pointerEvents: metaReady ? "auto" : "none",
            transition: "opacity 0.12s ease",
          }}
        >
            <div className="settings-header">
              <h2 className="settings-title">
                Настройки фанфика
                {metaSaving ? <span className="settings-muted"> • сохраняю…</span> : null}
              </h2>
            </div>

            {/* ✅ 2 колонки настроек */}
            <div className="settings-grid">
              {/* LEFT column (узкая) */}
              <div>
                  <div
                    className="cover-slot cover-slot--settings"
                    role="button"
                    tabIndex={0}
                  onClick={pickCover}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") pickCover();
                  }}
                  title={coverSrc ? "Нажми, чтобы заменить обложку" : "Выбрать обложку"}
                >
                  {coverSrc ? (
                    <>
                      <img src={coverSrc} alt="Обложка" className="cover-img" />
                      <button
                        type="button"
                        className="cover-remove"
                        title="Удалить обложку"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onRemoveCover();
                        }}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <div className="cover-plus">＋</div>
                  )}
                </div>

                {/* ТИП */}
                <div className="form-row">
                  <div className="form-label">Тип</div>

                  <div className="radio-row">
                    <label className={`radio-item ${(metaDraft.workType ?? "fanfic") === "original" ? "is-selected" : ""}`}>
                      <input
                        type="radio"
                        name="workType"
                        checked={(metaDraft.workType ?? "fanfic") === "original"}
                        onChange={() => setDraft("workType", "original")}
                      />
                      <span className="radio-item__dot" />
                      <span className="radio-item__content">
                        <span className="radio-item__title">Ориджинал</span>
                        <span className="radio-item__hint">Своя история без привязки к фэндому</span>
                      </span>
                    </label>

                    <label className={`radio-item ${(metaDraft.workType ?? "fanfic") === "fanfic" ? "is-selected" : ""}`}>
                      <input
                        type="radio"
                        name="workType"
                        checked={(metaDraft.workType ?? "fanfic") === "fanfic"}
                        onChange={() => setDraft("workType", "fanfic")}
                      />
                      <span className="radio-item__dot" />
                      <span className="radio-item__content">
                        <span className="radio-item__title">Фанфик по фэндому</span>
                        <span className="radio-item__hint">История внутри выбранной вселенной</span>
                      </span>
                    </label>
                  </div>
                </div>

                {/* ФЭНДОМ */}
                <div className="form-row">
                  <div className="form-label">Фэндом</div>
                  <input
                    className="form-input"
                    value={metaDraft.fandom ?? ""}
                    onChange={(e) => setDraft("fandom", e.target.value)}
                    placeholder="Например: Bangtan Boys (BTS)"
                  />
                </div>

                {/* ПЕЙРИНГ */}
                <div className="form-row">
                  <div className="form-label">Пэйринги / отношения</div>
                  <input
                    className="form-input"
                    value={metaDraft.pairing ?? ""}
                    onChange={(e) => setDraft("pairing", e.target.value)}
                    placeholder="Например: Чон Чонгук / Ким Тэхён"
                  />
                </div>

                {/* РЕЙТИНГ */}
                <div className="form-row">
                  <div className="form-label">Рейтинг</div>
                  <select
                    className="form-input"
                    value={metaDraft.rating ?? "NC-17"}
                    onChange={(e) => setDraft("rating", e.target.value as any)}
                  >
                    <option value="G">G</option>
                    <option value="PG-13">PG-13</option>
                    <option value="R">R</option>
                    <option value="NC-17">NC-17</option>
                    <option value="NC-21">NC-21</option>
                  </select>
                </div>

                {/* НАПРАВЛЕННОСТЬ */}
                <div className="form-row">
                  <div className="form-label">Направленность</div>
                  <select
                    className="form-input"
                    value={metaDraft.direction ?? "slash"}
                    onChange={(e) => setDraft("direction", e.target.value as any)}
                  >
                    <option value="gen">Джен</option>
                    <option value="het">Гет</option>
                    <option value="slash">Слэш (M/M)</option>
                    <option value="femslash">Фемслэш (W/W)</option>
                    <option value="other">Другое</option>
                  </select>
                </div>
              </div>

              {/* RIGHT column (широкая) */}
              <div>
                <div className="cover-side">
                  <div className="cover-side-title" title={project.title}>
                    {project.title}
                  </div>
                  <div className="cover-side-sub">{project.chapters?.length ?? 0} глав(ы)</div>
                  <div className="cover-side-hint">Нажми на обложку, чтобы выбрать/заменить</div>
                </div>

                {/* МЕТКИ */}
<div className="form-row">
  <div className="form-label">Метки</div>

  <div className="tags-box">
    <div className="tags-chips">
      {(metaDraft.tags ?? []).map((t, i) => (
        <span key={`${t}-${i}`} className="tag-chip" title={t}>
          {t}
          <button
            type="button"
            className="tag-x"
            onClick={() => setDraft("tags", (metaDraft.tags ?? []).filter((x) => x !== t))}
            aria-label={`Удалить метку ${t}`}
          >
            ✕
          </button>
        </span>
      ))}
    </div>

    <input
      className="tag-input"
      placeholder="Начни вводить и нажми Enter…"
      list="tag-suggest"
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== ",") return;
        e.preventDefault();

        const input = e.currentTarget;
        const raw = input.value.trim();
        const tag = raw.replace(/,$/, "").trim();
        if (!tag) return;

        const current = metaDraft.tags ?? [];
        if (current.includes(tag)) {
          input.value = "";
          return;
        }

        setDraft("tags", [...current, tag].slice(0, 50));
        input.value = "";
      }}
      onBlur={(e) => {
        // чтобы добавлялось даже если просто ввела и кликнула вне
        const raw = e.currentTarget.value.trim();
        if (!raw) return;
        const tag = raw.replace(/,$/, "").trim();
        if (!tag) return;

        const current = metaDraft.tags ?? [];
        if (!current.includes(tag)) setDraft("tags", [...current, tag].slice(0, 50));
        e.currentTarget.value = "";
      }}
    />

    <datalist id="tag-suggest">
      {TAG_SUGGESTIONS.map((t, i) => (
        <option value={t} key={`${t}-${i}`} />
      ))}
    </datalist>
  </div>

  <div className="tag-suggest-panel">
    {TAG_CATEGORIES.map((group) => (
      <details key={group.title} className="tag-group">
        <summary className="tag-group__title">{group.title}</summary>
        <div className="tag-group__chips">
          {group.tags.map((t, i) => (
            <button key={`${t}-${i}`} type="button" className="tag-suggest-btn" onClick={() => addTag(t)}>
              {t}
            </button>
          ))}
        </div>
      </details>
    ))}
  </div>

  <div className="field-hint">
    Enter или запятая — добавить. Клик по ✕ — удалить 😉
          </div>
        </div>


                {/* ОПИСАНИЕ */}
                <div className="form-row">
                  <div className="form-label">Краткое описание</div>
                  <textarea
                    className="form-textarea"
                    value={metaDraft.shortDescription ?? ""}
                    onChange={(e) => setDraft("shortDescription", e.target.value)}
                    placeholder="500 символов — как на Фикбуке"
                    maxLength={500}
                    rows={4}
                  />
                </div>

                {/* ПРИМЕЧАНИЯ */}
                <div className="form-row">
                  <div className="form-label">Примечания</div>
                  <textarea
                    className="form-textarea"
                    value={metaDraft.notes ?? ""}
                    onChange={(e) => setDraft("notes", e.target.value)}
                    placeholder="Например: предупреждения, заметки, пояснения"
                    rows={6}
                  />
                </div>
              </div>
            </div>

            <div className="characters-section">
              <div className="characters-title">Персонажи</div>

              <div className="characters-fields">
                <div className="characters-subtitle">Поля карточки</div>
                <div className="characters-field-add">
                  <input
                    className="form-input characters-field-input"
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    placeholder="Например: Внешность"
                  />
                  <button className="primary-btn characters-field-btn" onClick={addCharacterField}>
                    + Поле
                  </button>
                </div>

                <div className="characters-fields-list">
                  {characterFields.map((f) => (
                    <div className="characters-field-row" key={f.id}>
                      <input
                        className="form-input characters-field-input"
                        value={f.label}
                        onChange={(e) => updateCharacterFieldLabel(f.id, e.target.value)}
                        placeholder="Название поля"
                      />
                      <button
                        className="ghost-btn characters-field-remove"
                        onClick={() => removeCharacterField(f.id)}
                        title="Удалить поле"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="characters-table">
                <div className="characters-table-head">
                  <div className="characters-subtitle">Карточки персонажей</div>
                  <button className="primary-btn" onClick={addCharacter}>
                    + Персонаж
                  </button>
                </div>

                {characters.length === 0 ? (
                  <div className="characters-empty">Пока нет персонажей. Нажми «+ Персонаж».</div>
                ) : (
                  <div className="character-cards">
                    {characters.map((c) => (
                      <div className="character-card" key={c.id}>
                        <div className="character-card-head">
                          <div className="character-card-title">{c.name || "Без имени"}</div>
                          <button
                            className="ghost-btn character-card-remove"
                            onClick={() => removeCharacter(c.id)}
                            title="Удалить персонажа"
                          >
                            🗑️
                          </button>
                        </div>

                        <div className="character-card-body">
                          <div className="character-card-left">
                            <input
                              className="form-input"
                              value={c.name}
                              onChange={(e) => updateCharacterName(c.id, e.target.value)}
                              placeholder="Имя персонажа"
                            />
                            <input
                              className="form-input characters-avatar-input"
                              value={c.avatar ?? ""}
                              onChange={(e) => updateCharacterAvatar(c.id, e.target.value)}
                              placeholder="Портрет (URL)"
                            />
                            <button
                              className="ghost-btn characters-avatar-btn"
                              onClick={() => pickCharacterAvatar(c.id)}
                              type="button"
                            >
                              Загрузить фото
                            </button>
                          </div>

                          <div className="character-card-fields">
                            {characterFields.map((f) => (
                              <div className="character-field-block" key={`${c.id}-${f.id}`}>
                                <div className="character-field-label">{f.label}</div>
                                <textarea
                                  className="form-textarea characters-textarea"
                                  value={c.fields?.[f.id] ?? ""}
                                  onChange={(e) => updateCharacterField(c.id, f.id, e.target.value)}
                                  placeholder={f.label}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

  <div className="danger-zone">
  <div className="danger-title">Опасная зона</div>

  <div className="danger-actions">
    <button className="danger-btn" onClick={onDeleteProject}>
      Удалить фанфик
    </button>

    <button
      className="ghost-btn"
      onClick={onCleanupAssets}
      disabled={cleanupRunning}
      title="Удалить старые обложки и неиспользуемые аватары"
    >
      {cleanupRunning ? "Очищаю…" : "Очистить неиспользуемые файлы"}
    </button>

    <button
      className="save-btn-green"
      onClick={onSaveMeta}
      disabled={!metaDirty || metaSaving}
      title={!metaDirty ? "Нет изменений" : "Сохранить настройки"}
    >
      {metaSaving ? "Сохраняю…" : "Сохранить"}
    </button>
    <span className="danger-status">
      {metaDirty ? "• есть изменения" : "• без изменений"}
    </span>
  </div>

  {cleanupInfo ? (
    <div className="danger-hint" style={{ marginTop: 6 }}>
      {cleanupInfo}
    </div>
  ) : null}

  <div className="danger-hint">
    Удалятся все главы и файлы проекта. Отменить нельзя.
</div>

            </div>
        </div>
        </div>
        </div>
      {/* CONTEXT MENU */}
      {ctxOpen && ctxChapter && (
        <div
          style={{
            position: "fixed",
            left: ctxPos.x,
            top: ctxPos.y,
            zIndex: 10000,
            minWidth: 210,
            padding: 8,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(20,20,24,0.92)",
            backdropFilter: "blur(6px)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div style={{ padding: "8px 10px", opacity: 0.8, fontSize: 12 }}>{ctxChapter.title}</div>

          <button className="ctx-item" onClick={(e) => { e.stopPropagation(); ctxOpenChapter(); }}>
            Открыть
          </button>
          <button className="ctx-item" onClick={(e) => { e.stopPropagation(); ctxRename(); }}>
            Переименовать
          </button>

          <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "6px 0" }} />

          <button className="ctx-item danger" onClick={(e) => { e.stopPropagation(); ctxDelete(); }}>
            Удалить
          </button>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => !creating && setShowCreateModal(false)}
        >
          <div
            style={{
              width: 520,
              padding: 16,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(20,20,24,0.78)",
              backdropFilter: "blur(3px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, marginBottom: 10 }}>Новая глава</div>

            <input
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              placeholder="Название главы"
              className="form-input"
              autoFocus
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <button className="ghost-btn" onClick={() => setShowCreateModal(false)} disabled={creating}>
                Отмена
              </button>

              <button
                className="primary-btn"
                onClick={() =>
                  onCreateChapter(newChapterTitle.trim() || `Глава ${(project?.chapters?.length ?? 0) + 1}`)
                }
                disabled={creating}
              >
                {creating ? "Создаю…" : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





