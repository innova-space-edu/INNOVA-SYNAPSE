'use client';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask, TextLayer } from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';

type Library = typeof import('pdfjs-dist');
/** Render the document itself, rather than resizing a native browser PDF iframe. */
export function PdfPreview({blob,zoom}:{blob:Blob;zoom:number}) {
  const root=useRef<HTMLDivElement>(null);
  const [width,setWidth]=useState(600);
  const [loaded,setLoaded]=useState<{blob:Blob;pdf:PDFDocumentProxy;library:Library}|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    const surface=root.current?.closest('.pdf-surface');
    if(!surface)return;
    const measure=()=>setWidth(Math.max(100,surface.clientWidth-32));
    const observer=new ResizeObserver(measure);
    observer.observe(surface);measure();
    return ()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    let cancelled=false;
    let task:ReturnType<Library['getDocument']>|undefined;
    void (async()=>{
      const library=await import('pdfjs-dist');
      if(cancelled)return;
      library.GlobalWorkerOptions.workerSrc='/pdfjs/pdf.worker.min.mjs';
      const bytes=new Uint8Array(await blob.arrayBuffer());
      if(cancelled)return;
      task=library.getDocument({data:bytes,cMapUrl:'/pdfjs/cmaps/',cMapPacked:true,
        standardFontDataUrl:'/pdfjs/standard_fonts/',wasmUrl:'/pdfjs/wasm/'});
      const pdf=await task.promise;
      if(cancelled)return;
      setLoaded({blob,pdf,library});setError('');
    })().catch(()=>{if(!cancelled)setError('No se pudo mostrar el PDF. Puedes abrirlo en otra pestaña o descargarlo.');});
    return ()=>{cancelled=true;void task?.destroy();};
  },[blob]);
  const document=loaded?.blob===blob?loaded:null;
  return <div ref={root} className="synapse-pdf-viewer" aria-label="Vista previa de documento PDF">
    {error?<p role="alert">{error}</p>:!document?<p role="status">Cargando PDF…</p>:
      <div className="synapse-pdf-pages">{Array.from({length:document.pdf.numPages},(_,i)=><PdfPage key={i}
        pdf={document.pdf} library={document.library} pageNumber={i+1} width={width} zoom={zoom}/>)}</div>}
  </div>;
}
function PdfPage({pdf,library,pageNumber,width,zoom}:{pdf:PDFDocumentProxy;library:Library;pageNumber:number;width:number;zoom:number}) {
  const root=useRef<HTMLDivElement>(null);
  const content=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState(false);
  const [ratio,setRatio]=useState(Math.SQRT2);
  const [error,setError]=useState('');
  const targetWidth=Math.round(width*zoom/100);
  useEffect(()=>{
    const element=root.current;
    if(!element)return;
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}
    },{root:element.closest('.pdf-surface'),rootMargin:'600px'});
    observer.observe(element);
    return ()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!visible)return;
    let cancelled=false;
    let rendering:RenderTask|undefined;
    let text:TextLayer|undefined;
    void (async()=>{
      const page=await pdf.getPage(pageNumber);
      if(cancelled)return;
      const base=page.getViewport({scale:1});
      const scale=targetWidth/base.width;
      const viewport=page.getViewport({scale});
      setRatio(viewport.height/viewport.width);
      // Each render uses a fresh canvas; fast repeated zoom cancels the old task.
      const canvas=document.createElement('canvas');
      const density=Math.min(window.devicePixelRatio || 1,2);
      canvas.width=Math.ceil(viewport.width*density);
      canvas.height=Math.ceil(viewport.height*density);
      canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
      canvas.setAttribute('aria-label','Página '+pageNumber);
      rendering=page.render({canvas,viewport,transform:density===1?undefined:[density,0,0,density,0,0]});
      await rendering.promise;
      if(cancelled || !content.current)return;
      const layer=document.createElement('div');
      layer.className='textLayer';
      layer.style.setProperty('--total-scale-factor',String(scale));
      layer.style.setProperty('--scale-round-x','1px');layer.style.setProperty('--scale-round-y','1px');
      content.current.replaceChildren(canvas,layer);
      text=new library.TextLayer({textContentSource:page.streamTextContent(),container:layer,viewport});
      await text.render();
      if(!cancelled)setError('');
    })().catch(()=>{if(!cancelled)setError('No se pudo mostrar la página '+pageNumber+'.');});
    return ()=>{cancelled=true;rendering?.cancel();text?.cancel();};
  },[pdf,library,pageNumber,targetWidth,visible]);
  return <div ref={root} className="synapse-pdf-page" data-page-number={pageNumber}
    style={{width:targetWidth,height:Math.round(targetWidth*ratio)}}>
    <div ref={content}/>{error&&<p role="alert">{error}</p>}
  </div>;
}
