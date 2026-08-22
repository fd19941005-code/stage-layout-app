# ADR-0001: mmを正本にし、表示状態を分離する

- 状態: 採用
- 対象: 配置、変換、保存、出力、3D

## 背景

舞台図面では、画面の拡大率やSVGの描画サイズではなく、実寸と縮尺が成果物の意味を持つ。描画ライブラリの座標を保存すると、ズーム、回転、ライブラリ変更でプロジェクトの意味が変わる。

## 決定

配置物の位置・寸法・高さ・角度は `xMm/yMm/widthMm/depthMm/heightMm/rotationDeg` を正本にする。px、SVGの外接矩形、Three.jsのmeshやcameraは派生値とし、`transform.ts`、`export.ts`、`scene3d.ts`で必要なときだけ計算する。回転は表示変換であり、width/depthは交換しない。ズーム・パンはProjectの実寸値へ影響させない。

## 理由と結果

- 保存JSONが画面サイズ・描画ライブラリから独立する。
- PNG/PDFと3Dを同じ実寸データから生成できる。
- 座標変換のバグを`src/core/transform.ts`の純粋関数とテストへ集約できる。
- 画面イベントを実寸へ変換する境界が明確になる一方、UIでpxを扱う場合も保存値と混ぜない注意が必要になる。

## 根拠

`AGENTS.md`、`docs/要件定義書_v1.0.md`、`src/types/project.ts`、`src/core/transform.ts`、`src/core/export.ts`、`src/core/scene3d.ts`。
