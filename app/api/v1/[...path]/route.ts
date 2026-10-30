import { env } from 'cloudflare:workers';
export const dynamic = 'force-dynamic';
type Row = {id:string;owner_id:string;document:string;version:number;published:number;created_at:string;updated_at:string};
const json=(data:unknown,status=200,extra={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...extra}});
const publicHeaders={'Access-Control-Allow-Origin':'*'};
const publicJson=(data:unknown,status=200)=>json(data,status,publicHeaders);
const error=(message:string,status=400)=>json({error:message},status);
const fields=['destination','question','specifics','team','members','proposalNote','reflection'];
const journalFields=['observations','challenges','response','photoNote'];
function normalize(input:any){
 if(!input||typeof input!=='object'||!input.fields||!input.journals)throw new Error('Invalid project document.');
 const days=Number(input.days);if(!Number.isInteger(days)||days<1||days>30)throw new Error('Trip duration must be between 1 and 30 days.');
 const trim=(v:unknown)=>{if(v===undefined||v===null)return '';if(typeof v!=='string'||v.length>12000)throw new Error('Each text field must contain at most 12,000 characters.');return v};
 const out:any={fields:{},days,selectedDay:Math.min(days,Math.max(1,Number(input.selectedDay)||1)),journals:{},submitted:[false,false,false,false],shareWithLibrary:input.shareWithLibrary===true};
 for(const key of fields)out.fields[key]=trim(input.fields[key]);
 for(const [d,j] of Object.entries(input.journals) as [string,any][]){if(!/^\d+$/.test(d)||Number(d)<1||Number(d)>30)throw new Error('Invalid journal day.');out.journals[d]={submitted:j?.submitted===true};for(const k of journalFields)out.journals[d][k]=trim(j?.[k]);if(out.journals[d].submitted&&!out.journals[d].observations.trim())throw new Error('A submitted journal needs daily discoveries.');}
 if(!Array.isArray(input.submitted)||input.submitted.length!==4)throw new Error('Invalid submission status.');
 out.submitted=input.submitted.map((v:any)=>v===true);
 if(out.submitted[0]&&['destination','question','team','members'].some(k=>!out.fields[k].trim()))throw new Error('Complete the required idea fields before submitting.');
 return out;
}
async function own(uid:string){return await env.DB!.prepare('SELECT * FROM projects WHERE owner_id = ?').bind(uid).first<Row>()}
function projectDto(row:Row){return {id:row.id,document:JSON.parse(row.document),version:row.version,published:row.published===1,updatedAt:row.updated_at}}
function fileDto(f:any){return {id:f.id,kind:f.kind,day:f.day,name:f.name,type:f.type,size:f.size,url:'/api/v1/files/'+f.id,createdAt:f.created_at}}
function story(row:Row){const d=JSON.parse(row.document);return {id:row.id,team:d.fields.team,destination:d.fields.destination,question:d.fields.question,specificQuestions:d.fields.specifics,reflection:d.fields.reflection,tripDays:d.days,updatedAt:row.updated_at}}

function isAdministrator(request: Request) {
 const uid=request.headers.get('oai-authenticated-user-id');
 const email=(request.headers.get('oai-authenticated-user-email')||'').trim().toLowerCase();
 const allow=(env.ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 return !!uid && !!email && allow.includes(email);
}
function adminFileDto(f:any){return {...fileDto(f),url:'/api/v1/admin/files/'+f.id,previewUrl:'/api/v1/admin/files/'+f.id+'?preview=1'}}
function adminSummary(row:any){const d=JSON.parse(row.document);return {id:row.id,team:d.fields.team||'Untitled team',destination:d.fields.destination||'',question:d.fields.question||'',days:d.days,submitted:d.submitted,journalSubmitted:Object.entries(d.journals).filter(([day,j]:any)=>Number(day)<=d.days&&j.submitted).length,fileCount:Number(row.file_count)||0,published:row.published===1,version:row.version,createdAt:row.created_at,updatedAt:row.updated_at}}
async function adminRequest(request:Request,parts:string[],url:URL){
 if(!request.headers.get('oai-authenticated-user-id'))return error('Sign in with an administrator account.',401);
 if(!isAdministrator(request))return error('This account does not have administrator access.',403);
 if(request.method!=='GET')return error('The administrator console is read-only.',405);
 if(parts[1]==='overview'&&parts.length===2){
 const totals=await env.DB!.prepare('SELECT COUNT(*) AS totalProjects, COALESCE(SUM(CASE WHEN json_extract(document,\'$.submitted[3]\')=1 THEN 1 ELSE 0 END),0) AS finalSubmissions FROM projects').first<any>();
 const uploads=await env.DB!.prepare('SELECT COUNT(*) AS totalFiles, COALESCE(SUM(size),0) AS storageBytes FROM files').first<any>();
 const journals=await env.DB!.prepare("SELECT COUNT(*) AS submittedJournals FROM projects, json_each(projects.document,'$.journals') AS j WHERE CAST(j.key AS INTEGER)<=json_extract(projects.document,'$.days') AND json_extract(j.value,'$.submitted')=1").first<any>();
 return json({metrics:{...totals,...uploads,...journals}});
 }
 if(parts[1]==='projects'&&parts.length===2){
 const q=(url.searchParams.get('q')||'').trim().slice(0,200),status=url.searchParams.get('status')||'all';
 const limit=Math.max(1,Math.min(50,Math.floor(Number(url.searchParams.get('limit'))||25))),offset=Math.max(0,Math.min(10000,Math.floor(Number(url.searchParams.get('offset'))||0)));
 if(!['all','final','in-progress','no-files'].includes(status))return error('Invalid status filter.');
 const where="(?='' OR instr(lower(COALESCE(json_extract(p.document,'$.fields.team'),'')||' '||COALESCE(json_extract(p.document,'$.fields.destination'),'')||' '||COALESCE(json_extract(p.document,'$.fields.question'),'')),lower(?))>0) AND (?='all' OR (?='final' AND json_extract(p.document,'$.submitted[3]')=1) OR (?='in-progress' AND json_extract(p.document,'$.submitted[3]')!=1) OR (?='no-files' AND NOT EXISTS (SELECT 1 FROM files f WHERE f.project_id=p.id)))";
 const binds=[q,q,status,status,status,status];
 const count=await env.DB!.prepare('SELECT COUNT(*) AS total FROM projects p WHERE '+where).bind(...binds).first<any>();
 const rows=await env.DB!.prepare('SELECT p.*, (SELECT COUNT(*) FROM files f WHERE f.project_id=p.id) AS file_count FROM projects p WHERE '+where+' ORDER BY p.updated_at DESC,p.id LIMIT ? OFFSET ?').bind(...binds,limit,offset).all<any>();
 return json({projects:rows.results.map(adminSummary),total:count.total,limit,offset,hasMore:offset+rows.results.length<count.total});
 }
 if(parts[1]==='projects'&&parts.length===3){
 const row=await env.DB!.prepare('SELECT * FROM projects WHERE id=?').bind(parts[2]).first<Row>();if(!row)return error('Project not found.',404);
 const fs=await env.DB!.prepare('SELECT * FROM files WHERE project_id=? ORDER BY created_at,id').bind(row.id).all<any>();
 return json({project:{...projectDto(row),createdAt:row.created_at},files:fs.results.map(adminFileDto)});
 }
 if(parts[1]==='files'&&parts.length===3){
 const f=await env.DB!.prepare('SELECT * FROM files WHERE id=?').bind(parts[2]).first<any>();if(!f)return error('File not found.',404);
 const object=await env.BUCKET!.get(f.object_key);if(!object)return error('This file is not available in storage.',404);
 const preview=url.searchParams.get('preview')==='1'&&['application/pdf','image/png','image/jpeg','image/gif','image/webp','image/avif'].includes(f.type);
 return new Response(object.body,{headers:{'Content-Type':f.type,'Content-Disposition':`${preview?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
 }
 return error('Administrator endpoint not found.',404);
}

async function handle(request:Request){
 try{
 const url=new URL(request.url),parts=url.pathname.replace(/^\/api\/v1\/?/,'').split('/').filter(Boolean),method=request.method;
 if(method==='OPTIONS'&&parts[0]==='cases')return new Response(null,{status:204,headers:{...publicHeaders,'Access-Control-Allow-Methods':'GET, OPTIONS'}});
 if(method==='GET'&&parts[0]==='health')return json({ok:true,apiVersion:'v1',storage:'D1 + R2'});
 const uid=request.headers.get('oai-authenticated-user-id');
 if(method==='GET'&&parts[0]==='session')return json({authenticated:!!uid,administrator:isAdministrator(request),signInUrl:'/signin-with-chatgpt?return_to=%2Fstudent.html'});
 if(!env.DB||!env.BUCKET)return error('Cloud storage is not configured.',503);
 if(parts[0]==='admin')return await adminRequest(request,parts,url);
 // Public case endpoints expose only opt-in completed stories, never member names or account IDs.
 if(method==='GET'&&parts[0]==='cases'){
 if(parts[1]){const row=await env.DB.prepare('SELECT * FROM projects WHERE id=? AND published=1').bind(parts[1]).first<Row>();if(!row)return publicJson({error:'Case not found.'},404);const d=JSON.parse(row.document);const fs=await env.DB.prepare('SELECT * FROM files WHERE project_id=? AND (kind=? OR kind=?) ORDER BY created_at').bind(row.id,'outcomes','photos').all();return publicJson({case:{...story(row),journals:Object.entries(d.journals).filter(([day,j]:any)=>Number(day)<=d.days&&j.submitted).map(([day,j]:any)=>({day:Number(day),observations:j.observations,challenges:j.challenges,response:j.response,photoNote:j.photoNote})),files:fs.results.filter((f:any)=>f.kind==='outcomes'||f.day<=d.days&&d.journals[f.day]?.submitted).map((f:any)=>({...fileDto(f),url:'/api/v1/case-files/'+f.id}))}})}
 const q=(url.searchParams.get('q')||'').trim().slice(0,200);const limit=Math.max(1,Math.min(50,Number(url.searchParams.get('limit'))||20));const offset=Math.max(0,Math.floor(Number(url.searchParams.get('offset'))||0));const rows=await env.DB.prepare("SELECT * FROM projects WHERE published=1 AND (?='' OR instr(lower(json_extract(document,'$.fields.destination')||' '||json_extract(document,'$.fields.question')||' '||json_extract(document,'$.fields.team')),lower(?))>0) ORDER BY updated_at DESC, id LIMIT ? OFFSET ?").bind(q,q,limit+1,offset).all<Row>();return publicJson({cases:rows.results.slice(0,limit).map(story),hasMore:rows.results.length>limit,limit,offset});
 }
 if(method==='GET'&&parts[0]==='case-files'&&parts[1]){
 const f=await env.DB.prepare('SELECT files.*,projects.document FROM files JOIN projects ON files.project_id=projects.id WHERE files.id=? AND projects.published=1 AND files.kind IN (?,?)').bind(parts[1],'photos','outcomes').first<any>();if(!f)return publicJson({error:'File not found.'},404);const d=JSON.parse(f.document);if(f.kind==='photos'&&(f.day>d.days||!d.journals[f.day]?.submitted))return publicJson({error:'File not found.'},404);const object=await env.BUCKET.get(f.object_key);if(!object)return publicJson({error:'File not found.'},404);return new Response(object.body,{headers:{...publicHeaders,'Content-Type':f.type,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}});
 }
 // Same-origin writes only. Platform-supplied identity is required for every private record.
 if(!uid)return error('Sign in to save or access your project.',401);
 if(!['GET','HEAD'].includes(method)){const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return error('Cross-origin writes are not allowed.',403)}
 if(parts[0]==='project'&&parts.length===1){
 if(method==='GET'){const row=await own(uid);return json({project:row?projectDto(row):null})}
 if(method==='PUT'){
 if(Number(request.headers.get('content-length')||0)>256*1024)return error('Project document is too large.',413);
 const raw=await request.text();if(raw.length>256*1024)return error('Project document is too large.',413);const body=JSON.parse(raw);const doc=normalize(body.document);const version=Number(body.version);if(!Number.isInteger(version)||version<0)return error('A valid version is required.');
 const row=await own(uid);const counts=row?(await env.DB.prepare('SELECT kind, COUNT(*) AS n FROM files WHERE project_id=? GROUP BY kind').bind(row.id).all<any>()).results:[];
 if(doc.submitted[1]&&!counts.some(c=>c.kind==='proposal'&&c.n>=1))return error('Upload a proposal before submitting.');
 if(doc.submitted[3]&&!counts.some(c=>c.kind==='outcomes'&&c.n>=2))return error('Upload at least two outcome files before submitting.');
 const published=doc.shareWithLibrary&&doc.submitted[3]?1:0,now=new Date().toISOString(),savedId=row?.id||crypto.randomUUID();
 if(row){if(row.version!==version)return error('A newer version exists. Reload the cloud version before saving.',409);const result=await env.DB.prepare('UPDATE projects SET document=?,version=version+1,published=?,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(doc),published,now,row.id,version).run();if(!result.meta.changes)return error('A newer version exists. Reload before saving.',409)}
 else{if(version!==0)return error('Project not found. Reload before saving.',409);try{await env.DB.prepare('INSERT INTO projects (id,owner_id,document,version,published,created_at,updated_at) VALUES (?,?,?,1,?,?,?)').bind(savedId,uid,JSON.stringify(doc),published,now,now).run()}catch(e){if(await own(uid))return error('A project was created on another device. Reload before saving.',409);throw e}}
 return json({project:{id:savedId,document:doc,version:version+1,published:published===1,updatedAt:now}});
 }
 }
 if(parts[0]==='files'){
 const row=await own(uid);
 if(parts.length===1&&method==='GET'){if(!row)return json({files:[]});const fs=await env.DB.prepare('SELECT * FROM files WHERE project_id=? ORDER BY created_at,id').bind(row.id).all();return json({files:fs.results.map(fileDto)})}
 if(parts.length===1&&method==='POST'){
 if(!row)return error('Save your project before adding files.',409);if(Number(request.headers.get('content-length')||0)>16*1024*1024)return error('File is too large.',413);
 const form=await request.formData(),file=form.get('file'),kind=String(form.get('kind')||''),day=kind==='photos'?Number(form.get('day')):null;if(!(file instanceof File)||!['photos','proposal','outcomes'].includes(kind))return error('Select a valid file and upload category.');if(file.size>15*1024*1024||file.size===0)return error('Files must be non-empty and no larger than 15 MB.',413);
 const name=file.name.replace(/[\r\n\x00-\x1f]/g,'').slice(0,200),image=/\.(png|jpe?g|webp|gif|heic|heif|avif)$/i.test(name),ext=name.split('.').pop()?.toLowerCase();if(kind==='photos'&&!image||!image&&!['pdf','doc','docx'].includes(ext||''))return error('Unsupported file type.');if(kind==='photos'&&(!Number.isInteger(day)||day!<1||day!>JSON.parse(row.document).days))return error('Invalid trip day.');
 const id=crypto.randomUUID(),key=row.id+'/'+id;const type=image?(file.type.startsWith('image/')?file.type:'application/octet-stream'):ext==='pdf'?'application/pdf':'application/octet-stream';const now=new Date().toISOString();
 await env.BUCKET.put(key,file.stream(),{httpMetadata:{contentType:type}});try{await env.DB.prepare('INSERT INTO files (id,project_id,kind,day,name,type,size,object_key,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,row.id,kind,day,name,type,file.size,key,now).run()}catch(e){await env.BUCKET.delete(key);throw e}return json({file:fileDto({id,kind,day,name,type,size:file.size,created_at:now})},201);
 }
 if(parts.length===2&&(method==='GET'||method==='DELETE')){
 const f=await env.DB.prepare('SELECT * FROM files WHERE id=?').bind(parts[1]).first<any>();if(!f)return error('File not found.',404);const project=await env.DB.prepare('SELECT * FROM projects WHERE id=?').bind(f.project_id).first<Row>();const owner=project?.owner_id===uid;if(!owner)return error('File not found.',404);
 if(method==='DELETE'){const doc=JSON.parse(project!.document);if(f.kind==='photos'&&doc.journals[f.day])doc.journals[f.day].submitted=false;else doc.submitted[f.kind==='proposal'?1:3]=false;const results=await env.DB.batch([env.DB.prepare('DELETE FROM files WHERE id=? AND EXISTS (SELECT 1 FROM projects WHERE id=? AND version=?)').bind(f.id,project!.id,project!.version),env.DB.prepare('UPDATE projects SET document=?,version=version+1,published=0,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(doc),new Date().toISOString(),project!.id,project!.version)]);if(!results[1].meta.changes)return error('A newer version exists. Reload before removing files.',409);await env.BUCKET.delete(f.object_key);return json({deleted:true,project:{id:project!.id,document:doc,version:project!.version+1,published:false}})}
 const object=await env.BUCKET.get(f.object_key);if(!object)return error('File is unavailable.',404);return new Response(object.body,{headers:{'Content-Type':f.type,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
 }
 }
 return error('Endpoint not found.',404);
 }catch(e){console.error('API failure',e instanceof Error?e.message:'Unknown failure');if(e instanceof SyntaxError)return error('Invalid JSON.');if(e instanceof Error&&/Invalid|characters|Trip duration|submitted journal|Complete the required/.test(e.message))return error(e.message);return error('The request could not be saved. Please try again.',500)}
}
export const GET=handle,PUT=handle,POST=handle,DELETE=handle,OPTIONS=handle;
