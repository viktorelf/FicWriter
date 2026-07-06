import { exportToBlob, type Editor } from "tldraw";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

export async function exportMindMapPng(editor: Editor) {
  const ids = Array.from(editor.getCurrentPageShapeIds()) as any;
  if (!ids.length) return;

  const path = await save({
    defaultPath: "mindmap.png",
    filters: [{ name: "PNG", extensions: ["png"] }],
  });
  if (!path) return;

  const blob = await exportToBlob({ editor, ids, format: "png" });
  const buffer = new Uint8Array(await blob.arrayBuffer());
  await writeFile(path, buffer);
}
