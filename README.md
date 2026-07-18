# 舞台配置図作成アプリ

ホール舞台平面図へ実寸(mm)でオブジェクトを配置し、配置図をPNG/PDFへ出力するローカル完結のWebアプリです。

要件定義書: [docs/要件定義書_v1.0.md](docs/要件定義書_v1.0.md)

## 現在の実装範囲

Phase 1〜4まで実装済みです。

- PNG/JPEG/PDF背景の読み込み、PDFページ選択
- 背景90度回転、切り抜き、2点校正、校正確認
- 椅子・譜面台・山台・ピアノ・打楽器などの実寸プリセット配置
- 選択、移動、複製、削除、ロック、数値編集、15度回転スナップ
- 複数選択、矩形選択、整列、等間隔配置、グループ化、Undo/Redo
- Pointer Eventsによるマウス・タッチ操作、2本指パン／ピンチズーム
- IndexedDB自動保存、JSON保存／復元、schemaVersionマイグレーション
- PNG/PDF出力、A4/A3・縦横・1:50/1:100/フィット、出力情報欄
- 背景／オブジェクト／注釈レイヤーの表示・ロック
- グリッド・他オブジェクト・舞台中心線へのmmスナップ
- 行列配置、椅子2脚＋譜面台1台のプルト弧状配置
- テキスト、線、矢印、矩形、円、寸法線の注釈
- オブジェクトと山台の手動関連付け(onRiserId)
- 付録Aの追加楽器プリセット

## セットアップ

```bash
npm install
npm run dev        # 開発サーバー起動
npm test           # 単体テスト(Vitest)
npm run typecheck  # TypeScript strictチェック
npm run build      # 静的ビルド
```

開発サーバーの既定URLは http://127.0.0.1:5173/ です。

## 設計原則

- 配置物の正本はxMm/yMm/widthMm/depthMm/heightMm/rotationDeg。画面pxや描画ライブラリ固有値は保存しません。
- 回転は描画変換だけで表現し、widthMmとdepthMmを入れ替えません。
- px⇔mm変換と外接矩形計算はsrc/core/transform.tsへ集約しています。
- すべての編集はsrc/state/appState.tsのAction経由です。
- Pointer Eventsでマウス・タッチ入力を統一しています。
- 外部サーバーへプロジェクトデータを送信せず、外部CDNにも依存しません。

## ディレクトリ構成

```
src/
├─ types/project.ts          # 保存モデル、レイヤー、注釈、スナップ設定
├─ state/appState.ts         # reducer、Action、Undo/Redo
├─ core/
│  ├─ transform.ts           # px⇔mm、校正、回転／注釈外接矩形
│  ├─ arrangement.ts         # 行列・プルト弧状配置
│  ├─ snap.ts                # 実寸スナップ
│  ├─ layout.ts              # 整列・等間隔配置
│  ├─ export.ts              # PNG/PDF共通SVGと縮尺計算
│  ├─ pdf.ts                 # PDF背景のページ描画
│  ├─ project.ts             # JSON保存・復元・マイグレーション
│  └─ presets.ts             # 付録Aプリセット
├─ components/
│  ├─ CanvasStage.tsx        # SVGキャンバス、Pointer Events
│  ├─ LayerPanel.tsx         # レイヤー表示／ロック
│  ├─ SnapPanel.tsx          # スナップ設定
│  ├─ ArrangementDialog.tsx  # 行列配置
│  └─ PultArcDialog.tsx      # プルト弧状配置
└─ App.tsx                   # 画面構成・自動保存
```

## 検証

Phase 4専用受入テストを含め、npm testは19テストファイル・68テストです。受入条件の自動検証状況と、人間による印刷／実機確認事項はHANDOFF.mdに記録しています。

## 今後

Phase 5は壁トレース、山台を含む3D一人称ビュー、簡易アバター、視点切替です。

