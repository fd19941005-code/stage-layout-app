import type { FileService, ProjectService } from "../contracts";
import type { Project } from "../../types/project";
import { deserializeProject, serializeProject } from "../../core/project";

function safeProjectFilename(name: string): string {
  const normalized = name.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 80);
  return `${normalized || "stage-layout"}.stage.json`;
}

/** JSONの内容とファイル入出力を分離するWeb版プロジェクトサービス。 */
export class WebProjectService implements ProjectService {
  constructor(private readonly files: FileService) {}

  async openProject(): Promise<Project | null> {
    const file = await this.files.openFile({ accept: [".stage.json", ".json", "application/json"] });
    if (!file) return null;
    const json = new TextDecoder().decode(file.bytes);
    return deserializeProject(json);
  }

  saveProject(project: Project): Promise<void> {
    return this.files.saveFile({
      filename: safeProjectFilename(project.name),
      mimeType: "application/json",
      data: serializeProject(project),
    });
  }
}

export { safeProjectFilename };
