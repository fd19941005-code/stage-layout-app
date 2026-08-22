# テストと評価

## 標準コマンド

リポジトリルートで実行する。

```bash
npm install
npm test
npm run typecheck
npm run build
```

開発サーバーと静的ビルドの確認には次を使う。

```bash
npm run dev
npm run preview
```

`npm test`はVitest、`typecheck`はTypeScript strictチェック、`build`はTypeScriptチェック後のViteビルドである。`package.json`のscript定義を優先し、古いHANDOFFのコマンドを正本にしない。

## 調査時点の結果

2026-08-20の調査では次の結果だった。

| コマンド | 結果 | 備考 |
| --- | --- | --- |
| `npm test` | PASS | 71 files、484 tests。初回サンドボックスではVitest/esbuildの`spawn EPERM`が発生したが、許可された実行環境で同じコマンドを再実行して通過 |
| `npm run typecheck` | PASS | TypeScriptエラーなし |
| `npm run build` | PASS | PDF.js／Three.jsの大きなチャンク警告あり |
| `git diff --check` | PASS | CRLFに関する警告のみで、空白エラーなし |

この結果は自動検証の記録であり、ブラウザ・実機・印刷・公開の受入結果ではない。

## テストの層

- **coreの単体テスト**: `transform`、`project`、`layout`、`arrangement`、弦テンプレート、`scene3d`、出力計算など。座標、回転、寸法、保存互換性、配置生成を優先する。
- **stateのテスト**: Action、Undo/Redo、プレビュー確定・キャンセル、選択単位、履歴境界を確認する。
- **serviceのテスト**: ブラウザAPIの契約、JSON、保存フォールバック、PDF・画像の変換を確認する。環境依存の挙動は実行環境も記録する。
- **UI／ブラウザ確認**: Pointer Events、フォーカス、レスポンシブパネル、ダイアログ、表示、キーボードを開発サーバー上で確認する。
- **対象環境確認**: iPad Safari、タッチ・ペン、印刷／PDF／PNG、スクリーンリーダー、性能を実機または対象環境で確認する。

現在の`vite.config.ts`はVitestをNode環境で実行し、対象を`src/**/*.test.ts`に限定している。Testing Library、Playwright、スクリーンショット差分、実ブラウザDOMを使う自動テストは現時点でなく、カバレッジ閾値も設定していない。したがって71ファイル／484テストの通過はcore/state/service契約の強い根拠にはなるが、UI・アクセシビリティ・実機操作の自動受入を意味しない。

## 受入の境界

```text
自動テスト        : core/state/serviceの再現可能な契約
ローカルブラウザ  : DOM/SVG、操作、フォーカス、表示
対象デバイス      : iPad Safari、タッチ、ペン、性能
出力確認          : PNG/PDF/印刷の見た目、縮尺、寸法
公開確認          : Pages、認証、運用環境
```

上の層は代替関係ではない。たとえば`npm run build`成功は、iPadで操作できることや印刷寸法が正しいことを証明しない。

## 新機能の検証ルール

1. FR/NFR/ACの対象番号を作業開始時に特定する。
2. mm計算、座標変換、保存、配置生成など再現可能なロジックには単体テストを追加する。
3. Action、履歴、プレビューを変更する場合は、確定・キャンセル・Undo/Redoを分けて確認する。
4. UI変更では、マウスだけでなくPointer Events、キーボード、フォーカス、タッチの確認範囲を明示する。
5. 出力や公開に関わる場合は、自動結果と目視・実環境の結果を分けて記録する。
6. 実施していない評価を「受入済み」「対応済み」と書かない。

## 既知の実行上の制限

- サンドボックス環境ではVitestが起動するesbuild子プロセスで`spawn EPERM`になる場合がある。その場合は、テストロジックの失敗と実行環境の権限制限を分けて再実行・記録する。
- PDF関連テストではPDF.jsのlegacy buildに関する警告が出る場合がある。
- ビルド時にPDF.js／Three.jsのチャンクサイズ警告がある。サイズ警告はビルド失敗ではないが、性能評価を省略する理由にはならない。
- `npm run github:publish`はcommit、push、PR作成を伴うため、通常の検証コマンドではない。依頼なしに実行しない。
