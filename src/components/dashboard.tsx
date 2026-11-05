'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { BookOpenText, ChevronDown, FilePlus2, FileText, FolderOpen, Grid2X2, Import, LayoutList, MoreHorizontal, Plus, Search, Users, X } from 'lucide-react';
import type { SynapseProject } from '@/lib/types';
import { deleteProject, listProjects, saveProject } from '@/lib/storage';
import { newProject } from '@/lib/templates';
import { importProjectZip } from '@/lib/zip';
import { inspectProjectList } from '@/lib/project-list';

function reportError(action: string, error: unknown) {
  const detail = error instanceof Error ? error.message : 'Error desconocido';
  return `${action}: ${detail}`;
}

export function Dashboard() {
  const router = useRouter();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<SynapseProject[]>([]);
  const [filter, setFilter] = useState('');
  const [section, setSection] = useState<'all'|'mine'|'shared'>('all');
  const [grid, setGrid] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [incompleteCount, setIncompleteCount] = useState(0);
  const refresh = async () => {
    try {
      const result = inspectProjectList(await listProjects());
      setProjects(result.projects);
      setIncompleteCount(result.incompleteCount);
      setError('');
    } catch (err) {
      setError(reportError('No fue posible consultar los proyectos del servidor', err));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    let alive = true;
    void listProjects().then(raw => {
      if (!alive) return;
      const result = inspectProjectList(raw);
      setProjects(result.projects);
      setIncompleteCount(result.incompleteCount);
    }).catch(err => {
      if (alive) setError(reportError('No fue posible consultar los proyectos del servidor', err));
    }).finally(() => {
      if (alive) setBusy(false);
    });
    return () => { alive = false; };
  }, []);
  async function create() {
    if (creating) return;
    setCreating(true); setError('');
    try {
      const project = newProject('Proyecto sin título');
      await saveProject(project);
      router.push('/projects/' + project.id);
    } catch (err) {
      setError(reportError('No fue posible crear el proyecto', err));
    } finally { setCreating(false); }
  }
  async function duplicate(project: SynapseProject) {
    const copy = { ...project, id: crypto.randomUUID(), name: project.name + ' (copia)', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    try { await saveProject(copy); await refresh(); }
    catch (err) { setError(reportError('No fue posible duplicar el proyecto', err)); }
  }
  async function remove(project: SynapseProject) {
    if (!confirm('¿Eliminar "' + project.name + '"? Exporta antes una copia ZIP.')) return;
    try { await deleteProject(project.id); await refresh(); }
    catch (err) { setError(reportError('No fue posible eliminar el proyecto', err)); }
  }
  async function rename(project: SynapseProject) {
    const name = prompt('Nuevo nombre del proyecto:', project.name)?.trim();
    if (!name) return;
    try { await saveProject({ ...project, name }); await refresh(); }
    catch (err) { setError(reportError('No fue posible renombrar el proyecto', err)); }
  }
  async function upload(file?: File) {
    if (!file) return;
    setError('');
    try { const project = await importProjectZip(file); await saveProject(project); router.push('/projects/' + project.id); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al importar ZIP'); }
  }
  const shown = projects.filter(p => typeof p?.name === 'string' && p.name.toLowerCase().includes(filter.toLowerCase()) && section !== 'shared');
  return (
    <div className="shell">
      <aside className="home-sidebar">
        <div className="brand"><div className="brand-mark"><Image src="/brand/synapse-symbol.svg" alt="Símbolo de INNOVA SYNAPSE" width={23} height={23} priority /></div><span>INNOVA <b>SYNAPSE</b></span></div>
        <nav className="home-nav" aria-label="Biblioteca">
          <button className={section === 'all' ? 'nav-active' : ''} onClick={() => setSection('all')}><FolderOpen size={17}/> Todos los proyectos</button>
          <button className={section === 'mine' ? 'nav-active' : ''} onClick={() => setSection('mine')}><BookOpenText size={17}/> Tus proyectos</button>
          <button className={section === 'shared' ? 'nav-active' : ''} onClick={() => setSection('shared')}><Users size={17}/> Compartido contigo <span className="soon">Próx.</span></button>
        </nav>
        <div className="sidebar-footer"><div className="avatar">I</div><div>Espacio personal <small>Almacenamiento privado en Dell</small></div></div>
      </aside>
      <main className="home-main">
        <header className="home-header">
          <div><h1>{section === 'shared' ? 'Compartido contigo' : section === 'mine' ? 'Tus proyectos' : 'Todos los proyectos'}</h1><p className="muted tiny">Espacio de trabajo científico</p></div>
          <div className="header-actions">
            <label className="search"><Search size={18}/><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar proyectos" aria-label="Buscar proyectos"/></label>
            <div className="view-switch"><button title="Vista lista" aria-label="Vista lista" className={!grid ? 'chosen':''} onClick={() => setGrid(false)}><LayoutList size={17}/></button><button title="Vista cuadrícula" aria-label="Vista cuadrícula" className={grid ? 'chosen':''} onClick={() => setGrid(true)}><Grid2X2 size={17}/></button></div>
            <button className="pill secondary" onClick={() => uploadRef.current?.click()}><Import size={16}/> Importar <ChevronDown size={14}/></button>
            <button className="pill primary" onClick={create} disabled={creating}><Plus size={17}/> {creating ? "Creando…" : "Nuevo"} <ChevronDown size={14}/></button>
          </div>
        </header>
        <input ref={uploadRef} type="file" accept=".zip,application/zip" hidden onChange={e => {void upload(e.target.files?.[0]); e.target.value = '';}}/>
        {error && <div className="error-bar" role="alert">{error}<button onClick={() => setError('')} aria-label="Cerrar error"><X size={16}/></button></div>}
        {incompleteCount > 0 && <div className="error-bar" role="alert">
          {incompleteCount} {incompleteCount === 1 ? 'registro de proyecto está incompleto' : 'registros de proyectos están incompletos'} y no {incompleteCount === 1 ? 'se muestra' : 'se muestran'} para evitar errores. Permanecen guardados en PostgreSQL; SYNAPSE no los modificó ni eliminó.
        </div>}
        {busy ? <div className="blank">Cargando proyectos…</div> : section === 'shared' ? <div className="empty-state"><Users size={40}/><h2>Colaboración en preparación</h2><p>Los espacios compartidos requerirán autenticación, permisos y sincronización en el servidor.</p></div>
        : shown.length === 0 ? <div className="empty-state"><FilePlus2 size={43}/><h2>{filter ? 'No hay coincidencias' : 'Comienza tu próxima investigación'}</h2><p>{filter ? 'Prueba otra búsqueda.' : 'Crea un proyecto LaTeX o importa un ZIP exportado de Prism.'}</p>{!filter && <button className="pill primary" onClick={create} disabled={creating}><Plus size={17}/> {creating ? "Creando…" : "Crear proyecto"}</button>}</div>
        : <div className={grid ? 'project-grid' : 'project-list'}>
            {!grid && <div className="list-heading"><span>Nombre</span><span>Actualizado</span></div>}
            {shown.map(project => <div key={project.id} className="project-row" role="group">
              <button className="project-open" onClick={() => router.push('/projects/'+project.id)} aria-label={'Abrir '+project.name}>
                <div className="page-thumb"><FileText size={22}/></div>
                <div className="project-name"><b>{project.name}</b><small>{project.files.length} archivos</small></div>
              </button>
              <span className="project-date">{new Date(project.updatedAt).toLocaleDateString('es-CL')}</span>
              <details className="context-menu"><summary aria-label={'Opciones de '+project.name}><MoreHorizontal size={20}/></summary><div className="menu-popover"><button onClick={() => rename(project)}>Renombrar</button><button onClick={() => duplicate(project)}>Duplicar</button><button className="danger" onClick={() => remove(project)}>Eliminar</button></div></details>
            </div>)}
          </div>}
      </main>
    </div>
  );
}
