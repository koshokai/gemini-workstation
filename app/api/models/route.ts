import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // 确保不缓存，每次都拉取最新列表

export async function GET() {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key missing' }, { status: 500 });
    }

    // 直接请求 Google 的模型列表接口
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });

    const data = await response.json();

    if (data.error) {
      return NextResponse.json(data, { status: 400 });
    }

    // 过滤并排序，只显示生成式模型（排除掉 embedding 等工具模型，看起来更清晰）
    const chatModels = data.models
      ?.filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => ({
        name: m.name.replace('models/', ''), // 去掉前缀，只留核心代号
        version: m.version,
        displayName: m.displayName,
        description: m.description
      }))
      .sort((a: any, b: any) => b.version.localeCompare(a.version)); // 尝试按版本号降序

    return NextResponse.json({
      count: chatModels.length,
      models: chatModels
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}