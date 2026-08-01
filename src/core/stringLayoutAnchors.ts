// 弦楽器テンプレ配置(FR-062)の固定アンカー表。
//
// 参考配置図から読み取った構造を、配置バリエーション×編成型ごとの実データとして持つ。
// 実行時に人数から配分を計算しない。ここはデータだけで、計算は`stringLayout12.ts`にある。
//
// 座標は指揮台を中心とする同心の列(輪)と方位角で表す。半径は列間隔オプションから
// 決まるので、ここには持たない。方位角は指揮台の真後ろを0度、図面右を正とし、
// -90度が真左、+90度が真右。すべて-90〜+90度に収まる(客席側へは回らない)。
//
// 作図規則:
// - 配置は「左の直線・左の塊・右の塊・右の直線」の4枠でできている。どのセクションを
//   どの枠へ入れるかがバリエーションの違いで、枠ごとの作りかたは共通。
// - 直線(radial-line)は方位角±90度で1列につき1プルト。主線(1st Vn)は必ず末尾1つを
//   隣へ折り返し(line-corner)、7プルト以上では2つ折り返す。従線は列数を超えた分を
//   折り返し、7プルト以上なら主線と同じく2つ折り返して幅を1列ぶん詰める。
// - 塊(arc-block)は1列目1プルト・2列目2プルト・3列目以降3プルト。偶数番が直線寄りの
//   外側、奇数番がその内側に来る。
// - 1列目は各セクションの先頭4プルトだけになり、指揮台を囲む四角をつくる。
//   参考図の「対抗位置のTop同士のコンタクト」にあたる。
// - Cb(bass)はチェロと同じ側の外側後方。2プルトまで同じ弧の上に並べ、3プルト以上は
//   1つ外側の弧を2列目にする。資料3点(ハニホー・Daxter・関西フィル)とも、対抗配置でも
//   コントラバスはチェロの外側だった。
//
// 「隣接」は角度ではなく弦長で決めている。角度を固定すると外側の列ほど実距離が開くため、
// 直線の隣は1500mm、塊の外側列は直線から1760mm、Cbどうしは占有域が大きいので2350mmを
// 基準にした。副次的に、塊の外側列は図面上ほぼ横一列に並ぶ。
//
// 最前列は指揮台の真横に来るため、椅子の一部は指揮者位置より客席側へ出る。
// これは意図した配置で、`stringLayout12Placements`は舞台奥側を強制しない。

import type { StringEnsembleTypeId, StringPultAnchor, StringSeatingVariantId } from "./stringLayout12";

export const STRING_LAYOUT_ANCHORS:
  Readonly<Record<StringSeatingVariantId, Readonly<Record<StringEnsembleTypeId, readonly StringPultAnchor[]>>>> = {
  "standard": {
    "8": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 2, bearingDeg: -67.83, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 3, rowIndex: 1, bearingDeg: -19.7, layoutRole: "arc-block" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 2, bearingDeg: 60.29, layoutRole: "bass" },
    ],
    "10": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 3, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 5, rowIndex: 3, bearingDeg: -73.09, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 3, rowIndex: 1, bearingDeg: -19.7, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 4, rowIndex: 2, bearingDeg: -63.92, layoutRole: "arc-block" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "viola", pultNumber: 3, rowIndex: 2, bearingDeg: 90, layoutRole: "radial-line" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 3, rowIndex: 1, bearingDeg: 19.7, layoutRole: "arc-block" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 3, bearingDeg: 67.38, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 2, rowIndex: 3, bearingDeg: 40.74, layoutRole: "bass" },
    ],
    "12": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 3, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 5, rowIndex: 4, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 6, rowIndex: 4, bearingDeg: -76.33, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 3, rowIndex: 1, bearingDeg: -19.7, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 4, rowIndex: 2, bearingDeg: -63.92, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 5, rowIndex: 2, bearingDeg: -41.74, layoutRole: "arc-block" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "viola", pultNumber: 3, rowIndex: 2, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "viola", pultNumber: 4, rowIndex: 3, bearingDeg: 90, layoutRole: "radial-line" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 3, rowIndex: 1, bearingDeg: 19.7, layoutRole: "arc-block" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 3, bearingDeg: 67.38, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 2, rowIndex: 3, bearingDeg: 40.74, layoutRole: "bass" },
    ],
    "14": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 3, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 5, rowIndex: 4, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 6, rowIndex: 3, bearingDeg: -73.09, layoutRole: "line-corner" },
      { section: "violin1", pultNumber: 7, rowIndex: 4, bearingDeg: -76.33, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 3, rowIndex: 1, bearingDeg: -19.7, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 4, rowIndex: 2, bearingDeg: -63.92, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 5, rowIndex: 2, bearingDeg: -41.74, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 6, rowIndex: 2, bearingDeg: -19.57, layoutRole: "arc-block" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "viola", pultNumber: 3, rowIndex: 2, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "viola", pultNumber: 4, rowIndex: 3, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "viola", pultNumber: 5, rowIndex: 4, bearingDeg: 90, layoutRole: "radial-line" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 3, rowIndex: 1, bearingDeg: 19.7, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 4, rowIndex: 2, bearingDeg: 63.92, layoutRole: "arc-block" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 3, bearingDeg: 67.38, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 2, rowIndex: 3, bearingDeg: 40.74, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 3, rowIndex: 4, bearingDeg: 70, layoutRole: "bass" },
    ],
    "16": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 3, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 5, rowIndex: 4, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 6, rowIndex: 5, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 7, rowIndex: 4, bearingDeg: -76.33, layoutRole: "line-corner" },
      { section: "violin1", pultNumber: 8, rowIndex: 5, bearingDeg: -78.52, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 3, rowIndex: 1, bearingDeg: -19.7, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 4, rowIndex: 2, bearingDeg: -63.92, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 5, rowIndex: 2, bearingDeg: -41.74, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 6, rowIndex: 3, bearingDeg: -70.13, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 7, rowIndex: 2, bearingDeg: -19.57, layoutRole: "arc-block" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "viola", pultNumber: 3, rowIndex: 2, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "viola", pultNumber: 4, rowIndex: 3, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "viola", pultNumber: 5, rowIndex: 4, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "viola", pultNumber: 6, rowIndex: 5, bearingDeg: 90, layoutRole: "radial-line" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 3, rowIndex: 1, bearingDeg: 19.7, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 4, rowIndex: 2, bearingDeg: 63.92, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 5, rowIndex: 2, bearingDeg: 41.74, layoutRole: "arc-block" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 4, bearingDeg: 70, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 2, rowIndex: 4, bearingDeg: 48.5, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 3, rowIndex: 5, bearingDeg: 70, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 4, rowIndex: 5, bearingDeg: 51.97, layoutRole: "bass" },
    ],
  },
  "standard-swap": {
    "8": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 2, bearingDeg: -67.83, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 3, rowIndex: 1, bearingDeg: -19.7, layoutRole: "arc-block" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 2, bearingDeg: 60.29, layoutRole: "bass" },
    ],
    "10": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 3, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 5, rowIndex: 3, bearingDeg: -73.09, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 3, rowIndex: 1, bearingDeg: -19.7, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 4, rowIndex: 2, bearingDeg: -63.92, layoutRole: "arc-block" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 3, rowIndex: 1, bearingDeg: 19.7, layoutRole: "arc-block" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "cello", pultNumber: 3, rowIndex: 2, bearingDeg: 90, layoutRole: "radial-line" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 3, bearingDeg: 67.38, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 2, rowIndex: 3, bearingDeg: 40.74, layoutRole: "bass" },
    ],
    "12": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 3, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 5, rowIndex: 4, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 6, rowIndex: 4, bearingDeg: -76.33, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 3, rowIndex: 1, bearingDeg: -19.7, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 4, rowIndex: 2, bearingDeg: -63.92, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 5, rowIndex: 2, bearingDeg: -41.74, layoutRole: "arc-block" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 3, rowIndex: 1, bearingDeg: 19.7, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 4, rowIndex: 2, bearingDeg: 63.92, layoutRole: "arc-block" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "cello", pultNumber: 3, rowIndex: 2, bearingDeg: 90, layoutRole: "radial-line" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 3, bearingDeg: 67.38, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 2, rowIndex: 3, bearingDeg: 40.74, layoutRole: "bass" },
    ],
    "14": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 3, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 5, rowIndex: 4, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 6, rowIndex: 3, bearingDeg: -73.09, layoutRole: "line-corner" },
      { section: "violin1", pultNumber: 7, rowIndex: 4, bearingDeg: -76.33, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 3, rowIndex: 1, bearingDeg: -19.7, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 4, rowIndex: 2, bearingDeg: -63.92, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 5, rowIndex: 2, bearingDeg: -41.74, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 6, rowIndex: 2, bearingDeg: -19.57, layoutRole: "arc-block" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 3, rowIndex: 1, bearingDeg: 19.7, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 4, rowIndex: 2, bearingDeg: 63.92, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 5, rowIndex: 2, bearingDeg: 41.74, layoutRole: "arc-block" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "cello", pultNumber: 3, rowIndex: 2, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "cello", pultNumber: 4, rowIndex: 3, bearingDeg: 90, layoutRole: "radial-line" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 3, bearingDeg: 67.38, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 2, rowIndex: 3, bearingDeg: 40.74, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 3, rowIndex: 4, bearingDeg: 70, layoutRole: "bass" },
    ],
    "16": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 3, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 5, rowIndex: 4, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 6, rowIndex: 5, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 7, rowIndex: 4, bearingDeg: -76.33, layoutRole: "line-corner" },
      { section: "violin1", pultNumber: 8, rowIndex: 5, bearingDeg: -78.52, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 3, rowIndex: 1, bearingDeg: -19.7, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 4, rowIndex: 2, bearingDeg: -63.92, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 5, rowIndex: 2, bearingDeg: -41.74, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 6, rowIndex: 3, bearingDeg: -70.13, layoutRole: "arc-block" },
      { section: "violin2", pultNumber: 7, rowIndex: 2, bearingDeg: -19.57, layoutRole: "arc-block" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 3, rowIndex: 1, bearingDeg: 19.7, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 4, rowIndex: 2, bearingDeg: 63.92, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 5, rowIndex: 2, bearingDeg: 41.74, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 6, rowIndex: 2, bearingDeg: 19.57, layoutRole: "arc-block" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "cello", pultNumber: 3, rowIndex: 2, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "cello", pultNumber: 4, rowIndex: 3, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "cello", pultNumber: 5, rowIndex: 4, bearingDeg: 90, layoutRole: "radial-line" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 4, bearingDeg: 70, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 2, rowIndex: 4, bearingDeg: 48.5, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 3, rowIndex: 5, bearingDeg: 70, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 4, rowIndex: 5, bearingDeg: 51.97, layoutRole: "bass" },
    ],
  },
  "antiphonal": {
    "8": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 2, bearingDeg: -67.83, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 3, rowIndex: 2, bearingDeg: 90, layoutRole: "radial-line" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 2, bearingDeg: -40.29, layoutRole: "bass" },
    ],
    "10": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 3, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 5, rowIndex: 3, bearingDeg: -73.09, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 3, rowIndex: 2, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 4, rowIndex: 3, bearingDeg: 90, layoutRole: "radial-line" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 3, rowIndex: 1, bearingDeg: 19.7, layoutRole: "arc-block" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 3, rowIndex: 1, bearingDeg: -19.7, layoutRole: "arc-block" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 3, bearingDeg: -51.88, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 2, rowIndex: 3, bearingDeg: -25.24, layoutRole: "bass" },
    ],
    "12": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 3, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 5, rowIndex: 4, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 6, rowIndex: 4, bearingDeg: -76.33, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 3, rowIndex: 2, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 4, rowIndex: 3, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 5, rowIndex: 4, bearingDeg: 90, layoutRole: "radial-line" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 3, rowIndex: 1, bearingDeg: 19.7, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 4, rowIndex: 2, bearingDeg: 63.92, layoutRole: "arc-block" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 3, rowIndex: 1, bearingDeg: -19.7, layoutRole: "arc-block" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 3, bearingDeg: -67.38, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 2, rowIndex: 3, bearingDeg: -40.74, layoutRole: "bass" },
    ],
    "14": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 3, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 5, rowIndex: 4, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 6, rowIndex: 3, bearingDeg: -73.09, layoutRole: "line-corner" },
      { section: "violin1", pultNumber: 7, rowIndex: 4, bearingDeg: -76.33, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 3, rowIndex: 2, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 4, rowIndex: 3, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 5, rowIndex: 4, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 6, rowIndex: 4, bearingDeg: 76.33, layoutRole: "line-corner" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 3, rowIndex: 1, bearingDeg: 19.7, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 4, rowIndex: 2, bearingDeg: 63.92, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 5, rowIndex: 2, bearingDeg: 41.74, layoutRole: "arc-block" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 3, rowIndex: 1, bearingDeg: -19.7, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 4, rowIndex: 2, bearingDeg: -63.92, layoutRole: "arc-block" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 3, bearingDeg: -51.88, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 2, rowIndex: 3, bearingDeg: -25.24, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 3, rowIndex: 4, bearingDeg: -54.5, layoutRole: "bass" },
    ],
    "16": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 3, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 5, rowIndex: 4, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 6, rowIndex: 5, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 7, rowIndex: 4, bearingDeg: -76.33, layoutRole: "line-corner" },
      { section: "violin1", pultNumber: 8, rowIndex: 5, bearingDeg: -78.52, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 3, rowIndex: 2, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 4, rowIndex: 3, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 5, rowIndex: 4, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 6, rowIndex: 3, bearingDeg: 73.09, layoutRole: "line-corner" },
      { section: "violin2", pultNumber: 7, rowIndex: 4, bearingDeg: 76.33, layoutRole: "line-corner" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 3, rowIndex: 1, bearingDeg: 19.7, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 4, rowIndex: 2, bearingDeg: 63.92, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 5, rowIndex: 2, bearingDeg: 41.74, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 6, rowIndex: 2, bearingDeg: 19.57, layoutRole: "arc-block" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 3, rowIndex: 1, bearingDeg: -19.7, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 4, rowIndex: 2, bearingDeg: -63.92, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 5, rowIndex: 2, bearingDeg: -41.74, layoutRole: "arc-block" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 4, bearingDeg: -59, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 2, rowIndex: 4, bearingDeg: -37.5, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 3, rowIndex: 5, bearingDeg: -59, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 4, rowIndex: 5, bearingDeg: -40.97, layoutRole: "bass" },
    ],
  },
  "antiphonal-swap": {
    "8": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 2, bearingDeg: -67.83, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 3, rowIndex: 2, bearingDeg: 90, layoutRole: "radial-line" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 2, bearingDeg: 60.29, layoutRole: "bass" },
    ],
    "10": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 3, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 5, rowIndex: 3, bearingDeg: -73.09, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 3, rowIndex: 2, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 4, rowIndex: 3, bearingDeg: 90, layoutRole: "radial-line" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 3, rowIndex: 1, bearingDeg: -19.7, layoutRole: "arc-block" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 3, rowIndex: 1, bearingDeg: 19.7, layoutRole: "arc-block" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 3, bearingDeg: 67.38, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 2, rowIndex: 3, bearingDeg: 40.74, layoutRole: "bass" },
    ],
    "12": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 3, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 5, rowIndex: 4, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 6, rowIndex: 4, bearingDeg: -76.33, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 3, rowIndex: 2, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 4, rowIndex: 3, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 5, rowIndex: 4, bearingDeg: 90, layoutRole: "radial-line" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 3, rowIndex: 1, bearingDeg: -19.7, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 4, rowIndex: 2, bearingDeg: -63.92, layoutRole: "arc-block" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 3, rowIndex: 1, bearingDeg: 19.7, layoutRole: "arc-block" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 3, bearingDeg: 67.38, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 2, rowIndex: 3, bearingDeg: 40.74, layoutRole: "bass" },
    ],
    "14": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 3, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 5, rowIndex: 4, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 6, rowIndex: 3, bearingDeg: -73.09, layoutRole: "line-corner" },
      { section: "violin1", pultNumber: 7, rowIndex: 4, bearingDeg: -76.33, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 3, rowIndex: 2, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 4, rowIndex: 3, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 5, rowIndex: 4, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 6, rowIndex: 4, bearingDeg: 76.33, layoutRole: "line-corner" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 3, rowIndex: 1, bearingDeg: -19.7, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 4, rowIndex: 2, bearingDeg: -63.92, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 5, rowIndex: 2, bearingDeg: -41.74, layoutRole: "arc-block" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 3, rowIndex: 1, bearingDeg: 19.7, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 4, rowIndex: 2, bearingDeg: 63.92, layoutRole: "arc-block" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 3, bearingDeg: 56.38, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 2, rowIndex: 3, bearingDeg: 29.74, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 3, rowIndex: 4, bearingDeg: 59, layoutRole: "bass" },
    ],
    "16": [
      // 1st Vn
      { section: "violin1", pultNumber: 1, rowIndex: 0, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 2, rowIndex: 1, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 3, rowIndex: 2, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 4, rowIndex: 3, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 5, rowIndex: 4, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 6, rowIndex: 5, bearingDeg: -90, layoutRole: "radial-line" },
      { section: "violin1", pultNumber: 7, rowIndex: 4, bearingDeg: -76.33, layoutRole: "line-corner" },
      { section: "violin1", pultNumber: 8, rowIndex: 5, bearingDeg: -78.52, layoutRole: "line-corner" },
      // 2nd Vn
      { section: "violin2", pultNumber: 1, rowIndex: 0, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 2, rowIndex: 1, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 3, rowIndex: 2, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 4, rowIndex: 3, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 5, rowIndex: 4, bearingDeg: 90, layoutRole: "radial-line" },
      { section: "violin2", pultNumber: 6, rowIndex: 3, bearingDeg: 73.09, layoutRole: "line-corner" },
      { section: "violin2", pultNumber: 7, rowIndex: 4, bearingDeg: 76.33, layoutRole: "line-corner" },
      // Va
      { section: "viola", pultNumber: 1, rowIndex: 0, bearingDeg: -30, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 2, rowIndex: 1, bearingDeg: -51.96, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 3, rowIndex: 1, bearingDeg: -19.7, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 4, rowIndex: 2, bearingDeg: -63.92, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 5, rowIndex: 2, bearingDeg: -41.74, layoutRole: "arc-block" },
      { section: "viola", pultNumber: 6, rowIndex: 2, bearingDeg: -19.57, layoutRole: "arc-block" },
      // Vc
      { section: "cello", pultNumber: 1, rowIndex: 0, bearingDeg: 30, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 2, rowIndex: 1, bearingDeg: 51.96, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 3, rowIndex: 1, bearingDeg: 19.7, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 4, rowIndex: 2, bearingDeg: 63.92, layoutRole: "arc-block" },
      { section: "cello", pultNumber: 5, rowIndex: 2, bearingDeg: 41.74, layoutRole: "arc-block" },
      // Cb
      { section: "contrabass", pultNumber: 1, rowIndex: 4, bearingDeg: 59, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 2, rowIndex: 4, bearingDeg: 37.5, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 3, rowIndex: 5, bearingDeg: 59, layoutRole: "bass" },
      { section: "contrabass", pultNumber: 4, rowIndex: 5, bearingDeg: 40.97, layoutRole: "bass" },
    ],
  },
};
