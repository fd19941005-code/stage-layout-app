import type { AlignmentGuideLine } from "../core/alignmentGuides";

interface Props {
  guides: readonly AlignmentGuideLine[];
  zoom: number;
}

/** ドラッグ中だけ表示する整列ガイド。Projectやエクスポートには含めない。 */
export function SmartAlignmentGuideOverlay({ guides, zoom }: Props) {
  if (guides.length === 0) return null;
  const safeZoom = Math.max(0.005, zoom);
  const labelSizeMm = 14 / safeZoom;
  const labelOffsetMm = 8 / safeZoom;
  return (
    <g
      className="smart-alignment-guides"
      role="status"
      aria-live="polite"
      aria-label="オブジェクト整列ガイドを表示中"
    >
      {guides.map((guide) => {
        const key = `${guide.axis}-${guide.movingObjectId}-${guide.targetObjectId}`;
        const isVertical = guide.axis === "vertical";
        const labelX = isVertical ? guide.positionMm + labelOffsetMm : guide.fromMm + labelOffsetMm;
        const labelY = isVertical ? guide.fromMm + labelSizeMm + labelOffsetMm : guide.positionMm - labelOffsetMm;
        return (
          <g key={key} className={`smart-alignment-guide ${guide.axis}`}>
            {isVertical
              ? <line className="smart-alignment-guide-line" x1={guide.positionMm} y1={guide.fromMm} x2={guide.positionMm} y2={guide.toMm} />
              : <line className="smart-alignment-guide-line" x1={guide.fromMm} y1={guide.positionMm} x2={guide.toMm} y2={guide.positionMm} />}
            <text
              className="smart-alignment-guide-label"
              x={labelX}
              y={labelY}
              fontSize={labelSizeMm}
              dominantBaseline={isVertical ? "auto" : "central"}
            >
              {guide.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
