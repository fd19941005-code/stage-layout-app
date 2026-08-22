# ADR-0002: 編集をreducer Actionへ集約し、プレビューを一時状態にする

- 状態: 採用
- 対象: 編集、履歴、Undo/Redo、自動保存

## 背景

ドラッグや配置ダイアログは、操作中に多数の中間値を生成する。中間値をすべて確定履歴へ積むとUndoが細かくなり、UIがProject配列を直接変更すると履歴・自動保存・復元の境界が壊れる。

## 決定

Projectを変更する操作は `src/state/appState.ts` のActionとしてreducerへ渡す。確定操作は履歴へ積み、ドラッグやライブプレビューは一時基準から再計算する。確定時に一連の中間更新を1つの履歴単位へまとめ、キャンセル時は一時状態を破棄する。

## 理由と結果

- Undo/Redoがユーザーの操作単位と一致する。
- プレビューと確定後で同じ純粋配置計算を共有できる。
- reducerテストで、確定・キャンセル・履歴境界を再現できる。
- UIから便利に直接配列を書き換える実装は許されない。新しい操作ではActionと履歴の扱いを先に決める必要がある。

## 根拠

`src/state/appState.ts` の`commitProject`、`previewProject`、`commitTransientEdit`、関連stateテスト、`AGENTS.md`。
