# アーキテクチャ

## 概要

アプリはReact + TypeScript + Viteで構成されたローカルWebアプリである。UIはプロジェクトを直接永続化せず、`App` がreducerとサービス境界を組み合わせる。実寸の計算、保存形式、配置計算、出力モデルは、原則としてUI非依存の純粋なcoreロジックに置く。

```text
main.tsx
  └─ BetaGate（任意のクライアント側公開ゲート）
       └─ App
           ├─ useReducer(appState.ts)
           ├─ panels / CanvasStage（SVG編集）
           ├─ Viewer3D（Three.jsを遅延読み込み）
           └─ AppServices
                ├─ web file / image / PDF adapters
                ├─ IndexedDB + localStorage autosave
                └─ JSON / PNG / PDF project services

core/ + types/
  ├─ project.ts      保存・復元・マイグレーション
  ├─ transform.ts    px/mm・校正・表示変換
  ├─ layout.ts       選択単位・整列・等間隔・移動
  ├─ arrangement.ts  行列・弧・山台などの配置計算
  ├─ stringLayout*   弦セクションの固定アンカー配置
  ├─ export.ts       mm正本から共通SVG・出力縮尺
  └─ scene3d.ts      mm正本から3D用の純粋なモデル
```

## 主要コンポーネントの責務

### `src/types/`

`Project`、`SceneObject`、背景、校正、レイヤー、ガイド、壁、ステージテンプレート、出力設定など、保存対象の型を定義する。配置物の実寸値と角度はここで定義されたmm値を正本とする。

### `src/core/`

ブラウザやReactに依存しない計算を担当する。特に次の境界を守る。

- `transform.ts`: 背景pxとmmの校正、表示pxとの変換、回転後の表示外接矩形、ズーム・フィット
- `project.ts`: 新規プロジェクト、JSONシリアライズ、型検証、旧スキーマのマイグレーション
- `layout.ts`: 選択を単体・グループ単位へ解決し、移動・整列・等間隔を計算
- `arrangement.ts`: 椅子列、プルト弧、椅子円弧列、山台などの生成
- `stringLayout12.ts` / `stringLayoutAnchors.ts`: 8/10/12/14/16型と4バリアントの固定アンカーから、通常オブジェクトを生成
- `export.ts`: 共通SVGと縮尺を生成し、PNG/PDFサービスへ渡す
- `scene3d.ts`: `Project`を3Dプリミティブへ変換する。Three.jsのシーン操作はここに置かない

### `src/state/appState.ts`

Action/reducerが編集の境界である。通常の確定編集はプロジェクト履歴へ積み、プレビューやドラッグ中の連続更新は一時状態として扱い、確定時に1つの履歴単位へまとめる。Undo/Redoはこの履歴を使う。

### `src/components/`

画面表示とPointer Eventsを担当する。`CanvasStage`は画面イベントをmm座標のActionへ変換し、描画用のpx値を保存しない。パネルは入力をActionへ渡す。`Viewer3D`は2Dデータの閲覧用であり、別の正本を持たない。

### `src/services/`

`src/services/contracts.ts`の環境非依存契約と、`src/services/web/`のブラウザ実装を分ける。ファイル読込、PDF、IndexedDB/localStorage、JSON、画像、出力など、ブラウザAPIに触れる処理はサービス境界へ隔離する。

`src/core/storage.ts`だけは、サービス層導入前のimportを維持するため、`src/services/web/indexedDbStorage.ts`を再exportする後方互換shimである。これは純粋coreの一部ではない。新しいコードからこのshimへ依存せず、Web保存実装は`src/services/web/`、UIから使う契約は`AutosaveService`を正規の入口とする。

## 主要データフロー

### 編集・自動保存

```text
Pointer / keyboard / panel input
  -> UI event handler
  -> Action
  -> appReducer
  -> Project (mm values)
  -> autosave service after the UI debounce
  -> IndexedDB, with localStorage fallback
```

JSON保存は同じProjectをシリアライズする。`Project.view`のズーム・パンもJSONには含まれるが、実寸値とは分離され、`SET_VIEW`だけでは履歴や`saveState: dirty`を発生させない。そのため表示変更だけでは自動保存が起動せず、その後に確定編集または明示保存が行われた場合に、その時点のviewも同じProjectとして保存される。SVG要素、ポインターの一時px、選択状態、開いているダイアログは保存しない。

### 背景・校正・表示

```text
image/PDF bytes
  -> background state (embedded data URL + source metadata)
  -> calibration (source pixel points + mm distance)
  -> transform.ts
       source px <-> calibrated mm <-> screen px
  -> CanvasStage SVG / export SVG
```

背景の90度回転・切り抜きは背景表示と変換に影響するが、配置物のwidth/depthを入れ替える仕組みではない。

### プレビューと確定

配置ダイアログやドラッグなどの途中状態は、Actionでプレビューを更新できる。プレビュー中のオブジェクトは確定前にProjectの正本へ保存せず、確定Actionが呼ばれた時だけ履歴へ積む。キャンセルは一時状態を破棄する。

### 出力

```text
Project (mm)
  -> core/export.ts common SVG + scale/layout
  -> PNG rasterization or pdf-lib PDF service
  -> user download
```

PNG/PDF出力は、画面の現在ズームではなく実寸と指定縮尺・用紙設定から生成する。出力受入は自動テストだけでは完了しないため、評価の境界は `testing.md` に記録する。

### 3D

```text
Project (mm)
  -> core/scene3d.ts pure model
  -> lazy Viewer3D / Three.js
  -> orbit or first-person view
```

3Dは2D配置を閲覧する派生ビューであり、3D側のpx・メッシュ・カメラ状態をプロジェクトJSONへ保存しない。Three.jsの読込失敗時は2D編集へ戻れる設計を維持する。

## 永続化と外部境界

`Project`はschemaVersion付きJSONで保存し、未知フィールドを無視しながら旧形式をマイグレーションする。背景画像・PDFページはプロジェクト内へ埋め込まれるため、ファイルサイズとブラウザ保存容量に注意する。

アプリの通常実行ではプロジェクトデータを外部サーバーへ送信しない。GitHub PagesやCloudflare Accessの設定は公開・運用境界であり、アプリのローカルデータフローとは別に検証する。
