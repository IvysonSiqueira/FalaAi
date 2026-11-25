// Integração REAL opt-in. Nenhum import pelo Expo, nenhum acesso ao projeto principal.
const fs=require('node:fs'),path=require('node:path');const {parseEnv}=require('node:util');
const {spawnSync}=require('node:child_process');const {randomUUID}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const {validateTarget,scopedFetch,apiKeyHeaders}=require('../tests/helpers/lgpd-target.cjs');
const {fixtureScope}=require('../tests/helpers/lgpd-fixtures.cjs');
const {prepareArtifactDirectory}=require('./helpers/lgpd-artifacts.cjs');
const {deleteAccount}=require('../supabase/functions/delete-account/core.ts');
const root=path.resolve(__dirname,'..');process.chdir(root);
const REF='ilkprwaxszztejsasmcs';const runId=randomUUID();
const names=[
 'Inventário inicial vazio e destino bloqueado para o principal',
 'Cadastro público sem aceite rejeitado',
 'Cadastro público com versão inválida rejeitado',
 'Cadastro público com aceite válido e registro servidor',
 'Aceite: data enviada não substitui data servidor',
 'Privacidade: usuário não escreve nem lê aceite alheio',
 'CRUD próprio persistente e leitura comunitária',
 'RLS: usuário não edita/exclui relato alheio nem muda proprietário',
 'Storage: upload e leitura autenticada, bloqueio anônimo',
 'Storage: usuário não modifica/exclui foto alheia',
 'Registro de fotos: escrita direta e RPCs administrativas negadas',
 'HTTP sem autenticação e JWT inválido rejeitados',
 'HTTP senha incorreta e UUID alheio rejeitados sem efeitos',
 ...[0,1,100,101,250].map(n=>`HTTP exclusão real com ${n} fotos e segunda conta preservada`),
 'RPC real: falha parcial e perda sintética de ACK com retomada',
 'HTTP concorrência e repetição com exclusão Auth real',
 'Ausência final de fixtures órfãs',
 'Falha de rede real injetada dentro do runtime Deno',
 'Espera real de 24 horas para upload incerto',
];
const results=new Map(names.map(n=>[n,{scenario:n,status:'NÃO EXECUTADO'}]));
let config,admin,fresh,net,manifestFile,reportFile,scope,flagFalse=false,disabled=false;
const accounts=new Map();let a,b,protectedPath,baseOccurrence;
let phase='preflight';const notes=[];
const version='2026-11-24-v1';const confirm='EXCLUIR MINHA CONTA';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB9kAAAAASUVORK5CYII=','base64');
function need(ok,code='ASSERTION'){if(!ok)throw Error(code);}
function checked(r){if(r.error)throw Error('API_'+String(r.error.code||r.error.status||'REFUSED').replace(/[^A-Za-z0-9_]/g,'').toUpperCase());return r.data;}
function persist(){if(reportFile)fs.writeFileSync(reportFile,JSON.stringify({runId,phase,results:[...results.values()],notes,flagFalse,disabled},null,2),{mode:0o600});}
async function scenario(name,fn){phase=name;persist();console.log('INICIANDO: '+name);try{const evidence=await fn();const status=evidence?.blocked?'FALHOU':'PASSOU';results.set(name,{scenario:name,status,evidence:evidence?.blocked||evidence||'Condições verificadas sem exposição de dados'});persist();console.log(status+': '+name+(evidence?.blocked?' / '+evidence.blocked:''));}catch(e){const code=/^[A-Z0-9_]+$/.test(e?.message||'')?e.message:'SAFE_FAILURE';results.set(name,{scenario:name,status:'FALHOU',evidence:code});persist();console.log('FALHOU: '+name+' / '+code);throw Error('BLOCKED');}}
function cliFlag(value){need(config?.ref===REF,'DESTINATION');const r=spawnSync('npx',['--yes','supabase@3.4.0','secrets','set','ACCOUNT_DELETION_ENABLED='+value,'--remote='+REF,'--yes'],{encoding:'utf8',timeout:60000});need(r.status===0,'FLAG_UPDATE_FAILED');flagFalse=value==='false';persist();console.log('Flag remota definida como '+value);}
async function http(owner,body,tokenOverride){
 if(owner)scope.requireUser(owner.id);
 const headers=apiKeyHeaders(config.publicKey);headers.set('Content-Type','application/json');
 const token=tokenOverride??owner?.token;if(token)headers.set('Authorization','Bearer '+token);
 const r=await net(config.url+'/functions/v1/delete-account',{method:'POST',headers,body:JSON.stringify(body??{password:owner?.password||'invalid',confirmation:confirm}),signal:AbortSignal.timeout(45000)});
 let state;try{state=(await r.json()).state}catch{}
 return {status:r.status,state:typeof state==='string'&&/^[a-z_]+$/.test(state)?state:'unrecognized'};
}
async function getAccount(id){scope.requireUser(id);const r=await admin.auth.admin.getUserById(id);if(r.error){need(r.error.status===404||r.error.code==='user_not_found','AUTH_CHECK_FAILED');return null;}return r.data.user;}
function readRows(sql){need(config.ref===REF&&/^select\b/i.test(sql),'READ_ONLY_QUERY_GUARD');
 const r=spawnSync('npx',['--yes','supabase@3.4.0','db','query','--remote='+REF,'--read-only','--output','json',sql],{encoding:'utf8',timeout:45000});
 need(r.status===0,'READ_ONLY_QUERY_FAILED');let data;try{data=JSON.parse(r.stdout)}catch{throw Error('READ_ONLY_FORMAT');}need(Array.isArray(data.rows),'READ_ONLY_FORMAT');return data.rows;
}
async function count(table,id,column='owner_id'){scope.requireUser(id);need(['profiles','occurrences','occurrence_photo_files','privacy_acceptances','account_deletion_requests'].includes(table)&&['id','owner_id','author_id','user_id'].includes(column),'COUNT_SCOPE');return Number(readRows(`select count(*) as total from public.${table} where ${column}='${id}'::uuid`)[0].total);}

async function absent(id){need(!await getAccount(id),'AUTH_REMAINS');for(const [t,c] of [['profiles','id'],['occurrences','author_id'],['occurrence_photo_files','owner_id'],['privacy_acceptances','user_id'],['account_deletion_requests','user_id']])need(await count(t,id,c)===0,'DEPENDENCY_REMAINS');const list=checked(await admin.storage.from('occurrence-photos').list(id,{limit:1000}));need(list.length===0,'OBJECT_REMAINS');}
async function account(metadata={name:'Fixture LGPD',privacy_accepted:true,privacy_version:version},publicSignup=false){
 const email='lgpd-real-'+randomUUID()+'@example.com',password='Fixture!#'+randomUUID()+'$';
 // E-mail gerado é identificador exclusivo desta tentativa; nenhum registro existente é reutilizado.
 let created;if(publicSignup){created=checked(await fresh().auth.signUp({email,password,options:{data:metadata}}));}else created=checked(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:metadata}));
 need(created.user?.id,'AUTH_CREATE_MISSING');const id=scope.addUser(created.user.id);
 const record={id,email,password};accounts.set(id,record);
 if(publicSignup)checked(await admin.auth.admin.updateUserById(id,{email_confirm:true}));
 const client=fresh();const logged=checked(await client.auth.signInWithPassword({email,password}));need(logged.session?.access_token,'LOGIN_FAILED');
 Object.assign(record,{client,token:logged.session.access_token});return record;
}
async function photo(owner){scope.requireUser(owner.id);const p=checked(await owner.client.rpc('reserve_occurrence_photo',{p_extension:'png'}));scope.addPath(owner.id,p);
 checked(await owner.client.storage.from('occurrence-photos').upload(p,png,{contentType:'image/png',upsert:false}));
 need(checked(await owner.client.rpc('confirm_occurrence_photo_upload',{p_path:p}))===true,'UPLOAD_CONFIRM');
 const row=checked(await owner.client.from('occurrences').insert({category_id:'outros',description:'Fotografia temporária para teste LGPD isolado.',location:'Fixture descartável',photo_path:p}).select('id').single());return {path:p,id:row.id};}
async function photos(owner,n){for(let start=0;start<n;start+=4){const work=await Promise.allSettled(Array.from({length:Math.min(4,n-start)},()=>photo(owner)));need(work.every(r=>r.status==='fulfilled'),'PHOTO_BATCH_FAILED');if((start+4)%40===0||start+4>=n)console.log('Progresso de preparação: '+Math.min(start+4,n)+'/'+n);}}
async function preserve(){need(!!await getAccount(b.id),'SECOND_AUTH_CHANGED');need(await count('occurrences',b.id,'author_id')===1,'SECOND_REPORT_CHANGED');need(await count('privacy_acceptances',b.id,'user_id')===1,'SECOND_PRIVACY_CHANGED');
 const signed=checked(await b.client.storage.from('occurrence-photos').createSignedUrl(protectedPath,60));const r=await net(signed.signedUrl,{signal:AbortSignal.timeout(20000)});need(r.status===200,'SECOND_PHOTO_CHANGED');need(Buffer.from(await r.arrayBuffer()).equals(png),'SECOND_PHOTO_CONTENT_CHANGED');
 const row=checked(await b.client.from('occurrences').select('author_id,description,photo_path').eq('author_id',b.id).single());need(row.author_id===b.id&&row.photo_path===protectedPath&&row.description==='Fotografia temporária para teste LGPD isolado.','SECOND_REPORT_CONTENT_CHANGED');}
async function deleteHttp(owner,n){scope.requireUser(owner.id);const history=[];for(let tries=0;tries<8;tries++){
 const before=await count('occurrence_photo_files',owner.id);const r=await http(owner);history.push(r.status);
 need(r.status===200||r.status===202,'HTTP_DELETE_'+r.status);
 if(r.status===200){need(r.state==='deleted','HTTP_SUCCESS_STATE');await absent(owner.id);return history;}
 need(r.state==='pending','HTTP_PENDING_STATE');need(!!await getAccount(owner.id),'AUTH_REMOVED_EARLY');const after=await count('occurrence_photo_files',owner.id);need(after<before,'BATCH_NO_PROGRESS');
 }throw Error('HTTP_BATCH_LIMIT');}
async function inventory(){const users=checked(await admin.auth.admin.listUsers({page:1,perPage:1}));need(users.users.length===0,'PREEXISTING_USERS');
 const totals=readRows("select (select count(*) from public.profiles) as profiles, (select count(*) from public.occurrences) as occurrences, (select count(*) from public.occurrence_photo_files) as photos, (select count(*) from public.privacy_acceptances) as privacy, (select count(*) from public.account_deletion_requests) as jobs, (select count(*) from storage.objects) as objects")[0];need(Object.values(totals).every(n=>Number(n)===0),'PREEXISTING_ROWS');
 const buckets=checked(await admin.storage.listBuckets());need(buckets.length===1&&buckets[0].id==='occurrence-photos'&&!buckets[0].public,'UNEXPECTED_BUCKETS');
 need(checked(await admin.storage.from('occurrence-photos').list('',{limit:1})).length===0,'PREEXISTING_OBJECTS');}
async function cleanup(){phase='cleanup';persist();if(!scope)return;
 for(const entry of scope.snapshot()){
  try{if(!await getAccount(entry.id)){await absent(entry.id);continue;}
   const prepared=checked(await admin.rpc('prepare_account_deletion',{p_user:scope.requireUser(entry.id)}));
   if(prepared.waiting){notes.push('Fixture com janela de recuperação pendente; identidade preservada no manifesto.');persist();continue;}
   for(let start=0;start<entry.paths.length;start+=100){const paths=entry.paths.slice(start,start+100);paths.forEach(p=>scope.requirePath(entry.id,p));checked(await admin.storage.from('occurrence-photos').remove(paths));checked(await admin.rpc('ack_account_deletion_files',{p_user:entry.id,p_paths:paths}));}
   need(checked(await admin.rpc('finish_account_deletion',{p_user:entry.id}))===true,'CLEANUP_NOT_READY');checked(await admin.auth.admin.deleteUser(entry.id));await absent(entry.id);
  }catch{notes.push('Limpeza incompleta de fixture registrada; revisar manifesto sem limpeza global.');persist();}
 }
}
async function main(){
 need(process.argv[2]==='--run-authorized-disposable'&&process.argv.length===3,'EXPLICIT_MODE_REQUIRED');
 const envPath='.env.lgpd-validacao.local';need(spawnSync('git',['check-ignore','--quiet','--',envPath]).status===0,'ENV_NOT_IGNORED');
 need(spawnSync('git',['branch','--show-current'],{encoding:'utf8'}).stdout.trim()==='codex/prova-iii-supabase','BRANCH');
 const env=parseEnv(fs.readFileSync(envPath,'utf8'));const app=parseEnv(fs.readFileSync('.env.local','utf8'));
 const primary=new URL(app.EXPO_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
 config=validateTarget({...env,FALAAI_LGPD_ALLOW_TESTS:'yes',FALAAI_LGPD_ALLOW_FIXTURE_DELETION:'yes'},true,primary);
 need(config.ref===REF&&config.url==='https://'+REF+'.supabase.co','DESTINATION');
 ({manifestFile,reportFile}=prepareArtifactDirectory(root,runId));
 need([manifestFile,reportFile].every(file=>spawnSync('git',['check-ignore','--quiet','--',file]).status===0),'MANIFEST_NOT_IGNORED');
 fs.writeFileSync(manifestFile,'[]',{flag:'wx',mode:0o600});scope=fixtureScope(records=>fs.writeFileSync(manifestFile,JSON.stringify({runId,ref:REF,fixtures:records},null,2),{mode:0o600}));
 const scoped=scopedFetch(config.url);net=(u,o={})=>scoped(u,{...o,signal:o.signal||AbortSignal.timeout(30000)});
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:net}};
 fresh=()=>createClient(config.url,config.publicKey,options);admin=createClient(config.url,config.adminKey,options);
 try{
 await scenario(names[0],inventory);
 // Nenhuma exclusão é habilitada antes de verificar o ambiente vazio.
 for(const [index,metadata] of [[1,{}],[2,{privacy_accepted:true,privacy_version:'invalid'}]])await scenario(names[index],async()=>{
  const r=await fresh().auth.signUp({email:'lgpd-denied-'+randomUUID()+'@example.com',password:'Fixture!'+randomUUID(),options:{data:{name:'Fixture rejeitada',...metadata}}});
  need(!!r.error&&!r.data.user&&r.error.status===500,'SIGNUP_REJECTION_NOT_TRIGGER_ERROR');need(checked(await admin.auth.admin.listUsers({page:1,perPage:1})).users.length===0,'REJECTED_SIGNUP_CREATED_USER');return 'Signup público recusado; Auth permanece vazio';
 });
 await scenario(names[3],async()=>{let mailBlocked;try{a=await account(undefined,true);}catch(e){console.log('Diagnóstico seguro do signup: '+(/^[A-Z0-9_]+$/.test(e.message)?e.message:'API_ERROR'));if(!/^API_.*(EMAIL|RATE|SMTP)/.test(e.message))throw e;mailBlocked=e.message;a=await account();}const row=readRows(`select version,accepted_at from public.privacy_acceptances where user_id='${scope.requireUser(a.id)}'::uuid`)[0];need(row.version===version&&Number.isFinite(Date.parse(row.accepted_at)),'PRIVACY_RECORD');if(mailBlocked){results.set('Cadastro confirmado via Auth Admin com aceite válido',{scenario:'Cadastro confirmado via Auth Admin com aceite válido',status:'PASSOU',evidence:'Trigger real criou perfil/aceite; fixture confirmada sem envio SMTP'});return {blocked:'Cadastro público não concluído por '+mailBlocked+'; demais fixtures via Auth Admin'};}return 'Signup público válido; confirmação administrativa apenas da fixture para login';});
 await scenario(names[4],async()=>{const start=Date.now();b=await account({name:'Fixture preservada',privacy_accepted:true,privacy_version:version,accepted_at:'2000-01-01T00:00:00Z',privacy_accepted_at:'2000-01-01T00:00:00Z'});const row=checked(await b.client.from('privacy_acceptances').select('version,accepted_at').single());need(row.version===version&&Date.parse(row.accepted_at)>=start-60000&&Math.abs(Date.now()-Date.parse(row.accepted_at))<120000,'SERVER_DATE_FORGED');});
 await scenario(names[5],async()=>{
  need(checked(await a.client.from('privacy_acceptances').select('user_id').eq('user_id',b.id)).length===0,'PRIVACY_LEAK');
  const u=await a.client.from('privacy_acceptances').update({accepted_at:'2000-01-01T00:00:00Z'}).eq('user_id',a.id).select();need(!!u.error,'PRIVACY_WRITE');
  need(!!(await a.client.from('privacy_acceptances').insert({user_id:a.id,version})).error,'PRIVACY_INSERT');
  need(!!(await a.client.from('privacy_acceptances').delete().eq('user_id',a.id)).error,'PRIVACY_DELETE');
 });
 await scenario(names[6],async()=>{baseOccurrence=checked(await a.client.from('occurrences').insert({category_id:'outros',description:'Relato temporário para validar CRUD e comunidade.',location:'Fixture descartável'}).select('*').single());
  const edited=checked(await a.client.from('occurrences').update({description:'Descrição editada persistente da fixture comunitária.'}).eq('id',baseOccurrence.id).select().single());need(edited.description.startsWith('Descrição editada'),'OWN_UPDATE');
  need(checked(await b.client.from('occurrences').select('id').eq('id',baseOccurrence.id)).length===1,'COMMUNITY_READ');
  checked(await a.client.from('occurrences').delete().eq('id',baseOccurrence.id));need(checked(await a.client.from('occurrences').select('id').eq('id',baseOccurrence.id)).length===0,'OWN_DELETE');
  const p=await photo(b);protectedPath=p.path;baseOccurrence={id:p.id};
 });
 await scenario(names[7],async()=>{const update=await a.client.from('occurrences').update({description:'Ataque temporário que deve ser rejeitado pelo RLS.'}).eq('id',baseOccurrence.id).select();need(update.error||update.data?.length===0,'CROSS_UPDATE');
  const del=await a.client.from('occurrences').delete().eq('id',baseOccurrence.id).select();need(del.error||del.data?.length===0,'CROSS_DELETE');
  need(!!(await b.client.from('occurrences').update({author_id:a.id}).eq('id',baseOccurrence.id)).error,'OWNER_MUTATION');
  need(!!(await fresh().from('occurrences').select('id')).error,'ANON_READ');await preserve();
 });
 await scenario(names[8],async()=>{const signed=checked(await a.client.storage.from('occurrence-photos').createSignedUrl(protectedPath,60));const r=await net(signed.signedUrl);need(r.status===200,'COMMUNITY_PHOTO_READ');await r.arrayBuffer();
  need(!!(await fresh().storage.from('occurrence-photos').createSignedUrl(protectedPath,60)).error,'ANON_PHOTO');
 });
 await scenario(names[9],async()=>{
  const changed=await a.client.storage.from('occurrence-photos').upload(protectedPath,png,{contentType:'image/png',upsert:true});need(!!changed.error,'CROSS_UPSERT');
  const removed=await a.client.storage.from('occurrence-photos').remove([protectedPath]);need(removed.error||removed.data?.length===0,'CROSS_STORAGE_DELETE');await preserve();
 });
 await scenario(names[10],async()=>{
  need(!!(await a.client.from('occurrence_photo_files').update({state:'cleanup'}).eq('owner_id',b.id)).error,'REGISTRY_WRITE');
  need(checked(await a.client.from('occurrence_photo_files').select('path').eq('owner_id',b.id)).length===0,'REGISTRY_READ');
  for(const [name,args] of [['prepare_account_deletion',{p_user:b.id}],['ack_account_deletion_files',{p_user:b.id,p_paths:[protectedPath]}],['finish_account_deletion',{p_user:b.id}],['falaai_prune_deleted_account_files',{p_user:b.id,p_paths:[protectedPath]}]])need(!!(await a.client.rpc(name,args)).error,'ADMIN_RPC_EXPOSED');
 });
 cliFlag('true');
 await scenario(names[11],async()=>{need((await http(null)).status===401,'HTTP_ANON');need((await http(null,undefined,'invalid-fixture-token')).status===401,'HTTP_INVALID_JWT');});
 await scenario(names[12],async()=>{const wrong=await http(a,{password:'Wrong!'+randomUUID(),confirmation:confirm});need(wrong.status===401,'HTTP_WRONG_PASSWORD');const target=await http(a,{password:a.password,confirmation:confirm,userId:b.id});need(target.status===400,'HTTP_FOREIGN_UUID');need(!!await getAccount(a.id),'FAILED_REQUEST_DELETED_AUTH');await preserve();});
 for(const [i,size] of [0,1,100,101,250].entries())await scenario(names[13+i],async()=>{const owner=size===0?a:await account();await photos(owner,size);const history=await deleteHttp(owner,size);await preserve();return 'HTTP real '+history.join(' → ')+'; Auth/dados/arquivos ausentes e conta B preservada';});
 await scenario(names[18],async()=>{
  const owner=await account();await photos(owner,101);const scopedId=()=>scope.requireUser(owner.id);
  const deps={enabled:true,verify:async()=>({id:owner.id,email:owner.email}),reauthenticate:async()=>true,
   prepare:async()=>checked(await admin.rpc('prepare_account_deletion',{p_user:scopedId()})),
   remove:async paths=>{paths.forEach(p=>scope.requirePath(owner.id,p));checked(await admin.storage.from('occurrence-photos').remove(paths.slice(0,37)));throw Error('SYNTHETIC');},
   acknowledge:async(_,paths)=>{paths.forEach(p=>scope.requirePath(owner.id,p));checked(await admin.rpc('ack_account_deletion_files',{p_user:scopedId(),p_paths:paths}));},
   finish:async()=>checked(await admin.rpc('finish_account_deletion',{p_user:scopedId()})),deleteIdentity:async()=>{throw Error('UNEXPECTED');}};
  const input={token:owner.token,password:owner.password,confirmation:confirm};need((await deleteAccount(input,deps)).status===503,'FAULT_NOT_INJECTED');
  need(await count('occurrence_photo_files',owner.id)===64,'PARTIAL_ACK_PROGRESS');need(!!await getAccount(owner.id),'PARTIAL_AUTH_REMOVED');
  const work=checked(await admin.rpc('prepare_account_deletion',{p_user:scopedId()}));work.paths.forEach(p=>scope.requirePath(owner.id,p));checked(await admin.storage.from('occurrence-photos').remove(work.paths));
  // Interrupção intencional antes do ACK; próxima chamada real deverá recuperar metadata ausente.
  need(!!await getAccount(owner.id),'ACK_LOSS_AUTH_REMOVED');const history=await deleteHttp(owner,101);await preserve();
  return 'RPC/Storage reais + interrupções sintéticas no orquestrador; retomada HTTP '+history.join(' → ');
 });
 await scenario(names[19],async()=>{const owner=await account();await photos(owner,1);const r=await Promise.all([http(owner),http(owner)]);need(r.some(x=>x.status===200),'CONCURRENT_NO_SUCCESS');need(r.every(x=>[200,202,401,503].includes(x.status)),'CONCURRENT_STATUS');await absent(owner.id);const again=await http(owner);need(again.status===401,'REPEATED_DELETE_AUTHORIZED');await preserve();return 'HTTP concorrente: '+r.map(x=>x.status).join(',')+'; repetição 401; outra conta intacta';});
 }catch{notes.push('Execução interrompida no primeiro cenário impeditivo; cenários seguintes não executados.');}
 finally{
  try{cliFlag('false');}catch{notes.push('CRÍTICO: não foi possível confirmar restauração da flag false.');}
  if(flagFalse){try{const r=await http(null);disabled=r.status===503&&r.state==='disabled';need(disabled,'DISABLED_NOT_CONFIRMED');console.log('Trava HTTP restaurada: 503 / disabled');}catch{notes.push('Não foi possível comprovar 503/disabled no encerramento.');}}
  await cleanup();
  try{await scenario(names[20],inventory);}catch{notes.push('Inventário final contém pendências ou não pôde ser confirmado; consultar manifesto.');}
  persist();const summary={passed:[...results.values()].filter(r=>r.status==='PASSOU').length,failed:[...results.values()].filter(r=>r.status==='FALHOU').length,notRun:[...results.values()].filter(r=>r.status==='NÃO EXECUTADO').length,flagFalse,disabled,manifest:path.basename(manifestFile),report:path.basename(reportFile)};
  console.log('RESUMO SEGURO: '+JSON.stringify(summary));
 }
}
main().catch(()=>{console.log('Executor bloqueado com diagnóstico seguro; nenhuma credencial exibida.');process.exitCode=1;});
