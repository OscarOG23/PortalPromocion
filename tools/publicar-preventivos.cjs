// Herramienta local de despliegue. Usa la sesión existente de clasp sin imprimir tokens.
const fs=require('node:fs'),path=require('node:path');
const {google}=require('../.worktrees/integracion/deploy/node_modules/googleapis');
const root=path.resolve(__dirname,'..');
async function cliente(){
 const cfg=JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE,'.clasprc.json'),'utf8'));
 const t=cfg.tokens?.default?.token||cfg.tokens?.default||cfg.token;
 const s=cfg.tokens?.default?.oauth2ClientSettings||cfg.oauth2ClientSettings;
 const auth=new google.auth.OAuth2(t.client_id||s.clientId,t.client_secret||s.clientSecret,s.redirectUri);auth.setCredentials(t);
 return {script:google.script({version:'v1',auth}),drive:google.drive({version:'v3',auth}),sheets:google.sheets({version:'v4',auth})};
}
async function main(){
 const c=await cliente(),[mode,...args]=process.argv.slice(2);
 if(mode==='inspect'){
  for(const id of args){
   const {data}=await c.script.projects.get({scriptId:id});console.log(JSON.stringify({scriptId:id,title:data.title,parentId:data.parentId}));
   const content=await c.script.projects.getContent({scriptId:id});
   const dir=path.join(root,'.worktrees/integracion/remote-backup',id);fs.mkdirSync(dir,{recursive:true});
   fs.writeFileSync(path.join(dir,'content.json'),JSON.stringify(content.data));
  }
 }else if(mode==='push'){
  const dir=path.resolve(args[1]),files=fs.readdirSync(dir).filter(n=>/\.(gs|html|json)$/.test(n)&&!n.startsWith('.')).map(n=>({name:path.basename(n,path.extname(n)),type:n.endsWith('.gs')?'SERVER_JS':n.endsWith('.html')?'HTML':'JSON',source:fs.readFileSync(path.join(dir,n),'utf8')}));
  if(!files.some(f=>f.name==='appsscript'))throw Error('Falta manifiesto.');
  await c.script.projects.updateContent({scriptId:args[0],requestBody:{files}});console.log(JSON.stringify({scriptId:args[0],files:files.length}));
 }else if(mode==='deploy'){
  const version=(await c.script.projects.versions.create({scriptId:args[0],requestBody:{description:args[2]}})).data.versionNumber;
  const old=(await c.script.projects.deployments.get({scriptId:args[0],deploymentId:args[1]})).data;
  await c.script.projects.deployments.update({scriptId:args[0],deploymentId:args[1],requestBody:{deploymentConfig:{...old.deploymentConfig,versionNumber:version,description:args[2]}}});console.log(JSON.stringify({deploymentId:args[1],version}));
 }else if(mode==='deployments'){
  console.log(JSON.stringify((await c.script.projects.deployments.list({scriptId:args[0]})).data.deployments.map(d=>({id:d.deploymentId,config:d.deploymentConfig}))));
 }else if(mode==='run'||mode==='run-file'){
  const params=mode==='run-file'?JSON.parse(fs.readFileSync(args[2],'utf8')):JSON.parse(args[2]||'[]');
  const {data}=await c.script.scripts.run({scriptId:args[0],requestBody:{function:args[1],parameters:params,devMode:true}});
  if(data.error){console.error(JSON.stringify(data.error));process.exitCode=1;}else console.log(JSON.stringify(data.response?.result));
 }else if(mode==='search'){
  const {data}=await c.drive.files.list({q:args[0],fields:'files(id,name,mimeType,parents),nextPageToken',pageSize:100});console.log(JSON.stringify(data));
 }else if(mode==='private-upload'){
  let folder;
  const {data}=await c.drive.files.list({q:"name = 'Seguimiento preventivo · fuentes privadas' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",fields:'files(id,name)'});
  if(data.files.length>1)throw Error('Carpeta duplicada: seleccionar una ID explícita.');
  folder=data.files[0]?.id;
  if(!folder)folder=(await c.drive.files.create({requestBody:{name:'Seguimiento preventivo · fuentes privadas',mimeType:'application/vnd.google-apps.folder'},fields:'id'})).data.id;
  const uploaded=[];
  for(const file of args){
   const full=path.resolve(file);if(!full.startsWith(path.join(root,'.worktrees/integracion/'))||path.extname(full)!=='.json')throw Error('Sólo agregados JSON de staging.');
   const name=path.basename(full),existing=(await c.drive.files.list({q:`'${folder}' in parents and name = '${name.replace(/'/g,"\\'")}' and trashed = false`,fields:'files(id)'})).data.files;
   if(existing.length>1)throw Error('Archivo duplicado.');
   if(existing.length&&name==='METAS_PREVENTIVAS_2026.json'){
    await c.drive.files.update({fileId:existing[0].id,media:{mimeType:'application/json',body:fs.createReadStream(full)}});uploaded.push({name,id:existing[0].id,actualizado:true});
   }else if(existing.length)uploaded.push({name,id:existing[0].id,existente:true});
   else uploaded.push({name,id:(await c.drive.files.create({requestBody:{name,parents:[folder]},media:{mimeType:'application/json',body:fs.createReadStream(full)},fields:'id'})).data.id});
  }
  console.log(JSON.stringify({folder,uploaded}));
 }else if(mode==='replace-aggregate'){
  const full=path.resolve(args[1]);if(!full.startsWith(path.join(root,'.worktrees/integracion/'))||path.extname(full)!=='.json')throw Error('Sólo agregados JSON de staging.');
  const {data}=await c.drive.files.get({fileId:args[0],fields:'id,name,parents'});
  if(data.name!==path.basename(full))throw Error('El nombre de origen no coincide.');
  await c.drive.files.update({fileId:args[0],media:{mimeType:'application/json',body:fs.createReadStream(full)}});console.log(JSON.stringify({id:data.id,name:data.name,actualizado:true}));
 }else if(mode==='probe'){
  const url=args[0];if(!/^https:\/\/script\.google\.com\/macros\/s\/[-\w]+\/exec$/.test(url))throw Error('URL no admitida.');
  const response=await fetch(url),body=await response.text();console.log(JSON.stringify({status:response.status,json:body.trim().startsWith('{'),contenido:body.slice(0,400)}));
 }else if(mode==='sheets'){
  const {data}=await c.sheets.spreadsheets.get({spreadsheetId:args[0],fields:'spreadsheetId,properties(title),sheets(properties)'});console.log(JSON.stringify(data));
 }else throw Error('Modo desconocido.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
