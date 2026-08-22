# ADR-0003: 環境依存処理をサービス契約へ隔離し、保存はローカルにする

- 状態: 採用
- 対象: ファイル、PDF、画像、保存、設定、出力

## 背景

ファイルAPI、IndexedDB、localStorage、PDF.js、pdf-libはブラウザ環境へ依存する。一方、coreの計算とstateの契約はNodeテストでも再利用できる。プロジェクトデータを外部サーバーへ送信しない要件もある。

## 決定

`src/services/contracts.ts`でFile、Image、Pdf、Autosave、Project、Export等の契約を定義し、ブラウザ実装は`src/services/web/`へ置く。自動保存はIndexedDBを優先し、localStorageをフォールバックとする。JSONはユーザーが明示的に保存・移動できる形式とし、通常実行でProjectを外部へ送信しない。

## 理由と結果

- core/stateのテストからブラウザAPIを分離できる。
- 保存方式を変更してもUIとドメイン計算の契約を保ちやすい。
- 埋め込み背景は保存容量を消費するため、容量制限と巨大ファイルを既知のリスクとして扱う。
- GitHub Pages、Cloudflare Access、公開スクリプトは運用・公開境界であり、Projectの通常データフローへ混ぜない。

## 根拠

`src/services/contracts.ts`、`src/services/web/`、`src/App.tsx`、`docs/要件定義書_v1.0.md`のローカル保存・外部送信に関する要求。
