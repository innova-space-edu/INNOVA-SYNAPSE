'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { BookOpenText, ChevronDown, FilePlus2, FileText, FolderOpen, Grid2X2, Import, LayoutList, MoreHorizontal, Plus, Search, Users, AlertTriangle, X } from 'lucide-react';
import type { SynapseProject } from '@/lib/types';
import { deleteProject, deleteLegacyProject, loadLegacyProject, listProjects, saveProject } from '@/lib/storage';
import { newProject } from '@/lib/templates';
import { exportProjectZip, importProjectZip } from '@/lib/zip';
import { inspectProjectList, type PendingProject } from '@/lib/project-list';

function reportError(action: string, error: unknown) {
  const detail = error instanceof Error ? error.message : 'Error desconocido';
  return `${action}: ${detail}`;
}

export function Dashboard() {
  const router = useRouter();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<SynapseProject[]>([]);
  const [filter, setFilter] = useState('');
  const [section, setSection] = useState<'all'|'mine'|'recovery'|'shared'>('all');
  const [grid, setGrid] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [incompleteCount, setIncompleteCount] = useState(0);
  const [pending, setPending] = useState<PendingProject[]>([]);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const refresh = async () => {
    try {
      const result = inspectProjectList(await listProjects());
      setProjects(result.projects);
      setIncompleteCount(result.incompleteCount);
      setPending(result.pending);
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
      setPending(result.pending);
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
  async function recoverLegacy(item: PendingProject) {
    if (!item.id || !item.doubleEncoded || pendingActionId) return;
    setPendingActionId(item.id); setError('');
    try {
      // Explicitly create a NEW project. Never alter the legacy source.
      const legacy = await loadLegacyProject(item.id);
      const now = new Date().toISOString();
      const recovered: SynapseProject = {
        ...legacy,
        id: crypto.randomUUID(),
        name: (legacy.name + ' (recuperado)').slice(0, 200),
        createdAt: now,
        updatedAt: now
      };
      await saveProject(recovered);
      await refresh();
      router.push('/projects/' + recovered.id);
    } catch (err) {
      setError(reportError('No fue posible recuperar una copia del proyecto', err));
    } finally {
      setPendingActionId(null);
    }
  }
  async function downloadLegacy(item: PendingProject) {
    if (!item.id || !item.doubleEncoded || pendingActionId) return;
    setPendingActionId(item.id); setError('');
    try {
      await exportProjectZip(await loadLegacyProject(item.id));
    } catch (err) {
      setError(reportError('No fue posible exportar el proyecto antiguo', err));
    } finally {
      setPendingActionId(null);
    }
  }
  async function removeLegacy(item: PendingProject) {
    if (!item.id || !item.doubleEncoded || pendingActionId) return;
    const accepted = window.prompt(
      'Vas a eliminar permanentemente "' + item.name + '" y sus instantáneas. ' +
      'Esta operación no tiene opción de deshacer. Exporta un ZIP o guarda un respaldo antes. ' +
      'Escribe el identificador COMPLETO para confirmar:\n' + item.id
    );
    if (accepted !== item.id) return;
    setPendingActionId(item.id); setError('');
    try {
      await deleteLegacyProject(item.id);
      await refresh();
    } catch (err) {
      setError(reportError('No fue posible eliminar el registro antiguo', err));
    } finally {
      setPendingActionId(null);
    }
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
  const shown = projects.filter(p => typeof p?.name === 'string' && p.name.toLowerCase().includes(filter.toLowerCase()) && section !== 'shared' && section !== 'recovery');
  return (
    <div className="shell">
      <aside className="home-sidebar">
        <div className="brand"><div className="brand-mark"><Image src="/brand/synapse-symbol.svg" alt="Símbolo de INNOVA SYNAPSE" width={23} height={23} priority /></div><span>INNOVA <b>SYNAPSE</b></span></div>
        <nav className="home-nav" aria-label="Biblioteca">
          <button className={section === 'all' ? 'nav-active' : ''} onClick={() => setSection('all')}><FolderOpen size={17}/> Todos los proyectos</button>
          <button className={section === 'mine' ? 'nav-active' : ''} onClick={() => setSection('mine')}><BookOpenText size={17}/> Proyectos creados <span className="nav-count">{projects.length}</span></button>
          <button className={section === 'recovery' ? 'nav-active' : ''} onClick={() => setSection('recovery')}><AlertTriangle size={17}/> Por recuperar <span className="nav-count">{incompleteCount}</span></button>
          <button className={section === 'shared' ? 'nav-active' : ''} onClick={() => setSection('shared')}><Users size={17}/> Compartido contigo <span className="soon">Próx.</span></button>
        </nav>
        <div className="sidebar-footer"><div className="avatar">I</div><div>Espacio personal <small>Almacenamiento privado en Dell</small></div></div>
      </aside>
      <main className="home-main">
        <header className="home-header">
          <div><h1>{section === 'shared' ? 'Compartido contigo' : section === 'mine' ? 'Proyectos creados' : section === 'recovery' ? 'Proyectos por recuperar' : 'Todos los proyectos'}</h1><p className="muted tiny">Espacio de trabajo científico</p></div>
          <div className="header-actions">
            <label className="search"><Search size={18}/><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar proyectos" aria-label="Buscar proyectos"/></label>
            <div className="view-switch"><button title="Vista lista" aria-label="Vista lista" className={!grid ? 'chosen':''} onClick={() => setGrid(false)}><LayoutList size={17}/></button><button title="Vista cuadrícula" aria-label="Vista cuadrícula" className={grid ? 'chosen':''} onClick={() => setGrid(true)}><Grid2X2 size={17}/></button></div>
            <button className="pill secondary" onClick={() => uploadRef.current?.click()}><Import size={16}/> Importar <ChevronDown size={14}/></button>
            <button className="pill primary" onClick={create} disabled={creating}><Plus size={17}/> {creating ? "Creando…" : "Nuevo"} <ChevronDown size={14}/></button>
          </div>
        </header>
        <input ref={uploadRef} type="file" accept=".zip,application/zip" hidden onChange={e => {void upload(e.target.files?.[0]); e.target.value = '';}}/>
        {error && <div className="error-bar" role="alert">{error}<button onClick={() => setError('')} aria-label="Cerrar error"><X size={16}/></button></div>}
        {incompleteCount > 0 && section !== 'recovery' && <div className="recovery-notice" role="status">
          <AlertTriangle size={16}/>
          <span>{incompleteCount} {incompleteCount === 1 ? 'proyecto anterior requiere' : 'proyectos anteriores requieren'} recuperación de formato. Sus datos no se eliminaron.</span>
          <button type="button" onClick={() => setSection('recovery')}>Ver pendientes</button>
        </div>}
        {busy ? <div className="blank">Cargando proyectos…</div> : section === 'recovery' ? <section className="recovery-section">
          <h2>Registros pendientes de recuperación</h2>
          <p>Estos registros conservan sus archivos, pero tienen un formato anterior. Puedes recuperar una copia nueva o descargar su ZIP antes de decidir si eliminas el original.</p>
          {pending.length === 0 ? <p>No hay registros pendientes. Los proyectos disponibles aparecen en <button type="button" className="recovery-link" onClick={() => setSection('mine')}>Proyectos creados</button>.</p>
          : <div className="project-list">
              {pending.map(item => <div key={item.key} className="project-row">
                <div className="page-thumb"><FileText size={22}/></div>
                <div className="project-name recovery-project-name">
                  <b>{item.name}</b>
                  <small>{item.fileCount === undefined ? 'Cantidad de archivos desconocida' : item.fileCount + ' archivos'}{item.id ? ' · ' + item.id : ''}</small>
                </div>
                <span className="recovery-state">{item.doubleEncoded ? 'JSONB anterior' : 'Revisión requerida'}</span>
                {item.doubleEncoded && item.id && <div className="recovery-actions">
                  <button type="button" onClick={() => void recoverLegacy(item)} disabled={pendingActionId !== null}>
                    {pendingActionId === item.id ? 'Procesando…' : 'Recuperar copia'}
                  </button>
                  <button type="button" onClick={() => void downloadLegacy(item)} disabled={pendingActionId !== null}>
                    Exportar ZIP
                  </button>
                  <button type="button" className="danger" onClick={() => void removeLegacy(item)} disabled={pendingActionId !== null}>
                    Eliminar
                  </button>
                </div>}
              </div>)}
            </div>}
          {pending.length > 0 && <div className="recovery-guidance">
            Para recuperar los proyectos, un administrador debe ejecutar en el Dell el procedimiento que realiza un respaldo verificado antes de modificar la base de datos.
            <code>bash scripts/repair-jsonb.sh --check</code>
            <code>bash scripts/repair-jsonb.sh --apply</code>
            Si no puedes recuperar una copia desde el navegador, usa estos comandos en el Dell. La migración requiere un respaldo completo previo. Eliminar un registro antiguo también elimina sus instantáneas.
          </div>}
        </section> : section === 'shared' ? <div className="empty-state"><Users size={40}/><h2>Colaboración en preparación</h2><p>Los espacios compartidos requerirán autenticación, permisos y sincronización en el servidor.</p></div>
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
