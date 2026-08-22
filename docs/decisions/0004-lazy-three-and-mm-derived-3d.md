# ADR-0004: 3Dはmmから派生する遅延ロードの閲覧機能にする

- 状態: 採用
- 対象: 3Dビュー、初回ロード、保守性

## 背景

3D表示は有用だが、2D配置編集の常時利用には必要ない。Three.jsを初期画面へ含めると初回ロードが重くなり、独自WebGL実装を増やすと保守・テスト範囲が広がる。

## 決定

3Dの意味モデルは`src/core/scene3d.ts`でProjectのmm値から純粋に生成し、Three.jsのUIは`src/components/Viewer3D.tsx`で遅延読み込みする。3Dのメッシュ、カメラ、画面pxは保存しない。3D読込や描画に問題がある場合も、2D編集とProjectの正本を維持する。

## 理由と結果

- 2D編集の初回ロードと依存範囲を抑えられる。
- 3Dの寸法整合をcoreテストで検証できる。
- Three.jsを自前WebGLへ置き換える必要がなく、保守面のリスクを抑えられる。
- ビルドにはThree.js由来の大きなチャンク警告が残るため、性能は別途評価する。

## 根拠

`src/core/scene3d.ts`、`src/components/Viewer3D.tsx`、`src/core/scene3d.test.ts`、Phase 5の実装履歴。
