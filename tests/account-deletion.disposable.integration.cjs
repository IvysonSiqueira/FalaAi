// OPT-IN exclusivo do projeto descartável. Execute pelo script de preflight.
// Não usa o banco principal, não aplica migrações e não implanta Edge Function.
const{test}=require('node:test');const assert=require('node:assert/strict');
const{randomUUID}=require('node:crypto');const{createClient}=require('@supabase/supabase-js');
const{deleteAccount}=require('../supabase/functions/delete-account/core.ts');
const {validateTarget,scopedFetch}=require('./helpers/lgpd-target.cjs');
const enabled=process.env.FALAAI_LGPD_RUN_AUTHORIZED==='yes';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB9kAAAAASUVORK5CYII=','base64');
function checked(result){assert.ok(!result.error,'Operação descartável Supabase recusada; conferir ambiente descartável.');return result.data;}
async function setup(t){
 const config=validateTarget(process.env,true,process.env.FALAAI_LGPD_CURRENT_PRIMARY_REF);
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:scopedFetch(config.url)}};
 const fresh=()=>createClient(config.url,config.publicKey,options);
 const admin=createClient(config.url,config.adminKey,options);
 const fixturePaths=new Map();
 const accounts=[];
 t.after(async()=>{
  // Somente UUIDs criados por esta execução; sem listagem ou limpeza global.
  for(const account of accounts){
   checked(await admin.rpc('prepare_account_deletion',{p_user:account.id}));
   const paths=[...fixturePaths.get(account.id)];
   if(paths.length)checked(await admin.storage.from('occurrence-photos').remove(paths));
   assert.equal(checked(await admin.rpc('finish_account_deletion',{p_user:account.id})),true,'Limpeza descartável incompleta; identidade preservada.');
   checked(await admin.auth.admin.deleteUser(account.id));
  }
 });
 async function account(){
  const password='Fixture!'+randomUUID();const email='lgpd-fixture-'+randomUUID()+'@example.invalid';
  const created=checked(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:'Fixture descartável descartável',privacy_accepted:true,privacy_version:'2026-11-24-v1'}}));
  const result={id:created.user.id,password,email};
  assert.match(result.id,/^[0-9a-f-]{36}$/,'UUID de fixture inválido.');
  accounts.push(result);fixturePaths.set(result.id,new Set());
  const client=fresh();const session=checked(await client.auth.signInWithPassword({email,password})).session;
  return {...result,client,token:session.access_token};
 }
 async function photo(owner){
  const path=checked(await owner.client.rpc('reserve_occurrence_photo',{p_extension:'png'}));
  assert.ok(fixturePaths.has(owner.id)&&typeof path==='string'&&path.startsWith(owner.id+'/')&&/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/.test(path),'Caminho fora da fixture.');
  fixturePaths.get(owner.id).add(path);
  checked(await owner.client.storage.from('occurrence-photos').upload(path,png,{contentType:'image/png',upsert:false}));
  assert.equal(checked(await owner.client.rpc('confirm_occurrence_photo_upload',{p_path:path})),true);
  checked(await owner.client.from('occurrences').insert({category_id:'outros',description:'Fotografia isolada para validar exclusão descartável.',location:'Fixture descartável sem GPS',photo_path:path}).select('id'));
  return path;
 }
 function own(id){assert.ok(fixturePaths.has(id),'Operação recusada: usuário não criado nesta execução.');}
 function pathsOwned(paths){for(const path of paths)assert.ok([...fixturePaths.values()].some(set=>set.has(path)),'Arquivo fora das fixtures.');}
 function dependencies(){return {
  enabled:true,
  verify:async token=>{const result=await fresh().auth.getUser(token);return result.error?null:{id:result.data.user.id,email:result.data.user.email}},
  reauthenticate:async(user,password)=>{const auth=fresh();const result=await auth.auth.signInWithPassword({email:user.email,password});const valid=!result.error&&result.data.user?.id===user.id;if(result.data.session)await auth.auth.signOut({scope:'local'});return valid},
  prepare:async id=>{own(id);return checked(await admin.rpc('prepare_account_deletion',{p_user:id}))},
  remove:async paths=>{pathsOwned(paths);checked(await admin.storage.from('occurrence-photos').remove(paths))},
  acknowledge:async(id,paths)=>{own(id);assert.ok(paths.every(p=>fixturePaths.get(id).has(p)),'ACK fora da fixture.');checked(await admin.rpc('ack_account_deletion_files',{p_user:id,p_paths:paths}))},
  finish:async id=>{own(id);return checked(await admin.rpc('finish_account_deletion',{p_user:id}))},
  // Não testar remoção Auth destrutiva da função neste harness: só provar prontidão.
  // Contas criadas pelo harness são removidas exclusivamente no cleanup acima.
  deleteIdentity:async id=>{
   assert.equal(checked(await admin.rpc('finish_account_deletion',{p_user:id})),true);
   assert.equal(checked(await admin.from('occurrence_photo_files').select('path').eq('owner_id',id)).length,0);
  },
 }}
 return {admin,account,photo,dependencies};
}
const input=owner=>({token:owner.token,password:owner.password,confirmation:'EXCLUIR MINHA CONTA'});
async function drain(owner,deps){for(let i=0;i<8;i++){const result=await deleteAccount(input(owner),deps);if(result.status===200)return;assert.equal(result.status,202,'Operação descartável falhou.');}assert.fail('RPCs não avançaram após oito lotes.');}
for(const size of [0,1,100,101,250])test(`DESCARTÁVEL PostgreSQL/Storage: ${size} fotos, lotes avançam e outra conta permanece`,{skip:!enabled},async t=>{
 const f=await setup(t);const a=await f.account(),b=await f.account();const protectedPath=await f.photo(b);
 for(let i=0;i<size;i++)await f.photo(a);
 await drain(a,f.dependencies());
 const signed=await b.client.storage.from('occurrence-photos').createSignedUrl(protectedPath,60);assert.ok(!signed.error,'Foto da outra conta foi afetada.');
});
test('DESCARTÁVEL: remoção parcial, interrupção antes do ACK, repetição e concorrência',{skip:!enabled},async t=>{
 const f=await setup(t);const a=await f.account();for(let i=0;i<101;i++)await f.photo(a);
 const deps=f.dependencies();const normalRemove=deps.remove;
 deps.remove=async paths=>{await normalRemove(paths.slice(0,37));throw Error('Interrupção sintética')};
 assert.equal((await deleteAccount(input(a),deps)).status,503);
 assert.equal(checked(await f.admin.from('occurrence_photo_files').select('path').eq('owner_id',a.id)).length,64);
 deps.remove=normalRemove;const normalAck=deps.acknowledge;deps.acknowledge=async()=>{throw Error('ACK indisponível')};
 assert.equal((await deleteAccount(input(a),deps)).status,503);deps.acknowledge=normalAck;
 await Promise.all([drain(a,deps),drain(a,deps)]);await drain(a,deps);
});
test('DESCARTÁVEL: RLS/grants negam RPC privilegiada e ACK não aceita caminho alheio',{skip:!enabled},async t=>{
 const f=await setup(t);const a=await f.account(),b=await f.account();const path=await f.photo(b);
 assert.ok((await a.client.rpc('prepare_account_deletion',{p_user:b.id})).error);
 assert.ok((await a.client.rpc('ack_account_deletion_files',{p_user:b.id,p_paths:[path]})).error);
 assert.ok((await a.client.rpc('finish_account_deletion',{p_user:b.id})).error);
 checked(await f.admin.rpc('prepare_account_deletion',{p_user:a.id}));
 assert.ok((await f.admin.rpc('ack_account_deletion_files',{p_user:a.id,p_paths:[path]})).error);
 assert.ok(!(await b.client.storage.from('occurrence-photos').createSignedUrl(path,60)).error);
});
