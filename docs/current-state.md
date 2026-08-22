# 現在の実装状況

調査日: **2026-08-20**
調査時のcheckout: `codex/physical-instrument-scale`
調査開始時のHEAD: `3330050`（`Add stage templates and persistence safeguards`、2026-08-04）
リモート`main`: `a730ef2`（PR #7のマージ、`3330050`を含む）
ローカル`main`: `b130609`（調査時点で`origin/main`より17コミット遅れ）
調査時点の保存スキーマ: `1.10.0`（`src/types/project.ts`）

この文書は、調査日時点の現在状態のSource of Truthである。履歴を追記する日誌ではなく、実装変更や検証結果が変わったときに現行スナップショットを書き換える。

## 作業ツリーの注意

調査開始時点で、次のアプリ本体ファイルにユーザーの未コミット変更があった。今回の文書整備では内容を変更していない。

```text
src/App.tsx
src/components/LibraryPanel.tsx
src/components/PropertyPanel.tsx
src/components/RequirementsPanel.tsx
src/components/StatusBar.tsx
src/components/Toolbar.tsx
src/components/useDialogFocus.ts
src/symbol-library.css
src/ui-refresh.css
```

これらはパネルのレスポンシブ表示、ARIA、フォーカス、ステータス表示などの作業中変更を含む。次の実装タスクでは、まずこの差分をレビューし、文書の基準状態と混ぜないこと。

現在のcheckoutのHEADはすでに`origin/main`へ取り込まれているが、ローカル`main`は古い。未コミット差分があるため、次のGit操作では先に`git status`と対象差分を確認し、作業ツリーを保護したうえで基準ブランチを明示する。古いローカル`main`を現在状態の根拠にしない。

## 現在利用できる実装

コードと自動テストから、次の領域は実装済みと判断できる。

| 領域 | 現状 | 主な根拠 |
| --- | --- | --- |
| プロジェクト型・保存 | schemaVersion付きProject、JSON入出力、旧形式マイグレーション、未知フィールド無視 | `src/types/project.ts`, `src/core/project.ts`, `src/core/project.test.ts` |
| 新規作成・舞台テンプレート | 背景画像なしの実寸舞台、1間=1820mmグリッド、中央／手前基準、保存・スナップ・PNG/PDF連携 | `src/core/stageTemplate.ts`, `src/components/NewProjectDialog.tsx`, 関連テスト |
| 背景 | PNG/JPEG、PDFページ、90度回転、切り抜き、2点校正、校正確認 | `src/core/transform.ts`, `src/services/web/`, 関連テスト |
| 実寸変換 | px/mm、校正、画面変換、回転外接矩形、ズーム・フィット | `src/core/transform.ts`, `src/core/transform.test.ts` |
| 2D編集 | 単一・複数・矩形選択、移動、複製、削除、ロック、グループ、整列、等間隔、15度回転 | `src/state/appState.ts`, `src/core/layout.ts`, `src/components/CanvasStage.tsx` |
| 履歴・プレビュー | Undo/Redo、ドラッグやダイアログの一時プレビュー、確定時の履歴単位化 | `src/state/appState.ts`, `src/state/appState.test.ts` |
| 入力 | Pointer Events、マウス／タッチ、2本指パン・ピンチズーム、キーボード操作 | `src/components/CanvasStage.tsx`, `src/App.tsx` |
| 配置生成 | 行列、プルト弧、椅子多列円弧、山台グループ、ユーザーテンプレート | `src/core/arrangement.ts`, `src/core/arrangement.test.ts` ほか |
| 弦セクション | 8/10/12/14/16型、4バリアント、固定アンカー、ライブプレビュー、警告 | `src/core/stringLayout12.ts`, `src/core/stringLayoutAnchors.ts`, `src/core/stringLayout12.test.ts` |
| 注釈・補助 | テキスト、線、矢印、矩形、円、寸法線、ガイド、スナップ、壁トレース | `src/types/project.ts`, `src/state/appState.ts`, `src/core/` 関連テスト |
| 3D閲覧 | mmからの壁・オブジェクト・山台・アバター派生、俯瞰／一人称、Three.js遅延読込 | `src/core/scene3d.ts`, `src/components/Viewer3D.tsx`, `src/core/scene3d.test.ts` |
| 出力 | PNG/PDF、A4/A3、縦横、1:50／1:100／フィット、情報欄、出力対象フィルター | `src/core/export.ts`, `src/services/web/`, 出力テスト |
| ローカル保存 | IndexedDB自動保存、localStorageフォールバック、明示JSON保存 | `src/services/contracts.ts`, `src/services/web/`, `src/App.tsx` |

弦セクションの旧資料にある「12型固定のみ」「8/10/14/16は選択不可」は現行コードの状態ではない。現行の型・テスト・UIを確認すること。

## 部分実装または要件との差分候補

ここは「コード上に該当機能がない、または要求を完全には満たしていない」と判断した候補である。受入済みと断定する前に、要件番号と手動確認を再確認する。

- 背景の任意角度回転（FR-015）: 現在は90度単位の回転であり、微小角度回転のUI・変換は確認できない。
- X/Y別校正（FR-025）: 現在は単一の`mmPerPixel`であり、軸別スケールは確認できない。
- 任意原点（FR-032）: 現在のコードで一般的な原点設定機能は確認できない。ステージテンプレートや指揮者原点は別の固定ルールである。
- 前後関係の一般操作（FR-054）: `zIndex`や背景固定の扱いはあるが、ユーザー向けの前面／背面操作が要求どおり揃っているかは未確認。
- 一般的な重複・舞台外・クリアランス警告（FR-090〜FR-092相当）: 椅子円弧や弦テンプレート固有の警告はあるが、全オブジェクトを対象とする一般エンジンは未確認。
- プロジェクト複製（FR-004）: JSON保存や新規作成はあるが、明示的なワンクリック複製操作は未確認。
- 多言語化向け文字列分離（NFR-014後半）: 初期UIは日本語だが、文字列は各コンポーネントへ直接記述されており、翻訳リソース等への分離は確認できない。

これらは今回実装していない。実装へ進む場合は、対象FR、保存モデルへの影響、Action、core計算、テスト、手動受入を先に定義する。

## 自動検証の結果

調査時に実行した結果は次のとおり。

```text
npm test           PASS — 71 test files / 484 tests
npm run typecheck  PASS
npm run build      PASS
```

`npm test`は最初のサンドボックス実行ではVitestのesbuild子プロセス起動時に`spawn EPERM`となった。その後、同じコマンドを許可された実行環境で再実行して全件通過した。これはプロダクトテストの失敗とは分けて記録する。

ビルドにはPDF.jsとThree.js由来の500kB超チャンク警告が残る。失敗ではないが、初回ロード性能と端末性能の評価対象である。

## 今回未確認の受入

次はこの調査では完了扱いにしていない。

- 開発サーバーをブラウザで起動した実操作、表示崩れ、フォーカス、キーボード、画面リサイズ
- iPad Safari、タッチ・ペン、spacedesk等の実機操作
- 印刷、PNG/PDFの目視、縮尺・寸法精度、複数ページや大規模配置の出力
- スクリーンリーダー、実機のパフォーマンス、500オブジェクト規模の操作感
- GitHub Pages公開後の認証・公開ページ・外部運用設定
- DOM／E2E自動テストは未導入のため、UI操作とアクセシビリティの自動受入

自動検証とこれらの評価方法は `testing.md`、未確認リスクは `known-issues.md` を参照する。

## 次の候補

優先順位は、まず未コミットUI差分をレビューし、ブラウザ／iPad／出力の受入を実施して既知の問題を再分類すること。その後、要件差分候補（任意角度、軸別校正、原点、一般警告など）を個別のPhaseとして仕様化する。

過去のHANDOFFや日付付き監査に書かれた「次のPhase」を、そのまま現在の作業指示として採用しない。実装を始める場合は、対象ファイル・データ型・テスト・受入を明示してから進める。
