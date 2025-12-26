import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: '你好！这是你的第一个 API！',
    time: new Date().toLocaleString('zh-CN')
  });
}