import { Routes, Route, Navigate } from "react-router-dom";
import RootLayout from "./layouts/RootLayout";

import LibraryScreen from "./screens/LibraryScreen";
import ProjectScreen from "./screens/ProjectScreen";
import EditorScreen from "./screens/EditorScreen";
import WallpapersScreen from "./screens/WallpapersScreen";
import NotebookScreen from "./screens/NotebookScreen";
import InteractiveBoardScreen from "./board/InteractiveBoardScreen";

export default function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route path="/" element={<LibraryScreen />} />
        <Route path="/project/:projectId" element={<ProjectScreen />} />
        <Route path="/project/:projectId/chapter/:chapterId" element={<EditorScreen />} />
        <Route path="/wallpapers" element={<WallpapersScreen />} />
        <Route path="/notes" element={<NotebookScreen />} />
        <Route path="/board" element={<InteractiveBoardScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
