# GitHub公開手順

この文書は外部状態を変更する運用手順である。通常の検証とは分け、ユーザーからcommit・push・PR作成の依頼がある場合だけ実行する。

`.github/workflows/deploy-pages.yml`は`main`へのpushでGitHub Pagesを更新する。作業ブランチのpushやDraft PR作成だけでは公開ページは更新されず、PRを`main`へ取り込んだ後もActionsと公開URLの確認が必要である。

## 初回だけ

GitHub CLIのブラウザ認証を行います。

```powershell
gh auth login -h github.com -p https -w
```

認証状態は次で確認できます。

```powershell
gh auth status
```

## 2回目以降

リポジトリのルートで次の1コマンドを実行します。

```powershell
npm run github:publish
```

このコマンドは、テスト・typecheck・ビルド、ステージ対象の表示、確認後のコミット、現在ブランチのpush、Draft PR作成まで行います。`docs.zip`、`src.zip`、第三者参照画像コレクションは公開対象から除外します。

`scripts/publish.ps1`は除外対象以外の作業ツリー全体を`git add -A`する。別タスクの未コミット変更がある状態では、それらも同じcommit候補になる。実行前に`git status`と差分を確認し、1つのPRへ含めてよい変更だけの状態にする。スクリプト内の確認表示は、変更範囲を自動で選別するものではない。

確認なしで進める場合:

```powershell
npm run github:publish -- -Yes
```

テストを省略するオプションは、緊急時以外は使用しないでください。

ローカルのテスト・build成功は、Actions、GitHub Pagesの表示、ベータゲート／外部アクセス制御、公開URL上の操作を証明しない。公開後の確認結果はローカル自動検証と分けて記録する。
