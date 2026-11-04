'use client';
import { useState } from 'react';
import { Bot, ChevronDown, CornerUpRight, Send, Sparkles, X } from 'lucide-react';
import type { ChatMessage, Provider } from '@/lib/types';

const PROVIDERS: {id: Provider; label:string}[] = [
 {id:'gemini',label:'Gemini'}, {id:'groq',label:'Groq'}, {id:'openrouter',label:'OpenRouter'},
 {id:'sambanova',label:'SambaNova'}, {id:'cerebras',label:'Cerebras'},
 {id:'together',label:'Together'}, {id:'openai',label:'OpenAI'}
];
export function AIChat({ source, onApply }: {source: string; onApply: (text:string)=>void}) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>('gemini');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function send() {
    if (!prompt.trim() || pending) return;
    const message = prompt.trim(); const previous = [...messages];
    setMessages(m => [...m, {role:'user', content:message}]); setPrompt(''); setPending(true); setError('');
    try {
      const response = await fetch('/api/ai', {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({provider, prompt:message, source, history:previous})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se recibió respuesta');
      setMessages(m => [...m, {role:'assistant', content:data.content}]);
    } catch(e) { setError(e instanceof Error ? e.message : 'Error de conexión'); }
    finally { setPending(false); }
  }
  function latexProposal(content: string): string | null {
    const code = content.match(/```(?:latex|tex)\s*\n([\s\S]*?)```/i)?.[1];
    return code && code.includes('\\documentclass') && code.includes('\\begin{document}') ? code.trim() + '\n' : null;
  }
  return <section className={'assistant-dock ' + (open ? 'assistant-expanded' : '')} aria-label="Asistente de inteligencia artificial">
    {open && <>
      <header className="assistant-title"><span><Sparkles size={17}/> Asistente científico</span><button className="icon-button" onClick={() => setOpen(false)} aria-label="Contraer asistente"><X size={17}/></button></header>
      <div className="assistant-messages">
        {messages.length === 0 && <div className="chat-placeholder"><Bot size={25}/><b>Investiga, escribe y revisa</b><p>Pregunta por el documento, pide mejoras o solicita un borrador LaTeX completo.</p></div>}
        {messages.map((message,index) => {
          const proposal = message.role === 'assistant' ? latexProposal(message.content) : null;
          return <div key={index} className={'chat-bubble '+message.role}>
            <span className="chat-role">{message.role === 'assistant' ? 'SYNAPSE' : 'Tú'}</span>
            <div className="chat-content">{message.content}</div>
            {proposal && <button className="apply-button" onClick={() => { if (confirm('¿Reemplazar todo el archivo activo con el código propuesto? Se guardará localmente.')) onApply(proposal); }}><CornerUpRight size={14}/> Aplicar documento completo</button>}
          </div>;
        })}
        {pending && <p className="muted tiny">Generando respuesta…</p>}
      </div>
      {error && <p className="chat-error">{error}</p>}
    </>}
    <div className="assistant-input">
      <button className="icon-button" title="Abrir asistente" onClick={() => setOpen(!open)}><Sparkles size={17}/></button>
      <textarea rows={open ? 2 : 1} value={prompt} onFocus={() => setOpen(true)} onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => {if(e.key === 'Enter' && !e.shiftKey){e.preventDefault();void send();}}}
        placeholder="Pregunta a SYNAPSE sobre tu documento…" aria-label="Mensaje al asistente"/>
      <select value={provider} aria-label="Proveedor de IA" onChange={e => setProvider(e.target.value as Provider)}>
        {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <button className="send-button" aria-label="Enviar consulta" title="Enviar" onClick={() => {setOpen(true); void send();}} disabled={!prompt.trim() || pending}>{pending ? <ChevronDown size={16}/> : <Send size={17}/>}</button>
    </div>
  </section>;
}
