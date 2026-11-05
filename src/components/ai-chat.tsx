'use client';
import { useState } from 'react';
import { Bot, ChevronDown, CornerUpRight, Send, Sparkles, X } from 'lucide-react';
import type { ChatMessage, Provider } from '@/lib/types';
import { sanitizeAITextEdits, sourceFingerprint } from '@/lib/ai-edits';
import { AGENT_MODES, type AIAgentMode } from '@/lib/ai-agents';

const PROVIDERS: {id: Provider; label:string}[] = [
  {id:'groq',label:'Groq'}, {id:'openrouter',label:'OpenRouter'}, {id:'gemini',label:'Gemini'},
  {id:'sambanova',label:'SambaNova'}, {id:'cerebras',label:'Cerebras'},
  {id:'together',label:'Together'}, {id:'openai',label:'OpenAI'}
];
type Props = {
  projectId: string;
  source: string;
  activeFile: string;
  lastLog?: string;
  initialMessages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  onReviewProposal: (index: number, message: ChatMessage) => void;
  reviewingIndex: number | null;
};

export function AIChat({
  projectId, source, activeFile, lastLog, initialMessages, onMessagesChange,
  onReviewProposal, reviewingIndex
}: Props) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>('groq');
  const [mode, setMode] = useState<AIAgentMode>('edit');
  const [prompt, setPrompt] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    if (!prompt.trim() || pending) return;
    const message = prompt.trim();
    const previous = [...initialMessages];
    const withUser: ChatMessage[] = [...previous, {role:'user',content:message}];
    onMessagesChange(withUser);
    setPrompt(''); setPending(true); setError('');
    const sourceBefore = source;
    const fileBefore = activeFile;
    const fingerprint = sourceFingerprint(sourceBefore);
    try {
      const response = await fetch('/api/ai', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          projectId, provider, mode, prompt:message, source:sourceBefore.slice(0,16000), filePath:fileBefore,
          lastLog: mode === 'latex' ? lastLog?.slice(-3500) : undefined,
          history: previous.slice(-4).map(item => ({role:item.role,content:item.content.slice(0,900)}))
        })
      });
      const body = await response.text();
      let data: unknown;
      try { data = JSON.parse(body) as unknown; }
      catch {
        throw new Error('El servicio de IA devolvió una respuesta no válida (HTTP '+response.status+').');
      }
      const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      if (!response.ok) throw new Error(typeof record.error === 'string' ? record.error : 'Error del proveedor');
      const edits = sanitizeAITextEdits(record.edits);
      const content = typeof record.content === 'string' ? record.content : 'No se recibió una respuesta válida.';
      const answer: ChatMessage = {role:'assistant',content,
        ...(edits.length ? {edits, filePath:fileBefore, sourceFingerprint:fingerprint} : {})};
      const updated = [...withUser, answer];
      onMessagesChange(updated);
      if (edits.length) {
        // The review takes place in CodeMirror, not inside a large chat bubble.
        onReviewProposal(updated.length-1, answer);
        setOpen(false);
      }
    } catch(e) {
      setError(e instanceof Error ? e.message : 'Error de conexión');
      setOpen(true);
    } finally {
      setPending(false);
    }
  }

  return <section className={'assistant-dock '+(open ? 'assistant-expanded' : '')}
    aria-label="Asistente de inteligencia artificial">
    {open && <>
      <header className="assistant-title">
        <span><Sparkles size={17}/> Asistente científico</span>
        <div className="ai-agent-tools">
          <label className="ai-mode-label" htmlFor="synapse-agent-mode">Especialidad</label>
          <select id="synapse-agent-mode" className="ai-agent-mode" value={mode}
            onChange={e=>setMode(e.target.value as AIAgentMode)} disabled={pending}
            aria-label="Agente de trabajo">
            {AGENT_MODES.map(agent=><option key={agent.id} value={agent.id}>{agent.label}</option>)}
          </select>
          <button type="button" className="icon-button" onClick={()=>setOpen(false)}
            aria-label="Contraer asistente"><X size={17}/></button>
        </div>
      </header>
      <div className="assistant-messages">
        {initialMessages.length===0 && <div className="chat-placeholder">
          <Bot size={22}/><b>Ediciones de LaTeX</b>
          <p>Describe el cambio. Lo revisarás en las líneas del código con ✓ o ✕.</p>
        </div>}
        {initialMessages.map((message,index) => {
          const hasEdits = message.role==='assistant' && Array.isArray(message.edits) && message.edits.length>0;
          return <div key={index} className={'chat-bubble '+message.role}>
            <span className="chat-role">{message.role==='assistant'?'SYNAPSE':'Tú'}</span>
            <div className="chat-content">{message.content}</div>
            {hasEdits && <div className="ai-edit-summary">
              {message.applied ? <span className="ai-edits-applied">✓ Aplicado y guardado</span>
                : message.discarded ? <span className="ai-edits-discarded">✕ Descartado</span>
                : reviewingIndex===index ? <span className="ai-edit-reviewing">Revisión visible en el editor</span>
                : <button type="button" onClick={()=>onReviewProposal(index,message)}>
                    <CornerUpRight size={14}/> Revisar {message.edits!.length} cambio(s) en código
                  </button>}
            </div>}
          </div>;
        })}
        {pending && <p className="muted tiny">Preparando la propuesta…</p>}
      </div>
      {error && <p role="alert" className="chat-error">{error}</p>}
    </>}
    <div className="assistant-input">
      <button type="button" className="icon-button" title={open?'Contraer asistente':'Abrir asistente'}
        onClick={()=>setOpen(!open)}><Sparkles size={17}/></button>
      <textarea rows={1} value={prompt} onFocus={()=>setOpen(true)}
        onChange={e=>setPrompt(e.target.value)}
        onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}}
        placeholder="Indica qué modificar…" aria-label="Mensaje al asistente"/>
      <select value={provider} aria-label="Proveedor de IA" onChange={e=>setProvider(e.target.value as Provider)}>
        {PROVIDERS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <button type="button" className="send-button" aria-label="Enviar consulta"
        onClick={()=>{setOpen(true);void send();}} disabled={!prompt.trim()||pending}>
        {pending?<ChevronDown size={16}/>:<Send size={17}/>}
      </button>
    </div>
  </section>;
}
