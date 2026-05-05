"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant" | "system_context";
  content: string;
};

type CandidateInfo = {
  name: string;
  currentRole: string;
  targetCompany: string;
  targetRole: string;
  notes: string;
};

type Feedback = {
  overall_score: number;
  summary: string;
  axes: Array<{
    name: string;
    score: number;
    good: string;
    improve: string;
    example?: string;
  }>;
  next_actions: string[];
  error?: string;
};

export default function InterviewApp() {
  const [stage, setStage] = useState<"setup" | "interview" | "feedback">("setup");
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo>({
    name: "",
    currentRole: "",
    targetCompany: "",
    targetRole: "",
    notes: "",
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [textInput, setTextInput] = useState("");
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [micError, setMicError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const finalTextRef = useRef("");
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimText]);

  // ============ 日本語女性ボイス選択 ============
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const jaVoices = voices.filter(
        (v) => v.lang === "ja-JP" || v.lang.startsWith("ja")
      );
      const femaleKeywords = [
        "Kyoko", "Haruka", "Ayumi", "Sayaka", "Nanami", "Mizuki",
        "Female", "Woman", "Google 日本語",
      ];
      const maleKeywords = ["Otoya", "Hattori", "Ichiro", "Male"];
      const chosen =
        jaVoices.find(
          (v) =>
            femaleKeywords.some((k) => v.name.includes(k)) &&
            !maleKeywords.some((k) => v.name.includes(k))
        ) ||
        jaVoices.find((v) => !maleKeywords.some((k) => v.name.includes(k))) ||
        jaVoices[0];
      selectedVoiceRef.current = chosen || null;
      console.log("[TTS] 選択音声:", chosen?.name);
    };
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // ============ マイク権限 ============
  const requestMicPermission = async (): Promise<boolean> => {
    try {
      setMicError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch (err: any) {
      console.error("[MIC]", err);
      setMicError(
        "マイクへのアクセスが拒否されました。ブラウザのアドレスバー左の鍵アイコンからマイク許可を有効にしてください。"
      );
      return false;
    }
  };

  // ============ 音声認識 ============
  const setupRecognition = () => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMicError("お使いのブラウザは音声認識に対応していません。Chrome/Edgeを推奨します。");
      return null;
    }
    const recognition = new SR();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTextRef.current += transcript;
        } else {
          interim += transcript;
        }
      }
      setTextInput(finalTextRef.current);
      setInterimText(interim);
    };
    recognition.onerror = (e: any) => {
      console.error("[ASR]", e.error);
      let msg = "";
      if (e.error === "not-allowed") msg = "マイクアクセスが拒否されました。";
      else if (e.error === "no-speech") msg = "音声が検出されませんでした。";
      else if (e.error === "audio-capture") msg = "マイクが見つかりません。";
      else if (e.error === "network") msg = "ネットワークエラー。インターネット接続を確認してください。";
      else msg = `エラー: ${e.error}`;
      setMicError(msg);
      setIsRecording(false);
    };
    recognition.onend = () => {
      setIsRecording(false);
      setInterimText("");
    };
    return recognition;
  };

  const startRecording = async () => {
    setMicError("");
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    const ok = await requestMicPermission();
    if (!ok) return;

    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setAiSpeaking(false);

    const rec = setupRecognition();
    if (!rec) return;
    recognitionRef.current = rec;
    finalTextRef.current = textInput;

    try {
      rec.start();
    } catch (err: any) {
      setMicError("音声認識開始失敗: " + err.message);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsRecording(false);
    setInterimText("");
  };

  // ============ ブラウザTTSで読み上げ (女性ボイス) ============
  const speak = (text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const sentences = text.split(/(?<=[。!?\?\!])/).filter((s) => s.trim());
    let idx = 0;
    setAiSpeaking(true);
    const speakNext = () => {
      if (idx >= sentences.length) {
        setAiSpeaking(false);
        return;
      }
      const u = new SpeechSynthesisUtterance(sentences[idx]);
      u.lang = "ja-JP";
      if (selectedVoiceRef.current) u.voice = selectedVoiceRef.current;
      u.rate = 1.05;
      u.pitch = 1.15;
      u.volume = 1.0;
      u.onend = () => { idx++; speakNext(); };
      u.onerror = () => setAiSpeaking(false);
      window.speechSynthesis.speak(u);
    };
    speakNext();
  };

  // ============ 面接開始 ============
  const buildContextMessage = () => {
    return `【候補者情報】
氏名: ${candidateInfo.name || "未入力"}
現職: ${candidateInfo.currentRole || "未入力"}
応募先企業: ${candidateInfo.targetCompany || "未入力"}
応募ポジション: ${candidateInfo.targetRole || "未入力"}
補足: ${candidateInfo.notes || "なし"}`;
  };

  const startInterview = async () => {
    setStage("interview");
    const contextMsg = buildContextMessage();
    const opening = `では、${candidateInfo.name || "候補者さん"}、${candidateInfo.targetCompany || "応募先企業"}の${candidateInfo.targetRole || "ポジション"}の面接を始めさせていただきます。まず、簡単に自己紹介と現在のお仕事についてお聞かせください。`;
    setMessages([
      { role: "system_context", content: contextMsg },
      { role: "assistant", content: opening },
    ]);
    setTimeout(() => speak(opening), 300);
  };

  const sendAnswer = async () => {
    const answer = textInput.trim();
    if (!answer || isLoading) return;
    if (isRecording) stopRecording();
    finalTextRef.current = "";

    const newMessages: Message[] = [...messages, { role: "user", content: answer }];
    setMessages(newMessages);
    setTextInput("");
    setIsLoading(true);

    try {
      const apiMessages = newMessages
        .filter((m) => m.role !== "system_context")
        .map((m) => ({ role: m.role, content: m.content }));
      const contextMsg = newMessages.find((m) => m.role === "system_context");

      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          candidateContext: contextMsg?.content || "",
        }),
      });

      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const aiText = data.text;

      setMessages([...newMessages, { role: "assistant", content: aiText }]);
      speak(aiText);
    } catch (err) {
      console.error(err);
      setMessages([
        ...newMessages,
        { role: "assistant", content: "(エラーが発生しました。もう一度お試しください)" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const finishInterview = async () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (isRecording) stopRecording();
    setStage("feedback");
    setFeedbackLoading(true);

    try {
      const transcript = messages
        .filter((m) => m.role !== "system_context")
        .map((m) => `${m.role === "assistant" ? "面接官" : "候補者"}: ${m.content}`)
        .join("\n\n");
      const contextMsg = messages.find((m) => m.role === "system_context");

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          candidateContext: contextMsg?.content || "",
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFeedback(data.feedback);
    } catch (err: any) {
      console.error(err);
      setFeedback({
        overall_score: 0,
        summary: "",
        axes: [],
        next_actions: [],
        error: err.message || "FBの生成に失敗しました",
      });
    } finally {
      setFeedbackLoading(false);
    }
  };

  const resetAll = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (isRecording) stopRecording();
    setStage("setup");
    setMessages([]);
    setFeedback(null);
    setTextInput("");
    setInterimText("");
    finalTextRef.current = "";
  };

  const testMic = async () => {
    setStatusMsg("");
    const ok = await requestMicPermission();
    if (ok) setStatusMsg("✓ マイクへのアクセスが許可されました");
  };

  const testVoice = () => {
    speak("こんにちは。本日は面接にお越しいただきありがとうございます。私が面接官を務めさせていただきます。");
  };

  // =============== UI ===============
  const bgStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "radial-gradient(ellipse at top, #2a2520 0%, #1a1612 50%, #0f0d0a 100%)",
    color: "#e8e0d4",
    fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', serif",
    padding: "32px 16px",
  };

  // ===== 設定画面 =====
  if (stage === "setup") {
    return (
      <div style={bgStyle}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.4em", color: "#a89880", marginBottom: 12 }}>
              MOCK INTERVIEW SESSION — v1.0
            </div>
            <h1 style={{ fontSize: 42, fontWeight: 400, margin: 0, letterSpacing: "0.02em" }}>
              AI模擬面接
            </h1>
            <div style={{ width: 60, height: 1, background: "#a89880", margin: "20px auto" }} />
            <p style={{ color: "#a89880", fontSize: 14, lineHeight: 1.8 }}>
              候補者情報を入力後、面接を開始します。<br />所要時間の目安: 15〜30分
            </p>
          </div>

          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(168,152,128,0.2)", padding: 32, borderRadius: 4 }}>
            {([
              { key: "name", label: "氏名", placeholder: "山田 太郎" },
              { key: "currentRole", label: "現職・経歴", placeholder: "例: 株式会社○○ 営業部 法人営業 5年" },
              { key: "targetCompany", label: "応募先企業", placeholder: "例: 株式会社△△" },
              { key: "targetRole", label: "応募ポジション", placeholder: "例: フィールドセールス" },
            ] as const).map((f) => (
              <div key={f.key} style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, letterSpacing: "0.15em", color: "#a89880", marginBottom: 8, textTransform: "uppercase" }}>
                  {f.label}
                </label>
                <input
                  type="text"
                  value={candidateInfo[f.key as keyof CandidateInfo]}
                  onChange={(e) => setCandidateInfo({ ...candidateInfo, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  style={{ width: "100%", padding: "12px 14px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(168,152,128,0.3)", color: "#e8e0d4", fontSize: 15, fontFamily: "inherit", borderRadius: 2, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, letterSpacing: "0.15em", color: "#a89880", marginBottom: 8, textTransform: "uppercase" }}>
                補足情報・想定質問など
              </label>
              <textarea
                value={candidateInfo.notes}
                onChange={(e) => setCandidateInfo({ ...candidateInfo, notes: e.target.value })}
                placeholder="例: 志望動機の深掘りを重点的に。前職の退職理由を聞かれた時の対応に課題あり。"
                rows={4}
                style={{ width: "100%", padding: "12px 14px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(168,152,128,0.3)", color: "#e8e0d4", fontSize: 15, fontFamily: "inherit", borderRadius: 2, outline: "none", resize: "vertical", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: 13, color: "#a89880" }}>
              <input type="checkbox" id="voice" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} style={{ accentColor: "#c9a961" }} />
              <label htmlFor="voice">面接官の音声読み上げを有効化(女性ボイス)</label>
            </div>

            <div style={{ marginBottom: 24, padding: 14, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(168,152,128,0.2)", borderRadius: 2 }}>
              <div style={{ fontSize: 12, color: "#a89880", marginBottom: 10 }}>
                ▼ 面接前にマイクと音声をテスト
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={testMic} style={{ padding: "8px 14px", background: "rgba(201,169,97,0.15)", border: "1px solid rgba(201,169,97,0.5)", color: "#c9a961", cursor: "pointer", fontSize: 12, letterSpacing: "0.1em", fontFamily: "inherit", borderRadius: 2 }}>
                  🎤 マイクテスト
                </button>
                <button onClick={testVoice} style={{ padding: "8px 14px", background: "rgba(201,169,97,0.15)", border: "1px solid rgba(201,169,97,0.5)", color: "#c9a961", cursor: "pointer", fontSize: 12, letterSpacing: "0.1em", fontFamily: "inherit", borderRadius: 2 }}>
                  🔊 音声テスト
                </button>
              </div>
              {statusMsg && <div style={{ marginTop: 10, fontSize: 12, color: "#9ab87a" }}>{statusMsg}</div>}
              {micError && <div style={{ marginTop: 10, fontSize: 12, color: "#e8a0a0", lineHeight: 1.6 }}>{micError}</div>}
              {aiSpeaking && <div style={{ marginTop: 10, fontSize: 12, color: "#c9a961" }}>♪ 読み上げ中...</div>}
            </div>

            <button onClick={startInterview} style={{ width: "100%", padding: "16px", background: "linear-gradient(180deg, #c9a961 0%, #a8884a 100%)", color: "#1a1612", border: "none", fontSize: 14, letterSpacing: "0.3em", fontWeight: 600, cursor: "pointer", borderRadius: 2, fontFamily: "inherit", textTransform: "uppercase" }}>
              面接を始める
            </button>
          </div>

          <div style={{ marginTop: 24, fontSize: 11, color: "#6a5d48", textAlign: "center", lineHeight: 1.7 }}>
            ※ 音声認識・読み上げはGoogle Chrome / Edge推奨<br />
            ※ Powered by Google Gemini (無料枠: 1日1500リクエスト)
          </div>
        </div>
      </div>
    );
  }

  // ===== 面接画面 =====
  if (stage === "interview") {
    return (
      <div style={bgStyle}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid rgba(168,152,128,0.2)" }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.3em", color: "#a89880" }}>INTERVIEW IN PROGRESS</div>
              <div style={{ fontSize: 16, marginTop: 4 }}>
                {candidateInfo.targetCompany || "—"} ／ {candidateInfo.targetRole || "—"}
              </div>
            </div>
            <button onClick={finishInterview} style={{ padding: "10px 20px", background: "transparent", border: "1px solid rgba(168,152,128,0.5)", color: "#a89880", cursor: "pointer", fontSize: 12, letterSpacing: "0.2em", fontFamily: "inherit", textTransform: "uppercase", borderRadius: 2 }}>
              面接を終了 → FB
            </button>
          </div>

          <div style={{ minHeight: 400, maxHeight: "55vh", overflowY: "auto", padding: "8px 4px", marginBottom: 20 }}>
            {messages.filter((m) => m.role !== "system_context").map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "assistant" ? "flex-start" : "flex-end", marginBottom: 18 }}>
                <div style={{ maxWidth: "78%", padding: "14px 18px", background: m.role === "assistant" ? "rgba(201, 169, 97, 0.08)" : "rgba(255,255,255,0.05)", border: m.role === "assistant" ? "1px solid rgba(201, 169, 97, 0.3)" : "1px solid rgba(255,255,255,0.1)", borderRadius: 4, lineHeight: 1.8, fontSize: 15 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.25em", color: m.role === "assistant" ? "#c9a961" : "#a89880", marginBottom: 6, textTransform: "uppercase" }}>
                    {m.role === "assistant" ? "面接官" : "候補者"}
                  </div>
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && <div style={{ color: "#a89880", fontSize: 13, fontStyle: "italic" }}>面接官が考えています...</div>}
            {aiSpeaking && <div style={{ color: "#c9a961", fontSize: 12, marginTop: 4 }}>♪ 読み上げ中...</div>}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(168,152,128,0.3)", padding: 16, borderRadius: 4 }}>
            {isRecording && (
              <div style={{ marginBottom: 10, padding: "8px 12px", background: "rgba(168,50,50,0.15)", border: "1px solid #a83232", borderRadius: 2, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#e85050", animation: "pulse 1.2s infinite" }} />
                <span style={{ fontSize: 13, color: "#e8a0a0" }}>録音中... 話し終わったら「停止」を押してください</span>
              </div>
            )}
            {micError && !isRecording && (
              <div style={{ marginBottom: 10, padding: "8px 12px", background: "rgba(168,50,50,0.1)", border: "1px solid rgba(168,50,50,0.4)", borderRadius: 2, fontSize: 12, color: "#e8a0a0", lineHeight: 1.6 }}>
                ⚠ {micError}
              </div>
            )}

            <textarea
              value={textInput + (interimText ? " " + interimText : "")}
              onChange={(e) => { setTextInput(e.target.value); finalTextRef.current = e.target.value; }}
              placeholder="ここに回答を入力するか、下の音声入力ボタンを押して話してください..."
              rows={3}
              style={{ width: "100%", background: "transparent", border: "none", color: "#e8e0d4", fontSize: 15, fontFamily: "inherit", outline: "none", resize: "vertical", lineHeight: 1.7, boxSizing: "border-box" }}
              disabled={isLoading}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(168,152,128,0.15)" }}>
              <button onClick={() => (isRecording ? stopRecording() : startRecording())} disabled={isLoading} style={{ padding: "10px 20px", background: isRecording ? "#a83232" : "rgba(201,169,97,0.15)", border: `1px solid ${isRecording ? "#a83232" : "rgba(201,169,97,0.5)"}`, color: isRecording ? "#fff" : "#c9a961", cursor: isLoading ? "not-allowed" : "pointer", fontSize: 13, letterSpacing: "0.15em", fontFamily: "inherit", borderRadius: 2, fontWeight: 500 }}>
                {isRecording ? "■ 停止" : "🎤 音声入力 開始"}
              </button>
              <button onClick={sendAnswer} disabled={isLoading || !textInput.trim()} style={{ padding: "10px 28px", background: isLoading || !textInput.trim() ? "rgba(201, 169, 97, 0.3)" : "linear-gradient(180deg, #c9a961 0%, #a8884a 100%)", color: "#1a1612", border: "none", cursor: isLoading || !textInput.trim() ? "not-allowed" : "pointer", fontSize: 13, letterSpacing: "0.25em", fontWeight: 600, borderRadius: 2, fontFamily: "inherit", textTransform: "uppercase" }}>
                回答する →
              </button>
            </div>
          </div>

          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.3); } }`}</style>
        </div>
      </div>
    );
  }

  // ===== FB画面 =====
  if (stage === "feedback") {
    return (
      <div style={bgStyle}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.4em", color: "#a89880", marginBottom: 8 }}>FEEDBACK REPORT</div>
            <h2 style={{ fontSize: 32, fontWeight: 400, margin: 0 }}>面接フィードバック</h2>
            <div style={{ width: 60, height: 1, background: "#a89880", margin: "16px auto" }} />
          </div>

          {feedbackLoading && (
            <div style={{ textAlign: "center", padding: 60, color: "#a89880", fontStyle: "italic" }}>
              面接ログを分析中です...
            </div>
          )}

          {feedback && feedback.error && (
            <div style={{ padding: 24, background: "rgba(168,50,50,0.1)", border: "1px solid #a83232", color: "#e8a0a0" }}>
              {feedback.error}
            </div>
          )}

          {feedback && !feedback.error && (
            <>
              <div style={{ background: "rgba(201, 169, 97, 0.05)", border: "1px solid rgba(201, 169, 97, 0.3)", padding: 32, marginBottom: 24, textAlign: "center", borderRadius: 4 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.3em", color: "#a89880", marginBottom: 8 }}>OVERALL SCORE</div>
                <div style={{ fontSize: 72, fontWeight: 300, color: "#c9a961", lineHeight: 1, margin: "8px 0" }}>
                  {feedback.overall_score}<span style={{ fontSize: 24, color: "#a89880" }}>/100</span>
                </div>
                <p style={{ color: "#d4c8b0", lineHeight: 1.8, margin: "16px 0 0" }}>{feedback.summary}</p>
              </div>

              {feedback.axes.map((axis, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(168,152,128,0.2)", padding: 24, marginBottom: 16, borderRadius: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 500, margin: 0, letterSpacing: "0.05em" }}>{axis.name}</h3>
                    <div style={{ fontSize: 24, color: "#c9a961" }}>
                      {axis.score}<span style={{ fontSize: 13, color: "#6a5d48" }}>/100</span>
                    </div>
                  </div>
                  <div style={{ height: 3, background: "rgba(168,152,128,0.15)", marginBottom: 18 }}>
                    <div style={{ height: "100%", width: `${axis.score}%`, background: "linear-gradient(90deg, #a8884a, #c9a961)" }} />
                  </div>
                  <FBSection label="◯ 良かった点" content={axis.good} color="#9ab87a" />
                  <FBSection label="△ 改善点" content={axis.improve} color="#d4a86a" />
                  {axis.example && axis.example !== "..." && <FBSection label="◇ 言い換え例" content={axis.example} color="#a89880" />}
                </div>
              ))}

              {feedback.next_actions.length > 0 && (
                <div style={{ background: "rgba(201, 169, 97, 0.05)", border: "1px solid rgba(201, 169, 97, 0.3)", padding: 24, marginTop: 24, borderRadius: 4 }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.3em", color: "#c9a961", marginBottom: 14 }}>
                    NEXT ACTIONS — 次回までの宿題
                  </div>
                  {feedback.next_actions.map((a, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: i < feedback.next_actions.length - 1 ? "1px solid rgba(168,152,128,0.15)" : "none" }}>
                      <span style={{ color: "#c9a961", fontWeight: 600 }}>{String(i + 1).padStart(2, "0")}</span>
                      <span style={{ lineHeight: 1.7 }}>{a}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 32, marginBottom: 32 }}>
            <button onClick={resetAll} style={{ flex: 1, padding: 14, background: "transparent", border: "1px solid rgba(168,152,128,0.5)", color: "#a89880", cursor: "pointer", fontSize: 12, letterSpacing: "0.25em", fontFamily: "inherit", textTransform: "uppercase", borderRadius: 2 }}>
              新しい面接を始める
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function FBSection({ label, content, color }: { label: string; content: string; color: string }) {
  if (!content || content === "...") return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.2em", color, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14, lineHeight: 1.8, color: "#d4c8b0" }}>{content}</div>
    </div>
  );
}
