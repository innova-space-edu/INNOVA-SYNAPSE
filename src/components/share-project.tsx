'use client';
import { useEffect, useRef, useState } from 'react';
type Member={id:string;email:string;role:'reader'|'editor';status:string;expires_at:string};
async function request(path:string,options?:RequestInit){
 const response=await fetch(path,{...options,cache:'no-store',headers:{'Content-Type':'application/json',...options?.headers}});
 const data=await response.json();
 if(!response.ok) throw new Error(data.error || 'No se pudo completar la operación.');
 return data;
}
export function ShareProject({id,name,onClose}:{id:string;name:string;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [openedAt]=useState(()=>Date.now());
 const [members,setMembers]=useState<Member[]>([]);
 const [email,setEmail]=useState('');
 const [role,setRole]=useState<'reader'|'editor'>('editor');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const endpoint='/api/projects/'+encodeURIComponent(id)+'/sharing';
 useEffect(()=>{
  const element=dialog.current;
  element?.showModal();
  let alive=true;
  void request(endpoint).then(data=>{if(alive)setMembers(data.members);}).catch(e=>{if(alive)setError(e.message);});
  return ()=>{alive=false;element?.close();};
 },[endpoint]);
 async function invite(address:string,permission:'reader'|'editor'){
  if(busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const data=await request(endpoint,{method:'POST',body:JSON.stringify({email:address,role:permission})});
   setMembers((await request(endpoint)).members);setEmail('');
   setNotice(!data.pending?'Permiso actualizado.':data.mailStatus==='sent'
    ?'Invitación registrada y correo enviado.'
    :data.mailStatus==='failed'?'Invitación registrada. El correo no pudo enviarse; copia el enlace y compártelo.'
    :'Invitación registrada. Copia el enlace y compártelo; el envío de correo aún no está configurado.');
  }catch(e){setError(e instanceof Error?e.message:'Error al invitar');}finally{setBusy(false);}
 }
 async function revoke(member:Member){
  if(busy || !window.confirm('¿Retirar el acceso de '+member.email+'?'))return;
  setBusy(true);setError('');
  try{await request(endpoint+'?member='+member.id,{method:'DELETE'});setMembers(current=>current.filter(m=>m.id!==member.id));}
  catch(e){setError(e instanceof Error?e.message:'Error al retirar acceso');}finally{setBusy(false);}
 }
 return <dialog ref={dialog} className="share-dialog" aria-labelledby="share-title" onCancel={onClose} onClose={onClose}>
  <header><h2 id="share-title">Compartir «{name}»</h2><button type="button" onClick={onClose} aria-label="Cerrar">✕</button></header>
  <form onSubmit={e=>{e.preventDefault();void invite(email,role);}}>
   <label htmlFor="invite-email">Invitar por correo</label>
   <div className="share-invite"><input id="invite-email" type="email" required maxLength={254} placeholder="nombre@correo.cl"
    value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/>
    <select aria-label="Permiso de la invitación" value={role} onChange={e=>setRole(e.target.value as 'reader'|'editor')} disabled={busy}>
     <option value="editor">Editor</option><option value="reader">Lector</option>
    </select><button type="submit" disabled={busy}>{busy?'Procesando…':'Invitar'}</button></div>
  </form>
  {error&&<p role="alert" className="share-error">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  <h3>Personas con acceso</h3><p className="muted tiny">Tú · Propietario. Las invitaciones pendientes vencen a los 7 días.</p>
  <ul className="share-members">{members.map(member=><li key={member.id}>
   <span>{member.email}<small>{member.status==='accepted'?'Acceso aceptado':new Date(member.expires_at).getTime()<openedAt?'Invitación vencida':'Invitación pendiente'}</small></span>
   <select aria-label={'Permiso de '+member.email} value={member.role} disabled={busy}
    onChange={e=>void invite(member.email,e.target.value as 'reader'|'editor')}>
    <option value="editor">Editor</option><option value="reader">Lector</option>
   </select><button type="button" disabled={busy} onClick={()=>void revoke(member)}>Retirar</button>
  </li>)}</ul>
  <h3>Acceso general</h3><p>🔒 Solo usuarios invitados</p>
  <p className="muted tiny">El enlace requiere iniciar sesión con el correo invitado y aceptar la invitación. Los editores pueden modificar archivos y compilar; los lectores pueden consultar y descargar.</p>
  <footer><button type="button" onClick={()=>void navigator.clipboard.writeText(window.location.origin+'/projects/'+id)
   .then(()=>setNotice('Enlace copiado. Solo podrán acceder las personas invitadas.')).catch(()=>setError('No se pudo copiar el enlace.'))}>Copiar enlace</button>
   <button type="button" onClick={onClose}>Listo</button></footer>
 </dialog>;
}
