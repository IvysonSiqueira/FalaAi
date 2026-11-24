// OPT-IN remoto. NÃO executado no fluxo local. Duas contas já confirmadas,
// projeto explicitamente confirmado e migração Storage aplicada são obrigatórios.
const{test}=require('node:test');const assert=require('node:assert/strict');
const{createClient}=require('@supabase/supabase-js');
const{readSupabaseConfig}=require('../src/lib/supabase-config.ts');
const{createOccurrenceService}=require('../src/services/occurrences.ts');
const{createOccurrencePhotos}=require('../src/services/occurrence-photos.ts');
const configured=['FALAAI_TEST_A_EMAIL','FALAAI_TEST_A_PASSWORD','FALAAI_TEST_B_EMAIL','FALAAI_TEST_B_PASSWORD','FALAAI_TEST_PROJECT_REF'].every(name=>!!process.env[name])&&process.env.FALAAI_STORAGE_TEST_APPROVED==='yes';
test('Storage real: criar, reconsultar, substituir, excluir e RLS A/B/anônimo', {skip:!configured&&'Requer credenciais A/B, project ref e autorização de fixtures no ambiente Node.'},async(t)=>{
 require('@expo/env').loadProjectEnv(process.cwd(),{mode:'development',silent:true});
 const config=readSupabaseConfig(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
 assert.ok(config&&config.projectRef===process.env.FALAAI_TEST_PROJECT_REF,'Confirme o project ref de teste, sem imprimir credenciais.');
 const fresh=()=>createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const a=fresh(),b=fresh(),reopened=fresh(),anon=fresh();
 const api=createOccurrenceService(a);const photos=createOccurrencePhotos(a);
 // Não processar a fila global: limpar somente fotos desta execução.
 const cleanupFixture=async(path)=>{
  await photos.abandon(path);
  const removed=await a.storage.from('occurrence-photos').remove([path]);
  assert.ok(!removed.error,'Não foi possível limpar a fotografia isolada.');
  const finished=await a.rpc('finish_occurrence_photo_cleanup',{p_path:path});
  assert.ok(!finished.error&&finished.data===true,'Limpeza da fotografia isolada pendente; conferir no painel.');
 };
 let fixture;
 const fixturePaths=[];
 t.after(async()=>{
  if(fixture){const cleanup=await a.from('occurrences').delete().eq('id',fixture);assert.ok(!cleanup.error,'Limpeza do relato de teste falhou. Conferir fixture no painel.');}
  for(const path of fixturePaths)await cleanupFixture(path);
  for(const client of [a,b,reopened,anon])await client.auth.signOut({scope:'local'});
 });
 for(const[client,prefix]of[[a,'A'],[b,'B'],[reopened,'A']]){
  const result=await client.auth.signInWithPassword({email:process.env[`FALAAI_TEST_${prefix}_EMAIL`],password:process.env[`FALAAI_TEST_${prefix}_PASSWORD`]});
  assert.ok(!result.error,'Login de teste falhou; valores omitidos.');
 }
 const userA=(await a.auth.getUser()).data.user;const userB=(await b.auth.getUser()).data.user;
 assert.ok(userA&&userB&&userA.id!==userB.id,'A/B devem ser contas distintas confirmadas.');
 const selected={uri:'fixture.png',mimeType:'image/png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB9kAAAAASUVORK5CYII='};
 const draft={categoryId:'outros',description:`Teste Storage Prova III ${Date.now()} com imagem de fixture.`,location:'Registro sintético de teste, sem GPS inventado',coordinates:null,photoChange:selected};
 const initialPath=await photos.upload(selected);fixturePaths.push(initialPath);
 const created=await api.create(draft,initialPath);fixture=created.id;assert.ok(created.photoPath);assert.ok(created.photoPath.startsWith(userA.id+'/'));
 const persisted=await createOccurrenceService(reopened).get(created.id);assert.equal(persisted.photoPath,created.photoPath);
 const signed=await photos.signedUrl(created.photoPath);
 const image=await fetch(signed);assert.equal(image.status,200);assert.ok((await image.arrayBuffer()).byteLength>0);
 assert.ok(await createOccurrencePhotos(b).signedUrl(created.photoPath),'B pode ler foto vinculada à ocorrência comunitária autorizada.');
 const publicResult=await fetch(config.url+'/storage/v1/object/public/occurrence-photos/'+created.photoPath);assert.ok(!publicResult.ok,'Bucket não deve servir URL pública.');
 const anonymous=await anon.storage.from('occurrence-photos').download(created.photoPath);assert.ok(anonymous.error,'Download sem sessão deve falhar.');
 const overwrite=await b.storage.from('occurrence-photos').upload(created.photoPath,new Uint8Array([137,80,78,71]).buffer,{contentType:'image/png',upsert:true});assert.ok(overwrite.error,'B não pode sobrescrever arquivo de A.');
 const foreignUpdate=await b.from('occurrences').update({description:'Tentativa indevida de modificar relato de outro autor.'}).eq('id',created.id).select('id');assert.ok(!foreignUpdate.error&&foreignUpdate.data.length===0,'B não pode editar relato de A.');
 // Não limpar ainda: permite testar DELETE de B sobre arquivo antigo real, já
 // desvinculado e elegível à limpeza, sem confundir bloqueio com arquivo ausente.
 const replacement=await photos.upload(selected);fixturePaths.push(replacement);
 const updated=await api.update(created.id,userA.id,{...draft,photoChange:undefined},replacement);
 assert.equal(updated.photoPath,replacement);assert.notEqual(replacement,created.photoPath);
 const forbidden=await b.storage.from('occurrence-photos').remove([created.photoPath]);assert.ok(forbidden.error||!forbidden.data?.some(item=>item.name===created.photoPath),'B excluiu foto de A.');
 const oldStillExists=await a.rpc('finish_occurrence_photo_cleanup',{p_path:created.photoPath});assert.ok(!oldStillExists.error&&oldStillExists.data===false,'Foto antiga deveria existir antes da limpeza de A.');
 const oldSign=await a.storage.from('occurrence-photos').createSignedUrl(created.photoPath,60);assert.ok(oldSign.error,'Foto desvinculada não pode gerar nova URL de download.');
 await cleanupFixture(created.photoPath);
 const oldGone=await a.rpc('finish_occurrence_photo_cleanup',{p_path:created.photoPath});assert.ok(!oldGone.error&&oldGone.data===true,'Limpeza da foto antiga não foi concluída.');
 const current=await createOccurrenceService(reopened).get(created.id);assert.equal(current.photoPath,replacement);
 const foreignDelete=await b.from('occurrences').delete().eq('id',created.id).select('id');assert.ok(!foreignDelete.error&&foreignDelete.data.length===0,'B não pode excluir relato de A.');
 await api.remove(created.id,userA.id);fixture=null;
 await cleanupFixture(replacement);
 assert.equal(await api.get(created.id),null);
 const newGone=await a.rpc('finish_occurrence_photo_cleanup',{p_path:replacement});assert.ok(!newGone.error&&newGone.data===true,'Arquivo da ocorrência excluída ainda aguarda limpeza.');
 const deniedFolder=await b.storage.from('occurrence-photos').upload(userA.id+'/00000000-0000-4000-8000-000000000000.png',new Uint8Array([137,80,78,71]).buffer,{contentType:'image/png'});assert.ok(deniedFolder.error,'B não pode enviar para a pasta de A.');
});
