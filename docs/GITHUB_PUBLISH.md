# GitHub公開手順

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

確認なしで進める場合:

```powershell
npm run github:publish -- -Yes
```

テストを省略するオプションは、緊急時以外は使用しないでください。
