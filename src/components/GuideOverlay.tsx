import type { Project } from "../types/project";
import { guideArcPath, guideGeometry, resolveGuideAnchor, type GuideBounds } from "../core/guides";

interface Props {
  project: Project;
  bounds: GuideBounds;
  zoom: number;
}

export function guideBoundsForProject(project: Project, stageWidthMm: number, stageHeightMm: number): GuideBounds {
  const objectBounds = project.objects.map((object) => ({
    minXMm: object.xMm - object.widthMm / 2,
    minYMm: object.yMm - object.depthMm / 2,
    maxXMm: object.xMm + object.widthMm / 2,
    maxYMm: object.yMm + object.depthMm / 2,
  }));
  return {
    minXMm: Math.min(-1000, ...objectBounds.map((bounds) => bounds.minXMm)),
    minYMm: Math.min(-1000, ...objectBounds.map((bounds) => bounds.minYMm)),
    maxXMm: Math.max(1000, stageWidthMm, ...objectBounds.map((bounds) => bounds.maxXMm)) + 1000,
    maxYMm: Math.max(1000, stageHeightMm, ...objectBounds.map((bounds) => bounds.maxYMm)) + 1000,
  };
}

export function GuideOverlay({ project, bounds, zoom }: Props) {
  const hitWidth = Math.max(80, 120 / Math.max(0.005, zoom));
  return (
    <>
      {project.guides.filter((guide) => guide.visible).map((guide) => {
        const resolvedGuide = resolveGuideAnchor(guide, project.objects);
        const geometry = guideGeometry(resolvedGuide, bounds);
        const className = `editing-guide${guide.locked ? " locked" : ""}`;
        const hit = geometry.kind === "line"
          ? <line className="editing-guide-hit" x1={geometry.start.xMm} y1={geometry.start.yMm} x2={geometry.end.xMm} y2={geometry.end.yMm} style={{ strokeWidth: hitWidth }} />
          : <path className="editing-guide-hit" d={guideArcPath(geometry)} style={{ strokeWidth: hitWidth }} />;
        const visible = geometry.kind === "line"
          ? <line className="editing-guide-line" x1={geometry.start.xMm} y1={geometry.start.yMm} x2={geometry.end.xMm} y2={geometry.end.yMm} />
          : <path className="editing-guide-line" d={guideArcPath(geometry)} />;
        return (
          <g key={guide.id} data-guide-id={guide.id} className={className}>
            {hit}
            {visible}
            {(guide.kind === "radial" || guide.kind === "arc") && <circle className="editing-guide-anchor" cx={resolvedGuide.xMm} cy={resolvedGuide.yMm} r={Math.max(40, 70 / Math.max(0.005, zoom))} />}
          </g>
        );
      })}
    </>
  );
}
