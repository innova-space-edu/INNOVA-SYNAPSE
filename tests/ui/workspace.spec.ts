import {test,expect} from '@playwright/test';
// Minimal two-page PDF, with exact byte offsets and no external font/network dependency.
function samplePdf(){
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>',
  '<< /Length 34 >>\nstream\n0.2 0.3 0.6 rg 40 40 200 200 re f\nendstream'
 ];
 let pdf='%PDF-1.4\n';const offsets=[0];
 objects.forEach((value,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+value+'\nendobj\n';});
 const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('');
 pdf+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';return Buffer.from(pdf).toString('base64');
}
const id='008af793-4264-4050-b0d7-636f5db455fa';
const project={id,name:'Prueba UI',mainFile:'main.tex',createdAt:'2026-11-05T00:00:00Z',updatedAt:'2026-11-05T00:00:00Z',
 files:[{path:'main.tex',content:'\\documentclass{article}\n\\begin{document}\nPrueba\n\\end{document}',encoding:'utf8'}],lastPdf:samplePdf(),lastLog:'Registro anterior',_access:'owner',_revision:'1',_owner:'tester@synapse.test'};
test.beforeEach(async({page})=>{
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/session')return route.fulfill({json:{email:'tester@synapse.test',canCreate:true}});
  if(path==='/api/invitations')return route.fulfill({json:[]});
  if(path==='/api/projects')return route.fulfill({json:[project]});
  if(path.endsWith('/snapshots'))return route.fulfill({status:503,json:{error:'Historial de prueba no disponible'}});
  if(path==='/api/projects/'+id){
   if(route.request().method()==='PUT')return route.fulfill({status:503,json:{error:'Guardado de prueba no disponible'}});
   return route.fulfill({json:project});
  }
  return route.continue();
 });
 await page.goto('/projects/'+id);
 await expect(page.getByRole('button',{name:'Volver a proyectos',exact:true})).toBeVisible();
});
test('zoom changes rendered page geometry, fit and wide view remain usable',async({page})=>{
 const canvas=page.locator('.synapse-pdf-page canvas').first();
 await expect(canvas).toBeVisible();
 const initial=(await canvas.boundingBox())!.width;
 await page.getByRole('button',{name:'Ampliar PDF',exact:true}).click();
 await expect.poll(async()=>Math.round((await canvas.boundingBox())!.width)).toBeCloseTo(Math.round(initial*1.1),-1);
 await page.getByRole('button',{name:'Ajustar PDF al ancho',exact:true}).click();
 await expect.poll(async()=>Math.round((await canvas.boundingBox())!.width)).toBe(Math.round(initial));
 await page.getByTitle('Ampliar vista PDF',{exact:true}).click();
 await expect(canvas).toBeVisible();
 await expect.poll(async()=>(await canvas.boundingBox())!.width).toBeGreaterThan(initial);
 await page.getByTitle('Salir de vista amplia',{exact:true}).click();
 await expect(canvas).toBeVisible();
 await expect.poll(async()=>Math.round((await canvas.boundingBox())!.width)).toBe(Math.round(initial));
});
test('clean project leaves without an unnecessary PUT; history errors are visible',async({page})=>{
 let writes=0;page.on('request',request=>{if(request.method()==='PUT')writes++;});
 await page.getByRole('button',{name:'Historial',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Historial de prueba no disponible'})).toBeVisible();
 await page.getByRole('button',{name:'Volver a proyectos',exact:true}).first().click();
 await expect(page).toHaveURL(/\/$/);expect(writes).toBe(0);
});
test('failed autosave permits leaving with a local copy and recovering after reopening',async({page})=>{
 const editor=page.locator('.cm-content');await editor.click();await editor.press('ControlOrMeta+End');await editor.press('Enter');await editor.pressSequentially('% Cambios pendientes de prueba');
 await expect(page.getByRole('alert').filter({hasText:'Guardado de prueba no disponible'})).toBeVisible({timeout:10000});
 await page.getByRole('button',{name:'Volver a proyectos',exact:true}).first().click();
 const dialog=page.getByRole('dialog',{name:'Volver a proyectos'});await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'Volver con copia local',exact:true}).click();
 await expect(page).toHaveURL(/\/$/);
 await page.goto('/projects/'+id);
 await expect(page.getByRole('button',{name:'Recuperar cambios',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Recuperar cambios',exact:true}).click();
 await expect(page.locator('.cm-content')).toContainText('Cambios pendientes de prueba');
});
test('PDF download produces a PDF file',async({page})=>{
 const download=page.waitForEvent('download');await page.getByTitle('Descargar PDF',{exact:true}).click();
 const result=await download;expect(result.suggestedFilename()).toBe('Prueba_UI.pdf');
 const stream=await result.createReadStream();const chunks=[];for await(const part of stream!)chunks.push(part);
 expect(Buffer.concat(chunks).subarray(0,5).toString()).toBe('%PDF-');
});
