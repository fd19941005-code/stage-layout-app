import { useState, type SyntheticEvent } from "react";
import type { RequirementCount, RequirementScope } from "../core/requirements";

interface Props {
  counts: RequirementCount[];
  scope: RequirementScope;
  onScopeChange: (scope: RequirementScope) => void;
}

function formatQuantity(value: number): string {
  return value.toLocaleString("ja-JP");
}

export function RequirementsPanel({ counts, scope, onScopeChange }: Props) {
  const totalObjects = counts.reduce((total, row) => total + row.count, 0);
  const [expanded, setExpanded] = useState(true);

  return (
    <details className="requirements-panel" open={expanded} onToggle={(event: SyntheticEvent<HTMLDetailsElement>) => setExpanded(event.currentTarget.open)}>
      <summary>必要物一覧</summary>
      <div className="requirements-panel-body">
        <p className="sr-only" role="status" aria-live="polite">
          {counts.length === 0 ? "配置物はありません" : counts.map((row) => row.label + " " + row.count + "個").join("、")}
        </p>
        <fieldset className="requirements-scope">
          <legend>集計範囲</legend>
          <label>
            <input
              type="radio"
              name="requirements-scope"
              value="visible"
              checked={scope === "visible"}
              onChange={() => onScopeChange("visible")}
            />
            表示中
          </label>
          <label>
            <input
              type="radio"
              name="requirements-scope"
              value="all"
              checked={scope === "all"}
              onChange={() => onScopeChange("all")}
            />
            すべて
          </label>
        </fieldset>

        {counts.length === 0 ? (
          <p className="requirements-empty">配置物はありません</p>
        ) : (
          <>
            <div className="requirements-table-wrap">
              <table className="requirements-table">
                <caption className="sr-only">必要物の数量一覧</caption>
                <thead>
                  <tr>
                    <th scope="col">品名</th>
                    <th scope="col">数量</th>
                    <th scope="col">カテゴリ</th>
                  </tr>
                </thead>
                <tbody>
                  {counts.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">{row.label}</th>
                      <td className="requirements-count">{formatQuantity(row.count)}</td>
                      <td>{row.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="requirements-total">
              合計 {formatQuantity(counts.length)}種類 / {formatQuantity(totalObjects)}個
            </p>
          </>
        )}
      </div>
    </details>
  );
}
