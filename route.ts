import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const SYSTEM_PROMPT = `あなたは経験豊富な女性面接官です。転職希望者への模擬面接を実施します。

【ルール】
- 1回の発言で1つの質問のみ。複数質問を詰め込まない
- 候補者の回答を踏まえた深掘り質問を必ず含める(STAR法に沿って具体性を引き出す)
- 「なぜ?」「具体的には?」「その時何を考えた?」など、思考プロセスを引き出す
- 過度に優しくしない。本番の選考と同等の緊張感を保つ
- 候補者情報・求人情報があれば、それに沿った質問をする
- 面接序盤は導入(自己紹介・職務概要)、中盤は深掘り(実績・志望動機)、終盤は逆質問対応
- 1回の発言は2〜3文以内、簡潔に。話し言葉で自然に

【出力形式】
質問文のみを返す。前置き・解説・絵文字・記号は不要。読み上げに適した自然な日本語で。`;

export async function POST(req: Request) {
  try {
    const { messages, candidateContext } = await req.json();

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_PROMPT + (candidateContext ? "\n\n" + candidateContext : ""),
    });

    // Gemini APIの制約:
    // 1. 履歴の最初のメッセージは必ず "user" ロールでなければならない
    // 2. user と model が交互に並ぶ必要がある
    // フロント側では面接官(assistant)が先に挨拶するため、そのまま送ると壊れる
    // → assistant始まりのメッセージを適切にハンドリングする

    const lastMessage = messages[messages.length - 1];
    const previousMessages = messages.slice(0, -1);

    // Gemini形式に変換 + 先頭がmodelなら前にダミーuserを挿入
    const geminiHistory: Array<{role: string, parts: Array<{text: string}>}> = [];
    for (const m of previousMessages) {
      const role = m.role === "assistant" ? "model" : "user";
      // 先頭がmodelになる場合、ダミーのuserメッセージを挿入
      if (geminiHistory.length === 0 && role === "model") {
        geminiHistory.push({
          role: "user",
          parts: [{ text: "面接を始めてください。" }],
        });
      }
      // 同じロールが連続する場合、前のメッセージに結合(Geminiは交互必須)
      const last = geminiHistory[geminiHistory.length - 1];
      if (last && last.role === role) {
        last.parts[0].text += "\n" + m.content;
      } else {
        geminiHistory.push({ role, parts: [{ text: m.content }] });
      }
    }

    const chat = model.startChat({
      history: geminiHistory,
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.8,
      },
    });

    const result = await chat.sendMessage(lastMessage.content);
    const text = result.response.text().trim();

    return NextResponse.json({ text });
  } catch (err: any) {
    console.error("[/api/interview]", err);
    return NextResponse.json(
      { error: err.message || "面接官応答の生成に失敗しました" },
      { status: 500 }
    );
  }
}
