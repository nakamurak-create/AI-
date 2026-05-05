# AI模擬面接システム(無課金版)

転職エージェント向けのAI面接システム。**完全無料**で運用可能。

## 機能

- 🎤 音声入力(ブラウザ標準・無料)
- 🔊 女性ボイスでの読み上げ(ブラウザ標準TTS・無料)
- 🤖 Google Gemini による面接官役 & FB生成(無料枠: 1日1500リクエスト)
- 📊 4観点FB:論理構成・業界知識・話し方・準備度

## 技術スタック

- Next.js 14 (App Router)
- Google Gemini API (`gemini-1.5-flash`) - **無料**
- ブラウザ標準 Web Speech API
- ホスティング: Vercel - **無料**

## コスト

**完全無料で運用可能**

- Gemini API: 1日1500リクエスト/分15リクエストまで無料
  - 面接1回あたり約20〜40リクエスト消費 → **1日30〜70件の面接が無料**
- Vercel: 個人利用は無料(月100GB帯域、無制限デプロイ)
- TTS/ASR: ブラウザ標準のため無料

無料枠を超える可能性は実運用ではほぼゼロです。

---

## デプロイ手順(全5ステップ・15分)

### ステップ1: Gemini APIキー取得(完全無料・カード登録不要)

1. https://aistudio.google.com/app/apikey にアクセス(Googleアカウントでログイン)
2. 「Create API key」をクリック
3. 「Create API key in new project」を選択
4. `AIzaSy...` で始まるキーが発行される → **コピーして保存**

**※ クレジットカード登録不要、完全無料**

### ステップ2: zipをDLして解凍

```bash
cd ~/Documents
unzip ai-interview.zip
cd ai-interview
```

(任意)ローカルで動作確認:

```bash
npm install
cp .env.local.example .env.local
# .env.localにGEMINI_API_KEYを記入
npm run dev
# → http://localhost:3000
```

### ステップ3: GitHubにpush

GitHubブラウザで新規リポジトリ作成:
1. https://github.com/new
2. Repository name: `ai-interview`
3. Privateにして「Create repository」

ローカルからpush:

```bash
cd ai-interview
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/nakamurak-create/ai-interview.git
git push -u origin main
```

### ステップ4: Vercelで新規プロジェクト作成

1. https://vercel.com/new
2. 「Import Git Repository」から `nakamurak-create/ai-interview` を選択
3. Framework Preset: **Next.js** が自動検出される
4. **「Deploy」を押す前に下のステップ5へ**

### ステップ5: 環境変数を設定 → デプロイ

Vercelの新規プロジェクト画面で **「Environment Variables」** セクションを開き、以下を追加:

| Name | Value |
|------|-------|
| `GEMINI_API_KEY` | ステップ1で取得した `AIzaSy...` |

→ **「Deploy」** をクリック

1〜2分でビルド完了 → `https://ai-interview-xxxxx.vercel.app` のURLが発行される。
これが**候補者に共有するURL**。

---

## 使い方

1. 発行されたVercel URLにアクセス
2. 候補者情報・応募先情報・補足を入力
3. 🎤 マイクテスト と 🔊 音声テストで動作確認
4. 「面接を始める」をクリック
5. 面接官の質問に音声 or テキストで回答
6. 「面接を終了 → FB」でフィードバック生成

---

## つまずきポイント

**Q: GitHubへのpushでパスワードが弾かれる**
→ Personal Access Tokenが必要。https://github.com/settings/tokens で生成

**Q: VercelでBuild Failedになる**
→ Vercelの「Deployments」→「Build Logs」を確認。99%は環境変数の設定漏れ

**Q: 「面接を始める」を押してもAI応答が返ってこない**
→ ブラウザの開発者ツール(F12)→「Console」タブでエラー確認。GEMINI_API_KEYの設定漏れ・誤りが多い

**Q: 音声がロボット声で気になる**
→ ブラウザ標準TTSの限界。後でOpenAI TTS等に切り替え可能(月数百円〜)

---

## カスタマイズ箇所

| やりたいこと | ファイル |
|-------------|---------|
| 面接官のキャラ・質問方針を変える | `app/api/interview/route.ts` の `SYSTEM_PROMPT` |
| FB評価軸を変える | `app/api/feedback/route.ts` の `SYSTEM_PROMPT` |
| 音声の話速・ピッチ調整 | `app/components/InterviewApp.tsx` の `speak()` 関数内 `rate` / `pitch` |
| 配色・デザイン変更 | `app/components/InterviewApp.tsx` の `bgStyle` 等 |

---

## 今後の拡張候補

- [ ] Supabaseに面接ログを保存(中村さんは既に採用システムでSupabase運用中なので連携しやすい)
- [ ] 候補者ごとの専用URL発行(中村さんが事前に候補者情報を登録)
- [ ] 業界別質問テンプレート(IT/金融/メーカー等)
- [ ] FB結果のPDFエクスポート
- [ ] 後で音声品質を上げたくなったらOpenAI TTSへ切り替え(月数百円〜)
