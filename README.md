# Monorize

アップロードされた動画を **モノクロのアニメーション GIF** に変換し、ダウンロード
できる Web アプリケーション。

## ステータス

**仕様策定段階** — 実装はまだ存在しません。現時点では仕様書とサンプル素材のみ
を管理しています。技術スタック（フロントエンド／バックエンド／変換エンジン等）
は未定です。

## 主要ファイル

- [`project.md`](./project.md) — プロダクト仕様書（要件、制約、完了条件）
- [`CLAUDE.md`](./CLAUDE.md) — Claude Code（claude.ai/code）向けの作業ガイド
- `sample/` — 入力 MP4 と目標出力 GIF のペア（**リポジトリ未管理。下記参照**）

## 主な制約

| 項目 | 内容 |
|---|---|
| アップロード上限 | 500 MB（1 ファイル） |
| 対応入力形式 | `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`, `.wmv`, `.flv`, `.m4v`, `.ts`, `.3gp` |
| 出力形式 | モノクロのアニメーション GIF |
| 同時処理 | 1 リクエストあたり 1 ファイル |
| 保持ポリシー | ダウンロード完了時、またはアップロードから 30 分経過時のいずれか早い方で削除 |

詳細は [`project.md`](./project.md) を参照してください。

## サンプル素材について

`sample/` には変換の目標とする MP4／GIF ペアが 6 組（合計約 420 MB）格納されて
いますが、以下の理由で **リポジトリには含めていません**（`.gitignore` で除外）。

- GitHub の 1 ファイル 100 MB 上限を超える MP4 が複数含まれる
- 将来の 10,000 件品質チェック用テストデータも同領域で管理する想定で、
  Git LFS の無料枠（1 GB）でも収まらない

そのため、GitHub 上で `sample/` 配下のリンクを開くと 404 になります。
ローカル作業ディレクトリにのみ存在する想定です。サンプル素材を別環境で
取得したい場合の共有方法は別途決定します。

## 開発を始めるには

技術スタック未確定のため、ビルド／テスト／lint コマンドはまだ存在しません。
スタック決定後に本セクションを更新します。

## ステージング配信（GitHub Pages）

`main` ブランチへの push、または GitHub Actions の手動実行
（`workflow_dispatch`）でステージング環境にデプロイされます。

- **公開 URL**: `https://mrgarita.github.io/monorize/`
- **ワークフロー**: [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml)

### 本番（XServer）との差異

GitHub Pages では COOP/COEP ヘッダを設定できないため
`crossOriginIsolated` が成立せず、ffmpeg.wasm の **マルチスレッド版
（core-mt）が使えません**。ステージングビルドは `FFMPEG_ST_ONLY=1` を渡し、
シングルスレッド版（core）のみを `dist/ffmpeg/` に同梱します
（`scripts/copy-ffmpeg-core.mjs`）。

なお、現状はアプリ側の既定がそもそも st 版（`src/ffmpeg/threading.ts`：
core-mt は GIF エンコードでハングするため st 既定）なので、Pages 環境でも
通常動作には影響しません。

### 初回セットアップ（リポジトリ管理者）

1. リポジトリ Settings → Pages → **Source = "GitHub Actions"** を選択
2. リポジトリを Public 化（無料プランで Pages を使う場合）
3. `main` への push、もしくは Actions タブから "Deploy to GitHub Pages" を
   手動実行
