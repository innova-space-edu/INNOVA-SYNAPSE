'use client';
import { useState } from 'react';
import { Bot, ChevronDown, CornerUpRight, Send, Sparkles, X } from 'lucide-react';
import type { ChatMessage, Provider } from '@/lib/types';
import { sanitizeAITextEdits, sourceFingerprint, type AITextEdit } from '@/lib/ai-edits';
import { AGENT_MODES, type AIAgentMode } from '@/lib/ai-agents';

const PROVIDERS: {id: Provider; label:string}[] = [
 {id:'gemini',label:'Gemini'}, {id:'groq',label:'Groq'}, {id:'openrouter',label:'OpenRouter'},
 {id:'sambanova',label:'SambaNova'}, {id:'cerebras',label:'Cerebras'},
 {id:'together',label:'Together'}, {id:'openai',label:'OpenAI'}
];
type Props = {
  source: string;
  activeFile: string;
  lastLog?: string;
  onApply: (text: string) => void;
  onApplyEdits: (edits: AITextEdit[], filePath: string, fingerprint: string) => Promise<void>;
  initialMessages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
};

export function AIChat({ source, activeFile, lastLog, onApply, onApplyEdits, initialMessages, onMessagesChange }: Props) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>('gemini');
  const [mode, setMode] = useState<AIAgentMode>('edit');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [pending, setPending] = useState(false);
  const [applying, setApplying] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function send() {
    if (!prompt.trim() || pending || applying) return;
    const message = prompt.trim();
    const previous = [...messages];
    const withUser: ChatMessage[] = [...previous, {role:'user',content:message}];
    setMessages(withUser); onMessagesChange(withUser);
    setPrompt(''); setPending(true); setError('');
    const sourceBefore = source;
    const fileBefore = activeFile;
    const fingerprint = sourceFingerprint(sourceBefore);
    try {
      const response = await fetch('/api/ai', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({provider, mode, prompt:message, source:sourceBefore.slice(0,16000), filePath:fileBefore,
          lastLog: mode === 'latex' ? lastLog?.slice(-3500) : undefined,
          history: previous.slice(-4).map(item => ({role:item.role,content:item.content.slice(0,900)}))})
      });
      const body = await response.text();
      let data: unknown;
      try { data = JSON.parse(body) as unknown; }
      catch {
        throw new Error('El servicio de IA devolvió una respuesta no válida (HTTP ' + response.status +
          '). Revisa los registros del servidor; no se aplicó ningún cambio.');
      }
      const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      if (!response.ok) throw new Error(typeof record.error === 'string' ? record.error : 'No se recibió respuesta');
      const edits = sanitizeAITextEdits(record.edits);
      const content = typeof record.content === 'string' ? record.content : 'La IA no devolvió una respuesta válida.';
      const answer: ChatMessage = {role:'assistant',content,
        ...(edits.length ? {edits, filePath:fileBefore, sourceFingerprint:fingerprint} : {})};
      const updated = [...withUser, answer];
      setMessages(updated); onMessagesChange(updated);
      if (edits.length) setPreviewIndex(updated.length - 1);
    } catch(e) {
      setError(e instanceof Error ? e.message : 'Error de conexión');
    } finally { setPending(false); }
  }

  async function applyProposal(index: number, message: ChatMessage) {
    if (!message.edits?.length || !message.filePath || !message.sourceFingerprint ||
        message.applied || applying) return;
    if (!window.confirm(
      '¿Aplicar ' + message.edits.length + ' modificación(es) al archivo ' + message.filePath +
      '? Se comprobarán los fragmentos exactos y se guardará el proyecto en el Dell.'
    )) return;
    setError(''); setApplying(true);
    try {
      await onApplyEdits(message.edits, message.filePath, message.sourceFingerprint);
      const updated = messages.map((item,i) => i === index ? {...item, applied:true} : item);
      setMessages(updated); onMessagesChange(updated);
      setPreviewIndex(null);
    } catch(e) {
      setError(e instanceof Error ? e.message : 'No fue posible aplicar los cambios.');
    } finally { setApplying(false); }
  }

  function discardProposal(index: number) {
    const updated = messages.map((item,i) => i === index ? {...item, discarded: true} : item);
    setMessages(updated);
    onMessagesChange(updated);
    setPreviewIndex(null);
  }
  function latexProposal(content: string): string | null {
    const code = content.match(/```(?:latex|tex)\s*\n([\s\S]*?)```/i)?.[1];
    return code && code.includes('\\documentclass') && code.includes('\\begin{document}') ? code.trim() + '\n' : null;
  }

  return <section className={'assistant-dock ' + (open ? 'assistant-expanded' : '')} aria-label="Asistente de inteligencia artificial">
    {open && <>
      <header className="assistant-title">
        <span><Sparkles size={17}/> Asistente científico</span>
        <div className="ai-agent-tools">
          <label className="ai-mode-label" htmlFor="synapse-agent-mode">Especialidad</label>
          <select id="synapse-agent-mode" className="ai-agent-mode" value={mode}
            onChange={e => setMode(e.target.value as AIAgentMode)} disabled={pending || applying}
            aria-label="Agente de trabajo">
            {AGENT_MODES.map(agent => <option key={agent.id} value={agent.id}>{agent.label}</option>)}
          </select>
          <button className="icon-button" onClick={() => setOpen(false)} aria-label="Contraer asistente"><X size={17}/></button>
        </div>
      </header>
      <div className="assistant-messages">
        {messages.length === 0 && <div className="chat-placeholder">
          <Bot size={25}/><b>Pide cambios a tu documento</b>
          <p>Por ejemplo: «Corrige este párrafo», «Agrega una ecuación» o «Modifica el formato de este archivo». Revisa la propuesta y pulsa Aplicar cambios.</p>
        </div>}
        {messages.map((message,index) => {
          const proposal = message.role === 'assistant' && !message.edits?.length ? latexProposal(message.content) : null;
          const hasEdits = message.role === 'assistant' && Array.isArray(message.edits) && message.edits.length > 0;
          return <div key={index} className={'chat-bubble '+message.role}>
            <span className="chat-role">{message.role === 'assistant' ? 'SYNAPSE' : 'Tú'}</span>
            <div className="chat-content">{message.content}</div>
            {hasEdits && <div className="ai-edit-proposal">
              <div className="ai-edit-header"><b>{message.edits!.length} cambio(s) en {message.filePath || 'el archivo activo'}</b>
                {message.applied ? <span className="ai-edits-applied">Aplicados al servidor · Versión previa en Historial</span> :
                  message.discarded ? <span className="ai-edits-discarded">Propuesta descartada</span> :
                  <button type="button" onClick={() => setPreviewIndex(previewIndex === index ? null : index)}>
                    {previewIndex === index ? 'Ocultar revisión' : 'Revisar cambios'}
                  </button>}
              </div>
              {previewIndex === index && !message.applied && !message.discarded && <>
                {message.edits!.map((edit,i) => <div className="ai-edit-diff" key={i}>
                  <small>Modificación {i+1} · Antes</small><pre>{edit.find}</pre>
                  <small>Después</small><pre>{edit.replace || '(eliminar fragmento)'}</pre>
                </div>)}
                <div className="ai-edit-actions">
                  <button className="apply-button" type="button" disabled={pending || applying}
                    onClick={() => void applyProposal(index,message)}>
                    <CornerUpRight size={14}/>{applying ? 'Aplicando…' : 'Aceptar cambios y guardar'}
                  </button>
                  <button className="ai-reject-button" type="button" disabled={pending || applying}
                    onClick={() => discardProposal(index)}>Descartar</button>
                </div>
                <small className="ai-edit-safety">Antes de aplicar, SYNAPSE guardará una versión previa en Historial. El PDF debe recompilarse.</small>
              </>}
            </div>}
            {proposal && <button className="apply-button" onClick={() => {
              if (window.confirm('¿Reemplazar todo el archivo activo con el código propuesto? Revisa y guarda una versión antes.')) onApply(proposal);
            }}><CornerUpRight size={14}/> Aplicar documento completo</button>}
          </div>;
        })}
        {pending && <p className="muted tiny">El asistente está preparando la respuesta…</p>}
      </div>
      {error && <p role="alert" className="chat-error">{error}</p>}
    </>}
    <div className="assistant-input">
      <button className="icon-button" title="Abrir asistente" onClick={() => setOpen(!open)}><Sparkles size={17}/></button>
      <textarea rows={1} value={prompt} onFocus={() => setOpen(true)} onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => {if(e.key === 'Enter' && !e.shiftKey){e.preventDefault();void send();}}}
        placeholder="Pide una modificación del archivo activo…" aria-label="Mensaje al asistente"/>
      <select value={provider} aria-label="Proveedor de IA" onChange={e => setProvider(e.target.value as Provider)}>
        {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <button className="send-button" aria-label="Enviar consulta" title="Enviar" onClick={() => {setOpen(true); void send();}} disabled={!prompt.trim() || pending || applying}>{pending ? <ChevronDown size={16}/> : <Send size={17}/>}</button>
    </div>
  </section>;
}
