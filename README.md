# 舞台配置図作成アプリ

ホール舞台平面図への実寸オブジェクト配置・図面出力システムのひな型(Phase 0相当)。

要件定義書: 「舞台配置図アプリ_要件定義書_v1.0.md」に基づく。

## 最重要設計原則

> 背景画像上のピクセル座標を正本にしない。すべての配置物はmm単位の座標・寸法・角度を正本として保持する。画面ズームや画像解像度が変わっても実寸値は変化しないこと。

## セットアップ

```bash
npm install
npm run dev        # 開発サーバー起動
npm test           # 単体テスト(Vitest)
npm run typecheck  # TypeScript strict チェック
npm run build      # 静的ビルド(GitHub Pages等へ配置可能)
```

## 現時点でできること(ひな型の範囲)

1. 背景画像(PNG/JPEG)の読み込み
2. 2点校正: 図面上の2点をクリック → 実距離入力(910/1820/900/1800/1000mmプリセット、mm/cm/m単位対応)
3. プリセット配置: 椅子・譜面台・指揮台・山台・ピアノ等(付録Aの一部)を実寸で配置
4. 選択・ドラッグ移動・複製・削除・ロック
5. プロパティパネルで座標・寸法・角度・高さ・ラベルを数値編集(ドラッグでの拡大縮小は不可 = FR-043)
6. 距離測定(2点間のmm表示)
7. ホイールズーム(カーソル中心)・空白ドラッグでパン。ズームしても実寸は不変
8. 自動保存(localStorage・1.5秒デバウンス)と復元
9. プロジェクトのJSON書き出し・読み込み(schemaVersion付き、未知フィールド無視)
10. 未校正時は配置を禁止し、警告バナーを常時表示(AC-013)

## ディレクトリ構成

```
src/
├─ types/project.ts        # データモデル(第9章)。heightMm・wallsをPhase 0から定義
├─ core/
│  ├─ transform.ts         # 座標変換の純粋関数(9.4)。px⇔mm、校正計算、回転境界
│  ├─ transform.test.ts    # 自動テスト必須領域(11.4)
│  ├─ presets.ts           # オブジェクトプリセット(付録A)・校正距離プリセット
│  ├─ project.ts           # プロジェクト生成・JSON保存/復元(6.3)
│  └─ project.test.ts
├─ state/appState.ts       # reducer。全編集をAction経由に統一(将来のUndo/Redo基盤)
├─ components/
│  ├─ Toolbar.tsx          # 上部ツールバー
│  ├─ LibraryPanel.tsx     # 左: オブジェクトライブラリ
│  ├─ CanvasStage.tsx      # 中央: SVGキャンバス(Pointer Events統一)
│  ├─ PropertyPanel.tsx    # 右: プロパティ(数値編集)
│  ├─ StatusBar.tsx        # 下部: 縮尺・座標・保存状態
│  └─ CalibrationDialog.tsx# 校正距離入力(FR-021プリセット付き)
├─ App.tsx                 # 画面構成(10.1)・自動保存
└─ main.tsx
```

## 設計上の決め事(実装済み)

- **mm正本**: SceneObjectは `xMm/yMm/widthMm/depthMm/heightMm/rotationDeg` のみを正本とする。px値は保存しない(12.1)
- **回転は描画変換**: 回転してもwidthMm/depthMmを入れ替えない(6.2、AC-006)
- **座標変換の集約**: `core/transform.ts` の純粋関数のみで変換。UIに散在させない
- **校正基準点は画像px座標で保存**: 再校正時に既存オブジェクトのmm値は不変(FR-023)
- **schemaVersion必須**: 復元時に未知フィールドを無視し、不正値を補正。破壊的変更はマイグレーションで対応(12.1)
- **未校正時の背景表示**: 暫定スケール(10mm/px)で表示のみ行い、実寸配置は禁止

## 今後の実装ロードマップ(要件定義書 第13章)

| フェーズ | 未実装の主な項目 |
|---|---|
| Phase 1 | PDF読み込み(PDF.js)、背景の回転・切り抜きUI、微回転、校正確認(FR-024) |
| Phase 2 | 複数選択・矩形選択、整列・等間隔配置、グループ化、Undo/Redo(FR-053)、回転ハンドル(15度スナップ)、iPadタッチ操作系(ピンチズーム・2本指パン) |
| Phase 3 | IndexedDBへの保存移行、PNG出力、PDF出力(pdf-lib)、印刷縮尺保証(1:50/1:100、FR-082)、出力情報欄 |
| Phase 4 | レイヤーUI、注釈、行列配置、プルト弧状配置(FR-061)、スナップ、山台関連付け |
| Phase 5 | 壁トレース、Three.jsによる3D一人称ビュー(遅延読み込み) |

### ひな型からの引き継ぎメモ

- Undo/Redoを見据えて全編集は `state/appState.ts` のAction経由。履歴実装時はreducerをラップしてコマンド履歴化する
- `walls` / `stageFront` / `onRiserId` / `avatar` はスキーマに予約済み(Phase 5用)。空のまま保存される
- 自動保存はlocalStorage(容量制限あり)。背景Base64が大きい場合に備え、Phase 3でIndexedDBへ移行すること
- UI文字列は現状コンポーネント内に直書き。多言語化(NFR-014)時に分離する
- タッチ操作: `touch-action: none` とPointer Eventsで基盤は用意済みだが、ピンチズーム・2本指パンは未実装
