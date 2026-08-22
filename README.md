# 舞台図面作成アプリ

ホール舞台の平面図に、楽器・椅子・譜面台・台などを実寸（mm）で配置し、編集・保存・図面出力するローカルWebアプリです。設計・保存・受入の基準は、コードの都合ではなく `docs/要件定義書_v1.0.md` を起点に確認します。

## 新しいセッションでの入口

最初に次の順で読みます。

1. `AGENTS.md` — 常に守る不変条件と作業境界
2. `docs/current-state.md` — 現在の実装状況、未確認事項、次の候補
3. `docs/README.md` — 文書ごとのSource of Truthと参照先
4. 作業に対応する `docs/architecture.md`、`docs/domain.md`、`docs/testing.md`、`docs/known-issues.md`、`docs/decisions/`
5. FR/NFR/ACを確認する必要がある場合は `docs/要件定義書_v1.0.md`

日付付きの `HANDOFF.md`、UX監査、旧仕様書、実装依頼プロンプトは履歴・参考資料です。現在の実装状況を判断する際は、これらより `docs/current-state.md` とコード・テストを優先します。

## 開発

```bash
npm install
npm run dev
```

標準の検証コマンドは次の3つです。

```bash
npm test
npm run typecheck
npm run build
```

テストの分類、実機・出力確認との境界、既知の実行環境制限は `docs/testing.md` にまとめています。

## 主な構成

- `src/core/` — mm座標、変換、保存、配置計算、出力・3DモデルなどのUI非依存ロジック
- `src/state/` — Action/reducer、選択、Undo/Redo、プレビュー状態
- `src/components/` — SVG編集画面、各パネル、3Dビューア
- `src/services/` — ファイル、PDF、保存、設定、出力の環境依存アダプター
- `src/types/` — プロジェクトJSONとドメイン型
- `docs/` — 要件、設計、現在状態、検証、既知の問題、設計判断

詳細な責務とデータフローは `docs/architecture.md` を参照してください。

## 公開

GitHub Pages向けの手順は `docs/GITHUB_PUBLISH.md` と `.github/workflows/deploy-pages.yml` にあります。公開・push・外部サービス設定は、ローカルの自動検証とは別の操作です。依頼なしに `npm run github:publish` やCloudflare設定スクリプトを実行しないでください。

## 現在の状態

調査日時点の実装済み・部分実装・未確認事項は [docs/current-state.md](docs/current-state.md)、継続中の制約やリスクは [docs/known-issues.md](docs/known-issues.md) がSource of Truthです。
