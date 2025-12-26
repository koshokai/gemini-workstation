import { NextRequest } from 'next/server';
import { 
  GoogleGenerativeAI, 
  HarmCategory, 
  HarmBlockThreshold,
  GenerativeModel
} from '@google/generative-ai';

// ⚡️ 优化 1: 使用 Edge Runtime
// 这能让你的 API 突破 Vercel 的 10秒 限制，支持长时间的流式生成
export const runtime = 'edge'; 

export async function POST(request: NextRequest) {
  try {
    const { message, history, files, modelName, systemInstruction } = await request.json();
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) return new Response("No API Key", { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 🛡️ 优化 2: 宽松的安全设置 (防止 AI 误报拒绝回答)
    // 生产力工具通常需要处理各种内容，BLOCK_ONLY_HIGH 可以避免大部分误判
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ];

    // ⚙️ 优化 3: 生成参数配置
    const generationConfig = {
      // temperature: 0.7 (平衡创造性与准确性，默认值通常不错，可按需调整)
      // maxOutputTokens: 8192 (确保能输出长长长长的深度思考内容)
    };

    // 初始化模型
    const model = genAI.getGenerativeModel({ 
      model: modelName || "gemini-1.5-flash", // 建议默认用 1.5-flash，比 3-flash-preview 更稳定
      systemInstruction: systemInstruction,
      safetySettings: safetySettings,
      // generationConfig: generationConfig // 如需微调可开启
    });

    const promptParts: any[] = [];

    // 📂 1. 智能文件处理
    if (files && files.length > 0) {
      files.forEach((file: any) => {
        if (file.isText) {
          // 🅰️ 代码/文本文件
          promptParts.push({
            text: `\n\n=== 📄 文件名: ${file.name} ===\n${file.data}\n=== 文件结束 ===\n\n`
          });
        } else {
          // 🅱️ 图片/PDF (Base64)
          promptParts.push({
            inlineData: {
              data: file.data,
              mimeType: file.mimeType
            }
          });
        }
      });
    }

    // 2. 注入历史
    if (history) {
      promptParts.push({ text: `历史对话参考:\n${history}\n\n` });
    }

    // 3. 注入当前问题 (保持你的 Prompt Injection 策略)
    if (message) {
      const enforceFormatPrompt = `
      ${message}
      
      ----------------
      【回答格式要求】
      回答完问题后，请换行，并生成 3 个后续建议问题。
      必须严格使用 "///" 开头，并用 "|" 符号分隔三个问题。
      不要使用数字序号 (1. 2. 3.)。
      
      格式示例：
      /// 建议问题一 | 建议问题二 | 建议问题三
      `;
      
      promptParts.push({ text: `用户问题: ${enforceFormatPrompt}` });
    }

    // 调用流式接口
    const result = await model.generateContentStream(promptParts);

    // 返回流
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) controller.enqueue(encoder.encode(chunkText));
          }
          controller.close();
        } catch (err) {
          console.error("Stream Error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error: any) {
    console.error("API Error Details:", error);
    
    // 友好的错误提示
    let errorMessage = error.message;
    if (error.message.includes("429")) errorMessage = "请求太频繁，请稍后再试 (Rate Limit)";
    if (error.message.includes("SAFETY")) errorMessage = "内容被安全策略拦截，请尝试调整提问方式";

    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
}
