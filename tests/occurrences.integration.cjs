// Teste remoto OPT-IN: duas contas de teste já confirmadas, nunca service_role.
// Executar separadamente: node --test tests/occurrences.integration.cjs
// Credenciais somente no ambiente do processo Node; NÃO usar EXPO_PUBLIC_* para senhas.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js');
const {readSupabaseConfig}=require('../src/lib/supabase-config.ts');
const {createOccurrenceService}=require('../src/services/occurrences.ts');
const names=['FALAAI_TEST_A_EMAIL','FALAAI_TEST_A_PASSWORD','FALAAI_TEST_B_EMAIL','FALAAI_TEST_B_PASSWORD','FALAAI_TEST_PROJECT_REF'];
const configured=names.every(name=>!!process.env[name]);
test('Supabase real: persistência, CRUD e RLS entre A/B e anônimo', {skip:!configured&&'Requer duas contas de teste confirmadas no ambiente Node; não executado automaticamente.'},async(t)=>{
 require('@expo/env').loadProjectEnv(process.cwd(),{mode:'development',silent:true});
 const config=readSupabaseConfig(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
 assert.ok(config&&config.projectRef===process.env.FALAAI_TEST_PROJECT_REF,'Confirme o project ref antes dos testes remotos.');
 const fresh=()=>createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const a=fresh(),b=fresh(),reopened=fresh(),anon=fresh();
 const clients=[a,b,reopened,anon];const fixtures=[];
 t.after(async()=>{
  for(const id of fixtures) {const result=await a.from('occurrences').delete().eq('id',id);assert.ok(!result.error,'Não foi possível limpar uma fixture; conferir teste no painel.');}
  for(const client of clients) await client.auth.signOut({scope:'local'});
 });
 for(const [client,prefix] of [[a,'A'],[b,'B'],[reopened,'A']]){
  const result=await client.auth.signInWithPassword({email:process.env[`FALAAI_TEST_${prefix}_EMAIL`],password:process.env[`FALAAI_TEST_${prefix}_PASSWORD`]});
  assert.ok(!result.error,`Login da conta de teste ${prefix} falhou; valores omitidos.`);
 }
 const userA=(await a.auth.getUser()).data.user;const userB=(await b.auth.getUser()).data.user;
 assert.ok(userA&&userB&&userA.id!==userB.id,'As contas A/B precisam ser diferentes.');
 const api=createOccurrenceService(a);
 const draft={categoryId:'outros',description:`Teste automatizado CRUD/RLS ${Date.now()}: remover após validar.`,location:'Fixture acadêmica de teste, sem posição fictícia',coordinates:null};
 const created=await api.create(draft);fixtures.push(created.id);
 assert.equal(created.authorId,userA.id,'Proprietário precisa vir do token no servidor.');
 const restored=await createOccurrenceService(reopened).get(created.id);
 assert.equal(restored.description,draft.description,'Nova instância precisa recuperar registro persistido.');
 assert.ok((await createOccurrenceService(b).get(created.id)),'Leitura comunitária autorizada esperada.');
 const changed=await api.update(created.id,userA.id,{...draft,description:'Descrição atualizada no teste remoto do proprietário.'});
 assert.match(changed.description,/atualizada/);
 // Consultas diretas, sem filtros de proprietário da UI, para provar RLS remoto.
 const badUpdate=await b.from('occurrences').update({description:'Tentativa indevida de outro usuário no teste remoto.'}).eq('id',created.id).select('id');
 assert.ok(!badUpdate.error,'Consulta de update RLS falhou de forma inesperada.');
 assert.deepEqual(badUpdate.data,[],'B conseguiu alterar ocorrência de A.');
 const ownerChange=await b.from('occurrences').update({author_id:userB.id}).eq('id',created.id).select('id');
 assert.ok(ownerChange.error||ownerChange.data?.length===0,'B conseguiu transferir a propriedade de A.');
 assert.equal((await api.get(created.id)).authorId,userA.id,'Proprietário foi alterado indevidamente.');
 // Mesmo o proprietário não pode transferir autoria pelo cliente.
 const ownTransfer=await a.from('occurrences').update({author_id:userB.id}).eq('id',created.id).select('id');
 assert.ok(ownTransfer.error||ownTransfer.data?.length===0,'Cliente conseguiu transferir autoria.');
 assert.equal((await api.get(created.id)).authorId,userA.id);
 const badDelete=await b.from('occurrences').delete().eq('id',created.id).select('id');
 assert.ok(!badDelete.error,'Consulta de delete RLS falhou de forma inesperada.');
 assert.deepEqual(badDelete.data,[],'B conseguiu excluir ocorrência de A.');
 assert.equal((await api.get(created.id)).description,changed.description);
 const forged=await b.from('occurrences').insert({author_id:userA.id,category_id:'outros',description:draft.description,location:draft.location}).select('id');
 if(forged.data)fixtures.push(...forged.data.map(row=>row.id));
 assert.ok(forged.error,'Coluna author_id não deve ser gravável pelo cliente.');
 const anonymous=await anon.from('occurrences').select('id').eq('id',created.id);
 assert.ok(anonymous.error,'Leitura anônima deveria ser proibida.');
 await api.remove(created.id,userA.id);fixtures.splice(fixtures.indexOf(created.id),1);
 assert.equal(await createOccurrenceService(reopened).get(created.id),null,'Exclusão precisa persistir.');
});
