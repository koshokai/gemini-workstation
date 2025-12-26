import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { message, history, files, modelName, systemInstruction } = await request.json();
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) return new Response("No API Key", { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 初始化模型
    const model = genAI.getGenerativeModel({ 
      model: modelName || "gemini-3-flash-preview",
      systemInstruction: systemInstruction
    });

    const promptParts: any[] = [];

    // 📂 1. 智能文件处理
    if (files && files.length > 0) {
      files.forEach((file: any) => {
        if (file.isText) {
          // 🅰️ 代码/文本文件：包装成清晰的文本块
          promptParts.push({
            text: `\n\n=== 📄 文件名: ${file.name} ===\n${file.data}\n=== 文件结束 ===\n\n`
          });
        } else {
          // 🅱️ 图片/PDF：Base64 视觉输入
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

    // 3. 注入当前问题
    // 3. 注入当前问题 (➕ 修改了这里，强制追加格式指令)
    if (message) {
      // 这里的 tricks 是：在用户问题后，强行追加一段 Prompt
      // 无论前端 System Prompt 写没写，这里都会再次强制执行
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
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}