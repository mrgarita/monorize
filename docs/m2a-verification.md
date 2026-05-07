# M2-A 実機検証ログ

実施日: 2026-05-06 〜 2026-05-07
対象: ブラウザ実機（`npm run dev` の Vite dev サーバ）における ffmpeg.wasm
0.12 系（self-host、`@ffmpeg/core` 0.12.10）での動画 → モノクロ GIF 変換

## 目的

`sample/` の 6 本のペア（MP4 → 正解 GIF）を、`monorize` のブラウザ実機で
変換した結果が正解 GIF と統計的に等価であることを ffprobe で確認し、
M2-A（実機検証＋必要に応じてフィルタ調整）の合格判定を客観データで残す。

## 切り分け結果サマリ

実装着手後の最初の実機起動で「ffmpeg がロードできない／変換が走らない」
事象に連鎖的に遭遇した。原因は以下 3 件で、いずれも本リポジトリの構成
（Vite + self-host + GIF 出力）に固有の前提だった。

### 1. core / core-mt は `dist/esm/` をコピーする（UMD ではない）

`@ffmpeg/ffmpeg` 0.12.x の Worker は `type: "module"` で起動し、
内部で `await import(coreURL)` する仕様。UMD 版（`dist/umd/ffmpeg-core.js`）
は `default` export を持たないため、`(await import(...)).default` が
`undefined` となり `ERROR_IMPORT_FAILURE = "failed to import ffmpeg-core.js"`
が投げられる。

恒久修正: `scripts/copy-ffmpeg-core.mjs` を **`dist/esm/` から ESM 版を
コピー** するよう変更（core / core-mt の `ffmpeg-core.{js,wasm}` および
core-mt は `ffmpeg-core.worker.js` の計 5 ファイル）。

### 2. `coreURL` / `wasmURL` / `workerURL` は絶対 URL を渡す

Vite dev サーバは相対 URL の dynamic import を `?import` クエリ付きで
自分の middleware に通し、`/public/` 配下のファイルは「source code から
import 禁止」として弾く。`toBlobURL` で Blob 化する代替もあるが、これは
本来 CDN 越しのクロスオリジン解消用で、self-host 構成では別問題（Worker
の opaque origin 化）の引き金になる。

恒久修正: `src/ffmpeg/client.ts` で
`new URL(path, location.origin).href` を使い、`coreURL` /
`wasmURL` / `workerURL` を **絶対 URL に正規化** してから `ffmpeg.load(...)`
に渡す。Vite は `http(s)://` で始まる URL を外部 URL とみなして transform
を素通りするため、ブラウザがそのまま `public/` から fetch できる。

### 3. core-mt は GIF エンコードでハングする

`crossOriginIsolated=true` で core-mt がロードされると、ffmpeg は
`Stream mapping: ... -> gif (native)` までは到達するが、その後の
エンコード処理に進まず無限待機する。同じ入力で core (st) 版に
切り替えると完走することを `MAH05262.MP4` で確認した。

GIF はシングルスレッド前提のコーデックで、core-mt の pthread 同期が
裏目になっていると推測される。**当面 GIF 出力は st 既定** とし、
mt 版の実用可否は M2-B 以降の調査事項とする。

仕様面の補足: `project.md` には「本番（XServer）は COOP/COEP 設定で
mt 推奨」と記載があるが、本プロダクトの出力形式（GIF）には現状
適用できない。M2-B で mt 版の挙動を再評価するまで、本番でも st 既定で
配信する方針とする。

## ffprobe 比較表（6 本一括）

計測コマンド（`ffprobe.exe` 7.x、Windows）:

```bash
"D:/work/ffmpeg/ffprobe.exe" -v error -count_frames \
  -show_entries stream=width,height,nb_read_frames,r_frame_rate \
  -show_entries format=duration,size \
  -of default=noprint_wrappers=1 <path>
```

| ファイル | 寸法 | fps | frames（正解 / 実機） | duration（正解 / 実機, 秒） | size（正解 / 実機, byte） | duration 差 | size 差 |
|---|---|---|---|---|---|---|---|
| MAH03703 | 640×360 | 15 | 347 / 346 | 23.14 / 23.07 | 14,640,644 / 14,591,078 | −0.30% | −0.34% |
| MAH04525 | 640×360 | 15 | 1120 / 1120 | 74.67 / 74.67 | 62,970,290 / 62,854,561 | 0.00% | −0.18% |
| MAH04591 | 640×360 | 15 | 279 / 279 | 18.60 / 18.59 | 12,882,666 / 12,900,984 | −0.05% | +0.14% |
| MAH05145 | 640×360 | 15 | 159 / 159 | 10.60 / 10.59 | 10,385,434 / 10,306,176 | −0.09% | −0.76% |
| MAH05223 | 640×360 | 15 | 1203 / 1202 | 80.20 / 80.14 | 23,307,076 / 23,191,357 | −0.07% | −0.50% |
| MAH05262 | 640×360 | 15 | 24 / 24 | 1.60 / 1.59 | 393,121 / 390,303 | −0.63% | −0.72% |

**判定基準と結果**

- 寸法・フレームレート: 全本で **完全一致**（640×360、15 fps）
- フレーム数: 差 ≤ 1 フレーム（最大 −0.29%、ほぼフレーム末端の丸め誤差）
- duration: 全本で **±2% 以内**（最大 −0.63%）
- size: 全本で **±2% 以内**（最大 −0.76%）

すべての項目で許容誤差内、かつ 6 本中 1 本もサンプル正解から外れていない。
**サンプル正解 GIF と統計的に等価** と判定する。

## 結論

- 1-pass フィルタ `scale=W:trunc(ow/dar/2)*2,hue=s=0` を据え置く。フィルタ
  チェーンの調整は不要。
- スレッディング既定は **st 固定**。`?ff=mt` クエリのみ mt を強制可能と
  して残し、M2-B 以降の調査用とする（`src/ffmpeg/threading.ts`）。
- self-host 構成の必須前提（ESM コピー・絶対 URL）は恒久修正として
  `scripts/copy-ffmpeg-core.mjs` と `src/ffmpeg/client.ts` に取り込み済。

## 再現手順

1. `npm install` 後 `npm run copy:ffmpeg-core` を実行（`public/ffmpeg/` が
   生成されていない場合）
2. `npm run dev` で Vite dev サーバを起動
3. `http://localhost:5173/monorize/` を開く（既定で st モード）
4. `sample/<NAME>.MP4` を投入し、横幅 640・fps 15 で変換、`<NAME>.gif`
   をダウンロードして `D:/monorize/tmp/` 等に保存
5. 上記 `ffprobe` コマンドで `sample/<NAME>.gif` と突き合わせる

mt 版の挙動を確認したい場合は `http://localhost:5173/monorize/?ff=mt`
を使う（GIF ではエンコードでハングする既知問題）。
