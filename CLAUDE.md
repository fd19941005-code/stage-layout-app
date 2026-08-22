# CLAUDE.md — 舞台図面作成アプリ

このリポジトリはCodexとClaude Codeの両方で開発する。**恒久ルールのSource of Truthは `AGENTS.md` 一本**であり、このファイルはAGENTS.mdの読み込みと、Claude Code側でだけ必要な読み替え・運用差分だけを定める。

@AGENTS.md

## このファイルの扱い

- AGENTS.mdに書かれている内容（読む文書の順序、恒久的な不変条件、変更範囲と進め方、最低限の検証）をこのファイルへ複製しない。ルールを変更・追加するときはAGENTS.mdを編集する。
- ここへ書いてよいのは、Claude Code固有の機能（Skill、開発サーバー起動など）に関する読み替えと補足だけとする。
- AGENTS.mdとこのファイルの記述が食い違った場合はAGENTS.mdを正とする。

## project-memory の読み替え

AGENTS.mdの「project-memory の実行ルール」にある `$project-memory` は、Claude Codeではユーザー共通の **`/project-memory` Skill** を指す。実行タイミング・対象とする知識・対象外とする情報の判断はAGENTS.mdの記述に従い、手順の詳細はSkill側に従う。Skillの手順をこのファイルやAGENTS.mdへコピーしない。

## Claude Code固有の運用

- 開発サーバーはBashやPowerShellで起動せず、`.claude/launch.json` の `dev` 構成をpreviewツールから起動する（Vite / ポート5173）。
- 実行環境はWindows + PowerShellを前提とする。AGENTS.mdの検証コマンド（`npm test` / `npm run typecheck` / `npm run build`）はリポジトリルートでそのまま実行できる。
- UI/UXの設計・実装・監査を行うときは、AGENTS.mdの不変条件に加えて `apple-hig-ui-ux` / `ux-audit` Skillを参照する。
