import type { Guide, PointMm, Project } from "../types/project";
import { getBackgroundDisplaySizePx } from "./transform";
import {
  createStageCenterGuide,
  createStageFrontGuide,
  movedGuideCoordinates,
  normalizeGuide,
  synchronizeGeneratedGuides,
} from "./guides";

export function stageWidthMm(project: Project, mmPerPixel: number): number | null {
  if (project.background.naturalWidthPx <= 0 || !Number.isFinite(mmPerPixel) || mmPerPixel <= 0) return null;
  return getBackgroundDisplaySizePx(project.background).widthPx * mmPerPixel;
}

export function synchronizeProjectGuides(
  project: Project,
  mmPerPixel: number,
  stageFrontYMm: number | null | undefined = project.stageFront?.yMm,
): Project {
  return {
    ...project,
    guides: synchronizeGeneratedGuides(project.guides, {
      stageWidthMm: stageWidthMm(project, mmPerPixel),
      stageFrontYMm,
    }),
  };
}

export function addGuideToProject(project: Project, guide: Guide): Project | null {
  const normalized = normalizeGuide(guide);
  if (!normalized.id || project.guides.some((candidate) => candidate.id === normalized.id)) return null;
  return { ...project, guides: [...project.guides, normalized] };
}

export function addStageCenterGuideToProject(project: Project, id: string, mmPerPixel: number): Project | null {
  const widthMm = stageWidthMm(project, mmPerPixel);
  return widthMm === null ? null : addGuideToProject(project, createStageCenterGuide(id, widthMm));
}

export function addStageFrontGuideToProject(project: Project, id: string, distanceMm: number): Project | null {
  const stageFrontYMm = project.stageFront?.yMm;
  if (stageFrontYMm === undefined || !Number.isFinite(distanceMm) || distanceMm < 0) return null;
  return addGuideToProject(project, createStageFrontGuide(id, stageFrontYMm, distanceMm));
}

export function updateGuideInProject(project: Project, id: string, patch: Partial<Guide>): Project | null {
  const current = project.guides.find((guide) => guide.id === id);
  if (!current) return null;
  const geometryChanged = Object.keys(patch).some((key) => key !== "locked" && key !== "visible");
  if (current.locked && geometryChanged) return null;
  const detachesPodium = current.podiumId !== null
    && patch.podiumId === undefined
    && (patch.xMm !== undefined || patch.yMm !== undefined);
  let next = normalizeGuide({ ...current, ...patch, ...(detachesPodium ? { podiumId: null } : {}) });
  if (next.kind === "stageFrontOffset" && project.stageFront && patch.distanceMm !== undefined) {
    next = normalizeGuide({ ...next, yMm: project.stageFront.yMm - (next.distanceMm ?? 0) });
  }
  return { ...project, guides: project.guides.map((guide) => guide.id === id ? next : guide) };
}

export function moveGuideInProject(project: Project, id: string, target: PointMm): Project | null {
  const current = project.guides.find((guide) => guide.id === id);
  if (!current || current.locked || !Number.isFinite(target.xMm) || !Number.isFinite(target.yMm)) return null;
  const coordinates = movedGuideCoordinates(current, {
    xMm: target.xMm - current.xMm,
    yMm: target.yMm - current.yMm,
  });
  let next = normalizeGuide({ ...current, ...coordinates, ...(current.podiumId ? { podiumId: null } : {}) });
  if (next.kind === "stageFrontOffset" && project.stageFront) {
    next = normalizeGuide({ ...next, distanceMm: Math.max(0, project.stageFront.yMm - next.yMm) });
  }
  return { ...project, guides: project.guides.map((guide) => guide.id === id ? next : guide) };
}

export function deleteGuideFromProject(project: Project, id: string): Project | null {
  const current = project.guides.find((guide) => guide.id === id);
  if (!current || current.locked) return null;
  return { ...project, guides: project.guides.filter((guide) => guide.id !== id) };
}

export function setGuideLockedInProject(project: Project, id: string, locked: boolean): Project | null {
  if (!project.guides.some((guide) => guide.id === id)) return null;
  return { ...project, guides: project.guides.map((guide) => guide.id === id ? { ...guide, locked } : guide) };
}

export function setGuideVisibleInProject(project: Project, id: string, visible: boolean): Project | null {
  if (!project.guides.some((guide) => guide.id === id)) return null;
  return { ...project, guides: project.guides.map((guide) => guide.id === id ? { ...guide, visible } : guide) };
}
