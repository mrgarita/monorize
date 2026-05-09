# Monorize

ユーザーが選択した動画を **モノクロのアニメーション GIF** に変換し、
ダウンロードできる Web アプリケーション。**変換処理はすべてブラウザ内で
完結**し、動画はサーバへ送信されません（純粋な静的 SPA）。

## ステータス

**実装段階**（M3-B 完了 / M3-A 残）。技術スタックと主要マイルストーンは
以下の通り（詳細は [`project.md`](./project.md)）。

- **フロントエンド**：Vite + React + TypeScript
- **変換エンジン**：[ffmpeg.wasm](https://ffmpegwasm.netlify.app/) 0.12 系
  （`public/ffmpeg/` に self-host）
- **ステージング**：GitHub Pages（st 版） — 公開中
- **本番**：XServer（st 版） — `https://dianxnao.com/monorize/`

| マイルストーン | 状態 |
|---|---|
| M0 仕様策定 | ✅ |
| M1 実装基盤・UI 骨格 | ✅ |
| M2-A `sample/` 6 本の実機検証 | ✅ |
| M2-B 10,000 件のローカル自動化 | ✅ |
| M3-B GitHub Pages ステージング | ✅ |
| M3-A XServer 本番デプロイ | ✅ |

## 主要ファイル

- [`project.md`](./project.md) — プロダクト仕様書（要件、制約、完了条件）
- [`CLAUDE.md`](./CLAUDE.md) — Claude Code（claude.ai/code）向けの作業ガイド
- `src/` — アプリ本体（React コンポーネント・ffmpeg ラッパ・変換ロジック）
- `public/ffmpeg/` — self-host する `@ffmpeg/core` 実体（`scripts/copy-ffmpeg-core.mjs`
  が `node_modules` から `predev`/`prebuild` でコピー。`.gitignore` 済）
- `scripts/` — `copy-ffmpeg-core.mjs`（self-host コピー）と `m2b/`（10,000 件
  ローカル自動化ハーネス）
- `.github/workflows/deploy-pages.yml` — GitHub Pages デプロイの CI 定義
- `.github/workflows/deploy-xserver.yml` — XServer 本番デプロイの CI 定義
- [`docs/cost.md`](./docs/cost.md) — 運用コスト見積
- [`docs/m2a-verification.md`](./docs/m2a-verification.md) — M2-A 実機検証メモ
- `sample/` — 入力 MP4 と目標出力 GIF のペア（**リポジトリ未管理。下記参照**）

## 主な制約

| 項目 | 内容 |
|---|---|
| 入力サイズの推奨上限 | 500 MB（超過時は警告ダイアログを表示し、了承で続行可能。ハード上限は設けない） |
| 対応入力形式 | `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`, `.wmv`, `.flv`, `.m4v`, `.ts`, `.3gp` |
| 出力形式 | モノクロのアニメーション GIF |
| 1 操作あたり | 1 ファイル（バッチ処理は行わない） |
| 出力サイズ警告 | 推定 200 MB 超で警告ダイアログ（推定式：`W*H*fps*duration*0.30`） |
| 保持ポリシー | サーバを持たないため自動削除処理は不要。ファイルはブラウザのメモリ上にのみ存在し、タブクローズ等で自動消滅 |

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

### 前提

- Node.js 24 LTS（[Volta](https://volta.sh/) 推奨。`package.json` の `volta`
  フィールドで pin 済み）
- Windows 11 / macOS / Linux のいずれか

### セットアップ

```bash
npm ci
```

`predev` / `prebuild` / `prepreview` で `scripts/copy-ffmpeg-core.mjs` が
走り、`node_modules/@ffmpeg/{core,core-mt}/dist/esm` を `public/ffmpeg/` に
コピーします（self-host）。

### よく使うコマンド

| コマンド | 用途 |
|---|---|
| `npm run dev` | Vite 開発サーバを起動（COOP/COEP 付与済 → mt 版も使用可） |
| `npm run build` | 本番ビルド（`tsc -b && vite build`） |
| `npm run preview` | `dist/` を `vite preview` で配信して動作確認 |
| `npm run typecheck` | 型チェックのみ（`tsc -b --noEmit`） |
| `N=10 npm run m2b:harness` | 10,000 件ローカル自動化ハーネスを N 件で実行（M2-B） |
| `FFMPEG_ST_ONLY=1 npm run build` | core-mt を除外したステージング相当ビルド |

### ffmpeg.wasm のスレッドモード

- 既定は **st 版**（`src/ffmpeg/threading.ts`：core-mt は GIF エンコードで
  ハングするため st 既定）
- `?ff=mt` クエリで mt 版を強制（`crossOriginIsolated` 必須なので dev /
  preview / 本番 XServer のみ）

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

## 本番配信（XServer）

`v*` 形式のタグ push、または GitHub Actions の手動実行
（`workflow_dispatch`）で本番にデプロイされます。
**main の push では本番に反映されません**（事故防止）。

- **公開 URL**：`https://dianxnao.com/monorize/`
- **ワークフロー**：[`.github/workflows/deploy-xserver.yml`](./.github/workflows/deploy-xserver.yml)
- **配信内容**：ステージングと同じく **st 版のみ**（`FFMPEG_ST_ONLY=1`）。
  プラン A — `core-mt` は GIF コーデックでハングする既知問題があり
  （`docs/m2a-verification.md`）、本番でも mt 版を配信せず `.htaccess` の
  COOP/COEP も設定不要

### リリース手順（コード上の作業のみ）

```bash
git tag v0.1.0
git push origin v0.1.0
```

`v` で始まるタグの push を Actions が拾い、`npm ci` → `npm run build`
（FFMPEG_ST_ONLY=1）→ `rsync -avz --delete -e "ssh -p 10022"` で
XServer の配置先ディレクトリに同期します。

### 初回セットアップ（リポジトリ管理者）

XServer 側:

1. **SSH を有効化**：XServer サーバパネル → 「SSH 設定」→ ON
2. **SSH アクセス制限を OFF にする**：サーバパネル → SSH → アクセス制限。
   GitHub Actions runner の IP は毎回変わるため、IP 制限が ON だと
   `Connection closed by ... port 10022` で deploy が落ちる
3. **公開鍵を登録**：ローカルで `ssh-keygen -t ed25519 -f xserver_deploy`
   を発行し、公開鍵 (`xserver_deploy.pub`) を XServer に登録
4. **配置先ディレクトリ作成**：
   `/home/<XServerユーザID>/<ドメイン>/public_html/monorize/`

GitHub 側（リポジトリ Settings → Secrets and variables → Actions）:

| Secret 名 | 内容 |
|---|---|
| `XSERVER_SSH_KEY` | 秘密鍵 (`xserver_deploy`) のファイル全文 |
| `XSERVER_KNOWN_HOSTS` | `ssh-keyscan -p 10022 <XSERVER_HOST>` の出力 |
| `XSERVER_HOST` | 例 `sv1234.xserver.jp` |
| `XSERVER_USER` | XServer のサーバ ID |
| `XSERVER_REMOTE_PATH` | 例 `/home/<ID>/<ドメイン>/public_html/monorize/`（**末尾スラッシュ必須**） |

`environment: xserver-production` を設定済みなので、Settings →
Environments で同名環境を作っておくと「本番デプロイ前に承認」を挟む
レビュー運用も可能です（任意）。
