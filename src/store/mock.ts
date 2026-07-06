export type Project = {
  id: string;
  title: string;
  chaptersCount: number;
  updatedLabel: string;
};

export type Chapter = {
  id: string;
  title: string;
  updatedLabel: string;
  content: string;
};

export function getMockProjects(): Project[] {
  return [
    { id: "morgana", title: "Жемчуг острова Морганы", chaptersCount: 1, updatedLabel: "обновлено сегодня" },
    { id: "ash", title: "Пепел", chaptersCount: 3, updatedLabel: "вчера" },
  ];
}

export function getMockChapters(projectId: string): Chapter[] {
  if (projectId === "morgana") {
    return [
      {
        id: "ch1",
        title: "Глава 1",
        updatedLabel: "сегодня",
        content: "Тут будет твой текст…\n\n(Это пока мок, дальше подключим SQLite.)",
      },
    ];
  }
  return [
    { id: "ch1", title: "Глава 1", updatedLabel: "3 дня назад", content: "" },
    { id: "ch2", title: "Глава 2", updatedLabel: "вчера", content: "" },
    { id: "ch3", title: "Глава 3", updatedLabel: "вчера", content: "" },
  ];
}
