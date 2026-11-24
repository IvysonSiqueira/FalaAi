const {test}=require('node:test');const assert=require('node:assert/strict');
const {deleteAccount}=require('../supabase/functions/delete-account/core.ts');
function fixture(overrides={}) {const calls=[];return {calls,deps:{enabled:true,verify:async()=>({id:'owner',email:'test@example.com'}),reauthenticate:async()=>true,prepare:async()=>({waiting:false,paths:['owner/file']}),remove:async()=>{calls.push('remove')},acknowledge:async()=>{},finish:async()=>{calls.push('finish');return true},deleteIdentity:async()=>{calls.push('identity')},...overrides}};}
const request={token:'test-token',password:'test-password',confirmation:'EXCLUIR MINHA CONTA'};
test('exclusão bloqueada por padrão antes de autenticar ou remover',async()=>{const {deps,calls}=fixture({enabled:false});assert.equal((await deleteAccount(request,deps)).status,503);assert.deepEqual(calls,[])});
test('token inválido não autoriza operação',async()=>{const{deps,calls}=fixture({verify:async()=>null});assert.equal((await deleteAccount(request,deps)).status,401);assert.deepEqual(calls,[])});
test('senha inválida não inicia exclusão',async()=>{const{deps,calls}=fixture({reauthenticate:async()=>false});assert.equal((await deleteAccount(request,deps)).status,401);assert.deepEqual(calls,[])});
test('limpeza precede conferência e identidade',async()=>{const{deps,calls}=fixture();assert.equal((await deleteAccount(request,deps)).status,200);assert.deepEqual(calls,['remove','finish','identity'])});
test('falha parcial mantém identidade e permite nova tentativa',async()=>{let first=true;const{deps,calls}=fixture({remove:async()=>{if(first){first=false;throw Error('private')}}});assert.equal((await deleteAccount(request,deps)).status,503);assert.deepEqual(calls,[]);assert.equal((await deleteAccount(request,deps)).status,200);assert.deepEqual(calls,['finish','identity'])});
test('espera de upload incerto não remove identidade ou arquivo',async()=>{const{deps,calls}=fixture({prepare:async()=>({waiting:true,paths:[]})});assert.equal((await deleteAccount(request,deps)).status,202);assert.deepEqual(calls,[])});
test('conferência inconclusiva não remove identidade',async()=>{const{deps,calls}=fixture({acknowledge:async()=>{},finish:async()=>false});assert.equal((await deleteAccount(request,deps)).status,202);assert.deepEqual(calls,['remove'])});
test('falha na remoção Auth não anuncia sucesso',async()=>{const{deps}=fixture({deleteIdentity:async()=>{throw Error('secret')}});const result=await deleteAccount(request,deps);assert.equal(result.status,503);assert.ok(!JSON.stringify(result).includes('secret'))});
test('confirmação obrigatória e caminho fora do proprietário bloqueado',async()=>{const{deps,calls}=fixture({prepare:async()=>({waiting:false,paths:['other/file']})});assert.equal((await deleteAccount(request,deps)).status,503);assert.deepEqual(calls,[]);assert.equal((await deleteAccount({...request,confirmation:''},deps)).status,400)});
test('destino deriva do usuário verificado, nunca de identificador no corpo',async()=>{
 let target;const{deps}=fixture({prepare:async(id)=>{target=id;return {waiting:true,paths:[]}}});
 await deleteAccount({...request,userId:'victim'},deps);assert.equal(target,'owner');
});
