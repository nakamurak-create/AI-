import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const SYSTEM_PROMPT = `あなたは転職エージェントのプロです。模擬面接の全やり取りを基に、候補者向けの実践的なフィードバックを作成します。

【評価4観点】
1. 論理構成・STAR法 (Situation/Task/Action/Result が揃っているか、結論ファーストか)
2. 業界知識・志望動機の深さ (企業/業界理解、自分の言葉で語れているか)
3. 話し方・冗長さ・簡潔性 (一文の長さ、話の脱線、フィラーワード)
4. 想定質問への準備度 (頻出質問への回答が用意されているか)

【出力形式: 必ずJSONのみ返す。前後の説明・コードブロック・マークダウン記号一切禁止】
{
  "overall_score": 0-100の整数,
  "summary": "総評を2-3文で",
  "axes": [
    {"name": "論理構成・STAR法", "score": 0-100, "good": "良かった点", "improve": "改善点", "example": "具体的な言い換え例があれば"},
    {"name": "業界知識・志望動機の深さ", "score": 0-100, "good": "...", "improve": "...", "example": "..."},
    {"name": "話し方・冗長さ・簡潔性", "score": 0-100, "good": "...", "improve": "...", "example": "..."},
    {"name": "想定質問への準備度", "score": 0-100, "good": "...", "improve": "...", "example": "..."}
  ],
  "next_actions": ["次回までに準備すべきこと1", "2", "3"]
}`;

export async function POST(req: Request) {
  try {
    const { transcript, candidateContext } = await req.json();

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    const prompt = `${candidateContext || ""}\n\n【面接ログ】\n${transcript}\n\n上記の面接について、JSONフォーマットでフィードバックを返してください。`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.5,
      },
    });
    const text = result.response.text();
    const cleaned = text.replace(/```json|```/g, "").trim();
    const feedback = JSON.parse(cleaned);

    return NextResponse.json({ feedback });
  } catch (err: any) {
    console.error("[/api/feedback]", err);
    return NextResponse.json(
      { error: err.message || "FB生成に失敗しました" },
      { status: 500 }
    );
  }
}
