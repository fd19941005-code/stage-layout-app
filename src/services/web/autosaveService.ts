import type { AutosaveService } from "../contracts";
import type { Project } from "../../types/project";
import { loadAutosavedProject, saveAutosavedProject } from "../../core/storage";

/** 既存のIndexedDB/localStorage実装をサービス契約へ適合させるWebアダプター。 */
export class WebAutosaveService implements AutosaveService {
  loadProject(): Promise<Project | undefined> {
    return loadAutosavedProject();
  }

  saveProject(project: Project): Promise<void> {
    return saveAutosavedProject(project);
  }
}
