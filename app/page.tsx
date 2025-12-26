'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';
import { 
  Send, StopCircle, User, Zap, 
  Brain, Image as ImageIcon, Table, Workflow, MessageSquare, 
  BookOpen, X, Paperclip, ChevronDown, 
  Maximize, Columns, Grid2X2, Trash2, GripVertical,
  Copy, Check, Download, FileSpreadsheet, Image as ImgIcon,
  Plus, MessageSquareDashed, Layout, Menu, Edit3, Terminal
} from 'lucide-react';

// ✅ 1. 初始化 Mermaid
mermaid.initialize({ 
  startOnLoad: false, 
  theme: 'default', 
  securityLevel: 'loose',
  suppressErrorRendering: true, 
});

// -----------------------------------------------------------------------------
// 🧩 组件：流程图渲染器 (带复制图片功能)
// -----------------------------------------------------------------------------
const MermaidChart = ({ code }: { code: string }) => {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied'>('idle');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderChart = async () => {
      try {
        await mermaid.parse(code); 
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, code);
        setSvg(svg);
        setError(false);
      } catch (err) { setError(true); }
    };
    if (code && code.length > 10) renderChart();
  }, [code]);

  const handleCopyImage = async () => {
    if (!containerRef.current) return;
    const svgElement = containerRef.current.querySelector('svg');
    if (!svgElement) return;
    setCopyStatus('copying');
    try {
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const scale = 2; 
        canvas.width = svgElement.viewBox.baseVal.width * scale;
        canvas.height = svgElement.viewBox.baseVal.height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(async (blob) => {
            if (blob) {
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
              setCopyStatus('copied');
              setTimeout(() => setCopyStatus('idle'), 2000);
            }
          }, 'image/png');
        }
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch (e) { setCopyStatus('idle'); }
  };

  const handleDownload = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'flowchart.svg';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };
  
  if (error) return <div className="text-xs text-slate-400 p-3 font-mono bg-slate-50 border rounded-lg flex items-center gap-2"><span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>图表构建中...</div>;

  return (
    <div className="relative group my-3" ref={containerRef}>
      <div className="overflow-x-auto bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur border border-slate-200 rounded-lg p-1 shadow-sm">
        <button onClick={handleCopyImage} className="flex items-center gap-1 px-2 py-1.5 hover:bg-slate-100 rounded text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors" title="复制为图片">{copyStatus === 'copied' ? <Check size={14} className="text-green-500"/> : <ImgIcon size={14} />}{copyStatus === 'copying' ? '...' : copyStatus === 'copied' ? '已复制' : ''}</button>
        <button onClick={handleDownload} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 transition-colors" title="下载 SVG"><Download size={14} /></button>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 📝 组件：代码块 (新增：支持一键复制)
// -----------------------------------------------------------------------------
const CodeBlock = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(String(children));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-2 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 border-b border-slate-200">
        <div className="flex items-center gap-1.5">
          <Terminal size={12} className="text-slate-400"/>
          <span className="text-[10px] font-mono text-slate-500">{className?.replace('language-', '') || 'code'}</span>
        </div>
        <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-600 transition-colors">
          {copied ? <Check size={12} className="text-green-500"/> : <Copy size={12}/>}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <div className="p-3 overflow-x-auto text-xs font-mono leading-relaxed">
        <code className={className}>{children}</code>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 📊 组件：表格包装器 (支持富文本复制)
// -----------------------------------------------------------------------------
const TableWrapper = ({ children }: { children: React.ReactNode }) => {
  const [copied, setCopied] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const handleCopyTable = async () => {
    if (!tableRef.current) return;
    const tableEl = tableRef.current.querySelector('table');
    if (!tableEl) return;
    try {
      const htmlBlob = new Blob([tableEl.outerHTML], { type: 'text/html' });
      const textBlob = new Blob([tableEl.innerText], { type: 'text/plain' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })]);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const range = document.createRange(); range.selectNode(tableEl);
      window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range);
      document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <div className="relative group my-3 border border-slate-200 rounded-xl overflow-hidden bg-white" ref={tableRef}>
      <div className="overflow-x-auto">{children}</div>
      <button onClick={handleCopyTable} className="absolute top-2 right-2 flex items-center gap-1 bg-white/90 backdrop-blur border border-slate-200 shadow-sm px-2 py-1 rounded-md text-xs font-medium text-slate-500 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <Check size={12} className="text-green-500"/> : <FileSpreadsheet size={12} />}{copied ? '已复制' : '复制表格'}
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ✨ 打字机效果 (包含代码块拦截渲染)
// -----------------------------------------------------------------------------
const TypewriterEffect = ({ content, isTyping }: { content: string, isTyping: boolean }) => {
  const [displayedContent, setDisplayedContent] = useState('');
  useEffect(() => {
    if (!isTyping) { setDisplayedContent(content); return; }
    if (displayedContent.length >= content.length) return;
    const diff = content.length - displayedContent.length;
    const speed = diff > 50 ? 5 : diff > 20 ? 15 : 30;
    const timer = setTimeout(() => {
      const step = diff > 5 ? 2 : 1;
      setDisplayedContent(content.slice(0, displayedContent.length + step));
    }, speed);
    return () => clearTimeout(timer);
  }, [content, displayedContent, isTyping]);

  const mdComponents = {
    table: ({...props}: any) => <TableWrapper><table className="w-full text-xs text-slate-600 border-collapse" {...props} /></TableWrapper>,
    thead: ({...props}: any) => <thead className="bg-slate-50 border-b border-slate-200" {...props} />,
    th: ({...props}: any) => <th className="px-4 py-2 font-semibold text-left border-r border-slate-100 last:border-0" {...props} />,
    td: ({...props}: any) => <td className="px-4 py-2 border-b border-slate-100 border-r last:border-0" {...props} />,
    code({node, inline, className, children, ...props}: any) {
      const isMermaid = /language-mermaid/.test(className || '');
      // Mermaid 处理
      if (!inline && isMermaid && !isTyping) return <MermaidChart code={String(children)} />;
      // 普通代码块 -> 使用新的 CodeBlock 组件 (带复制)
      if (!inline) return <CodeBlock className={className}>{children}</CodeBlock>;
      // 行内代码
      return <code className={`${className} bg-slate-100 rounded px-1.5 py-0.5 text-pink-600 font-mono text-xs`} {...props}>{children}</code>;
    }
  };

  return (
    <div className="prose prose-xs max-w-none prose-p:my-1 prose-headings:my-2 relative">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{displayedContent}</ReactMarkdown>
      {isTyping && displayedContent.length < content.length && <span className="inline-block w-1.5 h-4 ml-0.5 bg-indigo-500 animate-pulse align-text-bottom rounded-sm"></span>}
    </div>
  );
};

// -----------------------------------------------------------------------------
// 🛠️ 工具配置 (修正 Research 模型)
// -----------------------------------------------------------------------------
const TOOLS = [
  { id: 'chat', name: '全能助手', icon: <MessageSquare size={16} />, model: 'gemini-3-flash-preview', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', placeholder: '有什么我可以帮你的吗？', systemPrompt: `全能助手。简练回答。结尾生成3个追问 ///Q1|Q2|Q3` },
  { id: 'image', name: '创意画图', icon: <ImageIcon size={16} />, model: 'gemini-3-pro-image-preview', color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200', placeholder: '描述画面，生成图片...', systemPrompt: `Text-to-Image 接口。1.提炼英文Prompt。2.URL编码。3.输出: ![Img](https://image.pollinations.ai/prompt/{Prompt}?nologo=true) /// 风格优化 | 构图调整 | 变体` },
  { id: 'flow', name: '流程图设计', icon: <Workflow size={16} />, model: 'gemini-3-pro-preview', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', placeholder: '描述流程，我来画图...', systemPrompt: `流程图专家。Mermaid语法。必须包裹在 \`\`\`mermaid ... \`\`\` 中。 /// 优化流程 | 变为时序图 | 导出SVG` },
  { id: 'data', name: '数据制表', icon: <Table size={16} />, model: 'gemini-3-flash-preview', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', placeholder: '输入数据，整理表格...', systemPrompt: `数据分析师。整理为 Markdown 表格。数字列右对齐(---:)。 /// 可视化 | 导出Excel | 深度分析` },
  { id: 'notebook', name: '多模态分析', icon: <BookOpen size={16} />, model: 'gemini-3-pro-preview', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', placeholder: '拖入 代码/PDF/图片...', systemPrompt: `全能分析助手。阅读上传的文件。 /// 解释代码 | 总结文档 | 提取关键点` },
  // 👇 修正：使用真实的思考模型 (Google AI Studio 中可用的)
  { id: 'research', name: '深度思考', icon: <Brain size={16} />, model: 'gemini-3-flash-preview', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', placeholder: '深度推理任务...', systemPrompt: `深度推理专家。一步步思考。 /// 追问1 | 追问2 | 追问3` },
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
  attachments?: { name: string; type: string; data?: string; isText?: boolean }[]; 
  isTyping?: boolean;
}

interface Session {
  id: string;
  title: string;
  histories: Record<string, Message[]>;
  createdAt: number;
}

// -----------------------------------------------------------------------------
// 📦 ToolPanel (修改：拖拽后直接执行)
// -----------------------------------------------------------------------------
const ToolPanel = ({ 
  panelId, currentToolId, history, onSwitchTool, onSend, onClearHistory, isGenerating 
}: { 
  panelId: number, currentToolId: string, history: Message[], onSwitchTool: (id: string) => void, onSend: (toolId: string, text: string, files: any[]) => void, onClearHistory: (toolId: string) => void, isGenerating: boolean
}) => {
  const tool = TOOLS.find(t => t.id === currentToolId) || TOOLS[0];
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<any[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history, isGenerating]);
  
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    Array.from(fileList).forEach(file => {
      const reader = new FileReader();
      const isText = ['js','ts','py','txt','md','csv','json'].some(ext => file.name.endsWith(ext));
      reader.onloadend = () => setFiles(prev => [...prev, { name: file.name, mimeType: isText ? 'text/plain' : file.type, data: isText ? reader.result : (reader.result as string).split(',')[1], isText }]);
      isText ? reader.readAsText(file) : reader.readAsDataURL(file);
    });
  };

  const handlePanelSend = (text: string = input) => {
    if (!text.trim() && files.length === 0) return;
    onSend(tool.id, text, files);
    setInput('');
    setFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  // 🖱️ 拖拽逻辑
  const handleDragStart = (e: React.DragEvent, content: string) => { e.dataTransfer.setData('text/plain', content); e.dataTransfer.effectAllowed = 'copy'; };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsDragOver(false); };
  
  // 🔥 核心修改：Drop 后直接发送
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
    const content = e.dataTransfer.getData('text/plain');
    if (content) {
      // 直接触发发送逻辑，不走 setInput -> 等待 -> 点击按钮
      onSend(tool.id, content, []); 
    }
  };

  return (
    <div 
      className={`flex flex-col h-full bg-white rounded-xl border ${isDragOver ? 'border-indigo-500 ring-2 ring-indigo-100' : tool.border} shadow-sm overflow-hidden transition-all duration-300 relative group`}
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
    >
      <div className={`h-10 border-b ${tool.border} ${tool.bg} flex items-center justify-between px-3 select-none flex-none`}>
        <div className="flex items-center gap-2 relative">
          <div className={`${tool.color}`}>{tool.icon}</div>
          <div className="relative flex items-center cursor-pointer hover:bg-black/5 px-2 py-0.5 rounded transition-colors">
            <span className={`font-bold text-sm ${tool.color} mr-1`}>{tool.name}</span>
            <ChevronDown size={12} className="text-slate-400" />
            <select className="absolute inset-0 opacity-0 cursor-pointer w-full" value={currentToolId} onChange={(e) => onSwitchTool(e.target.value)}>
              {TOOLS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <button onClick={() => onClearHistory(tool.id)} className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded"><Trash2 size={12}/></button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/30">
        {history.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
            <div className="scale-150 mb-2">{tool.icon}</div>
            <p className="text-xs font-medium">拖拽气泡到这里，立即执行...</p>
          </div>
        )}
        {history.map((msg, idx) => (
          <div key={idx} className={`flex gap-2 group/msg ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-none text-white text-[10px] ${msg.role === 'user' ? 'bg-slate-700' : tool.color.replace('text', 'bg')}`}>
              {msg.role === 'user' ? <User size={10} /> : <Zap size={10} />}
            </div>
            <div className={`flex flex-col gap-1 max-w-[92%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {msg.attachments.map((f, i) => (
                    <span key={i} className="text-[9px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500 flex items-center gap-1 shadow-sm">
                      {f.isText ? <Code size={8}/> : <Paperclip size={8}/>} {f.name}
                    </span>
                  ))}
                </div>
              )}
              <div draggable onDragStart={(e) => handleDragStart(e, msg.content)} className={`px-3 py-2 rounded-xl text-sm shadow-sm cursor-grab active:cursor-grabbing relative ${msg.role === 'user' ? 'bg-slate-800 text-white rounded-tr-sm' : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm'} hover:shadow-md transition-shadow`}>
                <div className="absolute -left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/msg:opacity-100 transition-opacity text-slate-300"><GripVertical size={12} /></div>
                {msg.role === 'assistant' ? <TypewriterEffect content={msg.content} isTyping={!!msg.isTyping} /> : <span className="whitespace-pre-wrap">{msg.content}</span>}
              </div>
              {msg.role === 'assistant' && msg.suggestions?.length! > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {msg.suggestions?.map((s, i) => (
                    <button key={i} onClick={() => handlePanelSend(s)} className={`text-[10px] px-2 py-1 bg-white border ${tool.border} ${tool.color} rounded-full shadow-sm hover:scale-[1.02] active:scale-95 transition-all text-left truncate max-w-[200px]`}>✨ {s}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className={`p-2 bg-white border-t flex-none transition-colors ${isDragOver ? 'bg-indigo-50 border-indigo-200' : 'border-slate-100'}`}>
        {files.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1 scrollbar-hide">
            {files.map((f, i) => (
              <div key={i} className="flex flex-none items-center gap-1 text-[10px] bg-slate-50 border border-slate-200 px-2 py-1 rounded-md text-slate-600">
                <span className="truncate max-w-[80px]">{f.name}</span>
                <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500"><X size={10}/></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-lg transition-colors"><Paperclip size={16} /></button>
          <input type="file" multiple ref={fileInputRef} className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          
          <textarea 
            ref={textareaRef}
            rows={1}
            className={`flex-1 bg-slate-50 border-none rounded-lg px-3 py-2 text-xs sm:text-sm focus:ring-1 focus:ring-blue-500 outline-none resize-none overflow-y-auto ${isDragOver ? 'bg-white ring-2 ring-indigo-300 placeholder:text-indigo-400' : ''}`}
            placeholder={isDragOver ? "松手，立即执行..." : tool.placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePanelSend(); } }}
            style={{ minHeight: '36px', maxHeight: '120px' }}
          />
          <button onClick={() => handlePanelSend()} disabled={isGenerating || (!input.trim() && files.length === 0)} className={`p-2 rounded-lg text-white shadow-sm transition-all active:scale-90 disabled:opacity-50 disabled:scale-100 ${isGenerating ? 'bg-slate-400' : tool.color.replace('text', 'bg')}`}>
            {isGenerating ? <StopCircle size={16} /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 🚀 主页面
// -----------------------------------------------------------------------------
export default function WorkstationPage() {
  const [layout, setLayout] = useState<'single' | 'split' | 'grid'>('grid');
  const [slots, setSlots] = useState(['chat', 'data', 'flow', 'image']);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // 会话管理
  const [sessions, setSessions] = useState<Session[]>([
    { id: '1', title: '新的话题', histories: { chat: [], image: [], flow: [], data: [], notebook: [], research: [] }, createdAt: Date.now() }
  ]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('1');
  const [showSidebar, setShowSidebar] = useState(true);

  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];

  const parseResponse = (text: string) => {
    const idx = text.lastIndexOf('///');
    if (idx === -1) return { cleanContent: text, suggestions: [] };
    const rawSuggestions = text.substring(idx + 3).trim();
    let suggestions = rawSuggestions.includes('|') ? rawSuggestions.split('|') : rawSuggestions.split(/(?:^|\s+)(?:\d+[\.、]\s*|[-•]\s+)/);
    return { cleanContent: text.substring(0, idx).trim(), suggestions: suggestions.map(s => s.trim()).filter(s => s) };
  };

  const createNewSession = () => {
    const newId = Date.now().toString();
    const newSession: Session = { id: newId, title: '新对话', histories: { chat: [], image: [], flow: [], data: [], notebook: [], research: [] }, createdAt: Date.now() };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
  };

  const generateTitle = async (sessionId: string, firstMessage: string) => {
    try {
      const res = await fetch('/api/chat/gemini', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `请根据这句话总结一个非常简短的标题(5-10字以内)，不要任何标点符号：${firstMessage}`, modelName: 'gemini-3-flash-preview' })
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let title = '';
      while (true) { const { value, done } = await reader!.read(); if (done) break; title += decoder.decode(value); }
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: title.trim() } : s));
    } catch (e) { console.error('Auto title failed', e); }
  };

  const handleGlobalSend = async (toolId: string, userText: string, files: any[]) => {
    const sessionId = currentSessionId;
    const isFirstMessage = Object.values(currentSession.histories).every(h => h.length === 0);
    if (isFirstMessage && userText.length > 0) generateTitle(sessionId, userText);

    const newMessage: Message = { role: 'user', content: userText, attachments: files };
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, histories: { ...s.histories, [toolId]: [...(s.histories[toolId] || []), newMessage, { role: 'assistant', content: '', isTyping: true }] } } : s));
    setIsGenerating(true);

    try {
      const tool = TOOLS.find(t => t.id === toolId) || TOOLS[0];
      const currentHistory = currentSession.histories[toolId] || [];
      const historyStr = currentHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');
      const res = await fetch('/api/chat/gemini', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, history: historyStr, files: files, modelName: tool.model, systemInstruction: tool.systemPrompt })
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      while (true) {
        const { value, done } = await reader!.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setSessions(prev => prev.map(s => {
          if (s.id !== sessionId) return s;
          const newToolHistory = [...s.histories[toolId]];
          const lastMsg = newToolHistory[newToolHistory.length - 1];
          if (lastMsg.role === 'assistant') {
             const splitIndex = fullText.indexOf('///');
             const visibleContent = splitIndex !== -1 ? fullText.substring(0, splitIndex) : fullText;
             newToolHistory[newToolHistory.length - 1] = { ...lastMsg, content: visibleContent, isTyping: true };
          }
          return { ...s, histories: { ...s.histories, [toolId]: newToolHistory } };
        }));
      }
      const { cleanContent, suggestions } = parseResponse(fullText);
      setSessions(prev => prev.map(s => {
        if (s.id !== sessionId) return s;
        const newToolHistory = [...s.histories[toolId]];
        newToolHistory[newToolHistory.length - 1] = { role: 'assistant', content: cleanContent, suggestions, isTyping: false };
        return { ...s, histories: { ...s.histories, [toolId]: newToolHistory } };
      }));
    } catch (e) { console.error(e); } finally { setIsGenerating(false); }
  };

  const clearHistory = (toolId: string) => {
    setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, histories: { ...s.histories, [toolId]: [] } } : s));
  };

  const activeSlotCount = layout === 'single' ? 1 : layout === 'split' ? 2 : 4;
  const gridClass = layout === 'single' ? 'grid-cols-1 grid-rows-1' : layout === 'split' ? 'grid-cols-1 md:grid-cols-2 grid-rows-1' : 'grid-cols-1 md:grid-cols-2 grid-rows-2';

  return (
    <div className="h-[100dvh] bg-slate-100 flex font-sans text-slate-900 overflow-hidden">
      <aside className={`${showSidebar ? 'w-64' : 'w-0'} bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 overflow-hidden flex-none z-40`}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="font-bold text-white tracking-tight flex items-center gap-2"><Layout size={18}/> 话题列表</div>
          <button onClick={() => createNewSession()} className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"><Plus size={18}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map(session => (
            <button key={session.id} onClick={() => setCurrentSessionId(session.id)} className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 transition-all ${currentSessionId === session.id ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700' : 'hover:bg-slate-800/50 hover:text-white'}`}>
              <MessageSquareDashed size={16} className={currentSessionId === session.id ? 'text-blue-400' : 'text-slate-500'} />
              <div className="flex-1 truncate text-sm font-medium">{session.title}</div>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 flex justify-between">
           <span>{sessions.length} 个活跃会话</span>
           <button onClick={() => setSessions(prev => prev.filter(s => s.id !== currentSessionId || prev.length === 1))} className="hover:text-red-400"><Trash2 size={14}/></button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col h-full min-w-0">
        <header className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-none z-50 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSidebar(!showSidebar)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500"><Menu size={18}/></button>
            <div className="w-px h-4 bg-slate-300"></div>
            <div className="font-bold text-sm text-slate-700 flex items-center gap-2">{currentSession.title} <Edit3 size={12} className="text-slate-300 cursor-pointer hover:text-blue-500"/></div>
          </div>
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {[{ id: 'single', icon: <Maximize size={16}/>, label: '单视窗' }, { id: 'split', icon: <Columns size={16}/>, label: '分屏' }, { id: 'grid', icon: <Grid2X2 size={16}/>, label: '四宫格' }].map((mode: any) => (
              <button key={mode.id} onClick={() => setLayout(mode.id)} className={`p-1.5 px-3 rounded-md transition-all flex items-center gap-2 text-xs font-medium ${layout === mode.id ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                {mode.icon} <span className="hidden sm:inline">{mode.label}</span>
              </button>
            ))}
          </div>
        </header>
        <main className="flex-1 p-2 sm:p-3 overflow-hidden">
          <div className={`grid gap-3 h-full w-full transition-all duration-300 ease-in-out ${gridClass}`}>
            {Array.from({ length: activeSlotCount }).map((_, index) => (
              <ToolPanel key={index} panelId={index} currentToolId={slots[index]} history={currentSession.histories[slots[index]] || []} isGenerating={isGenerating} onSwitchTool={(newId) => { const newSlots = [...slots]; newSlots[index] = newId; setSlots(newSlots); }} onSend={handleGlobalSend} onClearHistory={clearHistory} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
