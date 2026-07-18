# MVP受入確認ハンドオフ

更新日: 2026-07-18
対象: `docs/要件定義書_v1.0.md` AC-001〜AC-016
実装コミット: `941a23e` (Phase 1)、`c65f76d` (Phase 2)、`2c87a5d` / `35afbe6` (Phase 3)

## AC確認状況

| ID | 状態 | 検証内容・残る確認 |
|---|---|---|
| AC-001 | テストで検証済み | `src/core/phase1Acceptance.test.ts` で10,000mm校正後の再測定が9,900〜10,100mmに入ることを確認。 |
| AC-002 | テストで検証済み | 910mm校正と450mm椅子プリセットの比率を同テストで確認。 |
| AC-003 | テストで検証済み | `src/core/transform.test.ts` のズームテストでmm座標が変化しないことを確認。 |
| AC-004 | テストで検証済み | PDFページ、背景90度回転、切り抜きの保存・復元を `project.test.ts` で確認。 |
| AC-005 | テストで検証済み | `src/state/mvpObjectAcceptance.test.ts` で椅子を500×550mmへ変更し、mm外接矩形を確認。 |
| AC-006 | テストで検証済み | 30度回転後もwidthMm/depthMmを入れ替えないことを同テストとtransformテストで確認。 |
| AC-007 | テストで検証済み | 10個の選択物の水平整列・等間隔配置を `src/core/layout.test.ts` で確認。 |
| AC-008 | テストで検証済み | 配置・移動・回転・削除のUndo/Redoとドラッグ履歴の集約を `appState.phase2.test.ts` で確認。 |
| AC-009 | テストで検証済み | 背景、校正、20個のオブジェクト、位置・寸法・角度・heightMmのJSON保存復元を `mvpAcceptance.test.ts` で確認。IndexedDB自動保存と旧localStorageキーのフォールバックも実装済み。 |
| AC-010 | 実装済みだが人間の確認待ち | mm正本からPNG用SVG/Canvasを再描画し、選択枠・回転ハンドル・範囲選択枠を除外するテスト済み。ブラウザでPNGをダウンロードし、背景と配置物の相対位置を目視確認する。 |
| AC-011 | 実装済みだが人間の確認待ち | pdf-libでA4/A3・縦横の1ページPDFを生成する統合テスト済み。ブラウザでA3横PDFをダウンロードし、PDFビューアで1ページか確認する。 |
| AC-012 | 実装済みだが人間の確認待ち | 1820mmを1:100で18.2mmへ変換する計算とPDFページ生成をテスト済み。A3を100%（自動拡大縮小なし）で印刷し、定規で18.2mm±1mmを実測する。 |
| AC-013 | テストで検証済み | `canPlaceObjects`、未校正時のライブラリ無効化・出力無効化・警告表示をテストとブラウザ起動スモークで確認。 |
| AC-014 | テストで検証済み | 非対応拡張子、空/破損PDF、破損JSONを例外として安全に扱う入力ヘルパー・復元テストを確認。実ファイルでの操作確認は任意。 |
| AC-015 | 実装済みだが人間の確認待ち | Pointer Events、2本指パン/ピンチ、回転ハンドル、タッチ向けレスポンシブ配置、PDF出力を実装。実機iPad Safariで「取り込み→校正→配置→移動→回転→複製→PDF」を通し確認する。 |
| AC-016 | テストで検証済み | 山台プリセットのheightMm=300と「段高300mm」ラベル、保存復元を `mvpAcceptance.test.ts` で確認。 |

## 実装内容

- Phase 1: PDF.js同梱によるPDFページ読込、背景回転・切り抜き、校正確認。
- Phase 2: reducer経由のUndo/Redo、複数選択、整列・等間隔、回転ハンドル15度スナップ、Pointer Eventsによるタッチ編集。
- Phase 3: IndexedDB自動保存、旧localStorageからのフォールバック、PNG/PDF出力、A4/A3・縦横・1:50/1:100/フィット、出力レイヤー、出力情報欄。
- PDF出力はpdf-libでmm→PDFポイントを固定し、欄外情報はブラウザの日本語フォントで画像化して埋め込む。PDF.js/pdf-libとも外部CDNを使用しない。
- 保存JSONの正本は引き続きxMm/yMm/widthMm/depthMm/heightMm/rotationDegで、表示用pxや編集UI状態は保存しない。

## 変更ファイル

`deaf7c8..HEAD` の変更対象:

`package.json`, `package-lock.json`, `src/App.tsx`, `src/main.tsx`, `src/phase2.css`, `src/phase3.css`, `src/styles.css`, `src/types/project.ts`, `src/vite-env.d.ts`, `src/state/appState.ts`, `src/state/appState.test.ts`, `src/state/appState.phase2.test.ts`, `src/state/mvpObjectAcceptance.test.ts`, `src/components/BackgroundPanel.tsx`, `src/components/CalibrationVerificationDialog.tsx`, `src/components/CanvasStage.tsx`, `src/components/ExportDialog.tsx`, `src/components/LibraryPanel.tsx`, `src/components/PropertyPanel.tsx`, `src/components/StatusBar.tsx`, `src/components/Toolbar.tsx`, `src/core/transform.ts`, `src/core/transform.test.ts`, `src/core/project.ts`, `src/core/project.test.ts`, `src/core/pdf.ts`, `src/core/pdf.test.ts`, `src/core/phase1Acceptance.test.ts`, `src/core/layout.ts`, `src/core/layout.test.ts`, `src/core/storage.ts`, `src/core/storage.test.ts`, `src/core/export.ts`, `src/core/export.test.ts`, `src/core/export.integration.test.ts`, `src/core/export.info.test.ts`, `src/core/calibration.test.ts`, `src/core/mvpAcceptance.test.ts`。

## 完了時の検証結果

- `npm test`: 14ファイル、57テスト通過。
- `npm run typecheck`: 通過。
- `npm run build`: 通過。PDF.js/pdf-lib同梱によりチャンクサイズ警告あり（ビルド失敗ではない）。
- lint: `package.json` にlintスクリプトがないため未実行。
- `git diff --check`: 改行コード変換の警告のみ、空白エラーなし。
- Phase 3のブラウザ起動スモーク: HTTP 200、日本語UI、未校正時の配置/出力禁止、コンソールerror/warningなしを確認。

## 人間による最終確認

1. ブラウザで校正済みプロジェクトを開き、PNGを出力して背景・配置物の相対位置と編集UI非表示を確認。
2. A3横・1:100 PDFを出力し、PDFビューアで1ページと出力情報欄を確認。
3. 同PDFをプリンタ倍率100%で印刷し、1820mm基準線が18.2mm±1mmか実測。
4. 実機iPad SafariでAC-015の一連の操作を確認。

上記は環境依存のため自動テストでは代替せず、確認完了後に本表の「人間の確認待ち」を更新する。

## コメントの意図

コメントは、mm正本と表示変換の境界、IndexedDB失敗時のローカルフォールバック、標準PDFフォントを避ける日本語欄外描画、Pointer Eventsのキャンセル/捕捉理由など、将来壊れやすい制約と設計意図に限定して追加した。

## 意図しない差分

最終確認時点で、Phase 0完了時点からの変更は上記のPhase 1〜3実装・テストに限定され、未追跡のビルド成果物や意図しない差分はない。
