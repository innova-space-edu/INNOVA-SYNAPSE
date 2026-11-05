'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { ArrowLeft, Clock3, ChevronDown, ChevronRight, ChevronsLeft, Download, FileCode2,
  FileText, Folder, FolderOpen, Import, Maximize, MoreHorizontal, PanelLeftClose,
  PanelLeftOpen, Play, Plus, Save, Terminal, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { AIChat } from './ai-chat';
import { loadProject, saveProject, listSnapshots, saveSnapshot } from '@/lib/storage';
import { exportProjectZip, safePath } from '@/lib/zip';
import type { CompileResult, ProjectSnapshot, SynapseFile, SynapseProject } from '@/lib/types';

const latexLanguage = StreamLanguage.define(stex);
const textExt = /\.(tex|bib|sty|cls|bst|txt|keep)$/i;
const allowedExt = /\.(tex|bib|sty|cls|bst|png|jpe?g|pdf|eps|txt|keep)$/i;
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i=0; i<bytes.length; i+=8192) binary += String.fromCharCode(...bytes.slice(i,i+8192));
  return btoa(binary);
}
export function Workspace() {
  const router = useRouter();
  const params = useParams<{id:string}>();
  const uploadRef = useRef<HTMLInputElement>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const [project, setProject] = useState<SynapseProject | null>(null);
  const [activeFile, setActiveFile] = useState('main.tex');
  const [status, setStatus] = useState<'cargando'|'editado'|'guardando'|'guardado'|'error'>('cargando');
  const [compiling, setCompiling] = useState(false);
  const [showTree, setShowTree] = useState(true);
  const [sideTab, setSideTab] = useState<'files'|'chats'>('files');
  const [treeWidth, setTreeWidth] = useState(280);
  const [pdfWidth, setPdfWidth] = useState(43);
  const [expandedFolders, setExpandedFolders] = useState<Record<string,boolean>>({});
  const [showLog, setShowLog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([]);
  const [compileMessage, setCompileMessage] = useState('');
  const [zoom, setZoom] = useState(100);
  const [previewFull, setPreviewFull] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const active = project?.files?.find(f => f.path === activeFile);
  const pdfLink = project?.lastPdf ? 'data:application/pdf;base64,' + project.lastPdf : undefined;
  const folders = useMemo(() => [...new Set((project?.files || []).filter(f => f.path.includes('/')).map(f => f.path.split('/')[0]))].sort(), [project]);

  useEffect(() => {
    let alive = true;
    loadProject(params.id).then(p => {
      if (!alive) return;
      if (!p) { router.replace('/'); return; }
      setProject(p); setActiveFile(p.mainFile); setStatus('guardado');
    }).catch((error: unknown) => {
      if (alive) setWorkspaceError(error instanceof Error ? error.message : 'No fue posible recuperar este proyecto.');
    });
    return () => { alive = false; };
  }, [params.id, router]);

  useEffect(() => {
    if (!project) return;
    const id = window.setTimeout(() => {
      saveQueue.current = saveQueue.current.catch(() => undefined).then(() => saveProject(project));
      void saveQueue.current.then(() => setStatus('guardado')).catch(() => setStatus('error'));
    }, 650);
    return () => window.clearTimeout(id);
  }, [project]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (status === 'editado' || status === 'guardando') { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status]);

  async function exitWorkspace() {
    if (!project) return;
    try {
      await saveQueue.current;
      await saveProject(project);
      router.push('/');
    } catch {
      setStatus('error');
      alert('No se pudo guardar en el servidor. Exporta primero el ZIP y revisa tu conexión.');
    }
  }
    const change = useCallback((update: (old:SynapseProject)=>SynapseProject) => {
    setProject(old => old ? update(old) : old);
    setStatus('editado');
  }, []);
  function updateContent(text:string) {
    change(p => ({...p, files:p.files.map(f => f.path === activeFile ? {...f, content:text} : f)}));
  }
  function createFile() {
    const path = prompt('Nombre o ruta del archivo (ej. capitulos/metodo.tex):')?.trim();
    if (!path) return;
    if (!safePath(path) || !allowedExt.test(path) || !textExt.test(path)) return alert('Ruta o extensión no válida para un archivo nuevo. Puedes importar imágenes.');
    if (project?.files.some(f => f.path === path)) return alert('El archivo ya existe.');
    change(p => ({...p, files:[...p.files,{path,content:'',encoding:'utf8'}]}));
    setActiveFile(path);
  }
  function renameFile(path:string) {
    const name = prompt('Nueva ruta del archivo:',path)?.trim();
    if (!name || name === path) return;
    if (!safePath(name) || !allowedExt.test(name) || !project || project.files.some(f => f.path === name)) return alert('Ruta inválida o repetida.');
    change(p => ({...p,mainFile:p.mainFile===path?name:p.mainFile,files:p.files.map(f=>f.path===path?{...f,path:name}:f)}));
    setActiveFile(name);
  }
  function removeFile(path:string) {
    if (path === project?.mainFile) return alert('No puedes eliminar el archivo principal. Selecciona otro como principal primero.');
    if (!confirm('¿Eliminar '+path+'?')) return;
    change(p => ({...p,files:p.files.filter(f=>f.path!==path)}));
    if (activeFile === path) setActiveFile(project!.mainFile);
  }
  function setMainFile(path:string) {
    if (!path.endsWith('.tex')) return alert('El archivo principal debe ser .tex');
    change(p=>({...p,mainFile:path})); setActiveFile(path);
  }
  async function importAssets(list: FileList | null) {
    if (!list?.length || !project) return;
    const files: SynapseFile[] = [];
    for (const f of Array.from(list)) {
      if (!safePath(f.name) || !allowedExt.test(f.name) || f.size > 5*1024*1024) {
        alert('Archivo omitido (ruta, formato o tamaño no permitido): '+f.name); continue;
      }
      if (project.files.some(existing=>existing.path===f.name)) {
        alert('Archivo duplicado omitido: '+f.name); continue;
      }
      const isText = textExt.test(f.name);
      files.push({path:f.name,content:isText?await f.text():toBase64(await f.arrayBuffer()),encoding:isText?'utf8':'base64'});
    }
    change(p=>({...p,files:[...p.files,...files]}));
  }
  async function openHistory() {
    if (!project) return;
    if (!showHistory) setSnapshots(await listSnapshots(project.id));
    setShowHistory(!showHistory);
  }
  async function captureSnapshot() {
    if (!project) return;
    await saveSnapshot(project);
    setSnapshots(await listSnapshots(project.id));
  }
  function restoreSnapshot(snapshot: ProjectSnapshot) {
    if (!confirm('¿Restaurar esta versión? Guarda antes una instantánea de los cambios actuales.')) return;
    change(p => ({...p, mainFile:snapshot.mainFile, files:structuredClone(snapshot.files)}));
    setActiveFile(snapshot.mainFile); setShowHistory(false);
  }
  async function compile() {
    if (!project || compiling) return;
    setCompiling(true); setCompileMessage('Compilando documento…'); setShowLog(false);
    try {
      await saveProject(project);
      await saveSnapshot(project);
      const response = await fetch('/api/compile',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({mainFile:project.mainFile,files:project.files})});
      const data = await response.json() as CompileResult;
      if (!response.ok || !data.ok || !data.pdf) throw new Error(data.error || 'La compilación falló.' + (data.log? '\n'+data.log:''));
      change(p=>({...p,lastPdf:data.pdf,lastLog:data.log}));
      setCompileMessage('PDF actualizado'); setShowLog(false);
    } catch(e) { setCompileMessage(e instanceof Error?e.message:'Error al compilar'); setShowLog(true); }
    finally { setCompiling(false); }
  }
  function downloadPdf() {
    if (!pdfLink || !project) return;
    const a = document.createElement('a'); a.href = pdfLink; a.download = project.name.replace(/[^a-z0-9_-]/gi,'_')+'.pdf'; a.click();
  }
  function startResize(kind:'tree'|'preview', e:React.MouseEvent<HTMLDivElement>) {
    e.preventDefault(); const startX = e.clientX; const startTree = treeWidth, startPreview = pdfWidth;
    const move = (event:MouseEvent) => {
      if (kind==='tree') setTreeWidth(Math.max(205,Math.min(410,startTree+event.clientX-startX)));
      else setPdfWidth(Math.max(28,Math.min(68,startPreview-(event.clientX-startX)/Math.max(window.innerWidth-startTree,450)*100)));
    };
    const stop = () => { window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',stop); };
    window.addEventListener('mousemove',move); window.addEventListener('mouseup',stop);
  }
  if (!project || !Array.isArray(project.files)) {
    if (!workspaceError && (!project || Array.isArray(project.files))) {
      return <div className="loading-screen">Abriendo espacio de trabajo…</div>;
    }
    return <div className="loading-screen">
      <div style={{ display: 'grid', gap: 16, justifyItems: 'center', maxWidth: 520, textAlign: 'center' }}>
        <p role="alert">{workspaceError || 'El proyecto no tiene una lista válida de archivos; no se modificaron sus datos.'}</p>
        <button className="pill primary" onClick={() => router.push('/')}>Volver a proyectos</button>
      </div>
    </div>;
  }
  return <div className="workspace">
    <header className="work-topbar">
      <div className="work-top-left">
        <button className="work-projects-link" onClick={() => void exitWorkspace()} title="Guardar y volver a proyectos creados" aria-label="Guardar y volver a proyectos creados"><ArrowLeft size={19}/><span>Proyectos</span></button>
        <div className="mini-logo"><Image src="/brand/synapse-symbol.svg" width={20} height={20} alt="INNOVA SYNAPSE" /></div>
        <span className="divider-vertical"/>
        <button className="project-selector" onClick={() => {const n=prompt('Nombre del proyecto:',project.name)?.trim();if(n)change(p=>({...p,name:n}));}}>{project.name}<ChevronDown size={15}/></button>
        <button className="icon-button" onClick={()=>setShowTree(!showTree)} title={showTree?'Ocultar archivos':'Mostrar archivos'}>{showTree?<PanelLeftClose size={17}/>:<PanelLeftOpen size={17}/>}</button>
      </div>
      <div className="work-top-right">
        <span className={'save-indicator '+(status==='error'?'failed':'')}><Save size={14}/>{status==='guardando'?'Guardando…':status==='editado'?'Cambios pendientes':status==='error'?'Error de guardado':'Guardado en servidor'}</span>
        <button className="toolbar-button" onClick={()=>void exportProjectZip(project)}><Download size={16}/> Exportar ZIP</button>
        <button className="toolbar-button" onClick={()=>void openHistory()}><Clock3 size={16}/> Historial</button>
        <button className="toolbar-button" onClick={()=>setShowLog(!showLog)}><Terminal size={16}/> Registro</button>
        <button className="compile-button" onClick={()=>void compile()} disabled={compiling}><Play size={15} fill="currentColor"/>{compiling?'Compilando…':'Compilar PDF'}</button>
      </div>
    </header>
    <div className="work-body">
      {showTree && <aside className="file-panel" style={{width:treeWidth}}>
        <div className="file-panel-heading"><div className="file-tabs"><button className={sideTab==='files'?'selected':''} onClick={()=>setSideTab('files')}>Archivos</button><button className={sideTab==='chats'?'selected':''} onClick={()=>setSideTab('chats')}>Conversaciones</button></div><div>
          <button className="icon-button" onClick={()=>uploadRef.current?.click()} title="Importar archivos"><Import size={16}/></button>
          <button className="icon-button" onClick={createFile} title="Nuevo archivo"><Plus size={16}/></button>
        </div></div>
        <input type="file" ref={uploadRef} multiple hidden onChange={e=>{void importAssets(e.target.files);e.target.value='';}}/>
        {sideTab==='files'?<div className="file-list">
          {folders.map(folder => <div key={folder}>
            <button className="folder-row" onClick={()=>setExpandedFolders(s=>({...s,[folder]:s[folder]===false?true:false}))}>
              {expandedFolders[folder]===false?<ChevronRight size={14}/>:<ChevronDown size={14}/>}
              {expandedFolders[folder]===false?<Folder size={15}/>:<FolderOpen size={15}/>}
              {folder}
            </button>
            {expandedFolders[folder]!==false && project.files.filter(f=>f.path.startsWith(folder+'/')&&!f.path.endsWith('/.keep')).map(f=>renderFile(f,true))}
          </div>)}
          {project.files.filter(f=>!f.path.includes('/')&&!f.path.endsWith('.keep')).map(f=>renderFile(f,false))}
        </div>:<div className="conversation-list"><p>Historial de conversación del proyecto</p>{(project.chats||[]).length===0?<span className="muted tiny">Todavía no hay mensajes. Utiliza el asistente situado debajo del editor.</span>:(project.chats||[]).map((m,i)=><div key={i} className="conversation-snippet"><b>{m.role==='assistant'?'SYNAPSE':'Tú'}</b><span>{m.content.slice(0,180)}</span></div>)}</div>}
        <div className="file-panel-bottom"><b>INNOVA SYNAPSE</b><span>Documentos privados · Dell</span></div>
      </aside>}
      {showTree && <div className="drag-handle" onMouseDown={e=>startResize('tree',e)} title="Redimensionar explorador"/>}
      <main className={'work-panels '+(previewFull?'pdf-full':'')}>
        {!previewFull && <div className="code-panel">
          <div className="code-tab-bar"><div className="code-tab"><FileCode2 size={15}/><span>{activeFile}</span>{activeFile===project.mainFile&&<span className="main-dot" title="Archivo principal"/>}</div><div className="code-tools"><button onClick={()=>setActiveFile(project.mainFile)} title="Ir al principal"><ChevronsLeft size={15}/></button></div></div>
          <div className="editor-container">
            {active?.encoding === 'utf8' ? <CodeMirror value={active.content} height="100%" theme="dark" extensions={[latexLanguage]} onChange={updateContent} basicSetup={{lineNumbers:true,foldGutter:true,highlightActiveLine:true,bracketMatching:true,closeBrackets:true}}/>
              : <div className="binary-preview"><FileText size={35}/><h3>{activeFile}</h3><p>Archivo de recurso binario. Se incluirá en la compilación y exportación ZIP.</p></div>}
          </div>
          <AIChat source={active?.encoding==='utf8'?active.content:''} initialMessages={project.chats || []} onMessagesChange={messages=>change(p=>({...p,chats:messages}))} onApply={updateContent}/>
        </div>}
        {!previewFull && <div className="drag-handle" onMouseDown={e=>startResize('preview',e)} title="Redimensionar PDF"/>}
        <section className="pdf-panel" style={previewFull?{flex:1}:{width:pdfWidth+'%'}}>
          <div className="pdf-toolbar">
            <div className="pdf-left"><FileText size={17}/><b>Vista PDF</b><span className="muted tiny">{project.lastPdf?'Compilación disponible':'Sin compilar'}</span></div>
            <div className="pdf-controls">
              <button className="icon-button" title="Reducir" onClick={()=>setZoom(z=>Math.max(60,z-10))}><ZoomOut size={17}/></button>
              <span className="zoom-label">{zoom}%</span>
              <button className="icon-button" title="Ampliar" onClick={()=>setZoom(z=>Math.min(160,z+10))}><ZoomIn size={17}/></button>
              <button className="icon-button" title={previewFull?'Salir de vista amplia':'Ampliar vista PDF'} onClick={()=>setPreviewFull(!previewFull)}><Maximize size={16}/></button>
              <button className="icon-button" title="Descargar PDF" onClick={downloadPdf} disabled={!pdfLink}><Download size={17}/></button>
            </div>
          </div>
          <div className="pdf-surface">
            {pdfLink ? <div className="pdf-zoom-wrapper"><iframe title="Vista previa de documento PDF" className="pdf-iframe" src={pdfLink+'#toolbar=0&navpanes=0'} style={{width:zoom+'%', height:zoom+'%', minWidth:'100%',minHeight:'100%'}}/></div>
            : <div className="pdf-placeholder"><div className="blank-document"><div className="paper-head"/><div className="paper-line"/><div className="paper-line short"/><div className="paper-heading"/><div className="paper-line"/><div className="paper-line"/></div><h3>Vista previa del documento</h3><p>Presiona <b>Compilar PDF</b> para visualizar tu investigación.</p><button className="pill primary" disabled={compiling} onClick={()=>void compile()}><Play size={15}/> Compilar ahora</button></div>}
          </div>
          {(compileMessage || project.lastLog) && <div className="pdf-status"><span>{compileMessage || 'Compilación anterior'}</span><button onClick={()=>setShowLog(!showLog)}>{showLog?'Ocultar registro':'Ver registro'}</button></div>}
          {showLog && <div className="compile-log"><div><b>Registro de compilación</b><button className="icon-button" onClick={()=>setShowLog(false)}><X size={15}/></button></div><pre>{compileMessage + '\n\n' + (project.lastLog || 'Sin registro de compilación anterior.')}</pre></div>}
        </section>
      </main>
      {showHistory && <aside className="history-drawer">
        <header><b><Clock3 size={16}/> Versiones locales</b><button className="icon-button" onClick={()=>setShowHistory(false)} aria-label="Cerrar historial"><X size={17}/></button></header>
        <p>Hasta 20 instantáneas por proyecto. Al compilar se guarda una versión de las fuentes.</p>
        <button className="pill primary" onClick={()=>void captureSnapshot()}><Plus size={15}/> Guardar instantánea</button>
        <div className="history-items">{snapshots.map(snapshot=><div key={snapshot.id} className="history-item">
          <span><b>{new Date(snapshot.createdAt).toLocaleString('es-CL')}</b><small>{snapshot.files.length} archivos</small></span>
          <button onClick={()=>restoreSnapshot(snapshot)}>Restaurar</button>
        </div>)}{snapshots.length===0&&<p>Aún no hay instantáneas.</p>}</div>
      </aside>}
    </div>
  </div>;

  function renderFile(f:SynapseFile,nested:boolean) {
    return <div key={f.path} className={'file-row '+(f.path===activeFile?'file-active':'')+(nested?' nested':'')}>
      <button className="file-open" onClick={()=>setActiveFile(f.path)} title={f.path}><FileText size={15}/><span>{nested?f.path.split('/').slice(1).join('/'):f.path}</span></button>
      <details className="file-more"><summary title="Acciones de archivo"><MoreHorizontal size={14}/></summary><div className="menu-popover"><button onClick={()=>renameFile(f.path)}>Renombrar</button>{f.path.endsWith('.tex')&&<button onClick={()=>setMainFile(f.path)}>Establecer principal</button>}<button className="danger" onClick={()=>removeFile(f.path)}><Trash2 size={13}/> Eliminar</button></div></details>
    </div>;
  }
}
