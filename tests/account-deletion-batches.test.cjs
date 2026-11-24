const {test}=require('node:test');const assert=require('node:assert/strict');
const {deleteAccount}=require('../supabase/functions/delete-account/core.ts');
const input={token:'synthetic',password:'synthetic',confirmation:'EXCLUIR MINHA CONTA'};
// Modelo de falhas de Storage e registro durável. Não substitui a suíte SQL/Storage.
function backend(count){
 const rows=new Map(Array.from({length:count},(_,i)=>['owner/'+String(i).padStart(4,'0'),'owner']));
 rows.set('other/protected','other');const objects=new Set(rows.keys());let deleted=false;let failAfter=null;let ackFails=false;const selected=[];
 return {rows,objects,selected,get deleted(){return deleted},set failAfter(v){failAfter=v},set ackFails(v){ackFails=v},
 deps:{enabled:true,verify:async()=>deleted?null:{id:'owner',email:'fixture@example.invalid'},reauthenticate:async()=>true,
 prepare:async()=>{const paths=[...rows.keys()].filter(p=>rows.get(p)==='owner').slice(0,100);selected.push(paths);return {waiting:false,paths}},
 remove:async paths=>{for(let i=0;i<paths.length;i++){if(failAfter!==null&&i===failAfter){failAfter=null;throw Error('Interrupted')}objects.delete(paths[i]);}},
 acknowledge:async(id,paths)=>{if(ackFails)throw Error('Response lost');for(const p of paths){assert.equal(rows.get(p)??id,id);if(!objects.has(p))rows.delete(p)}},
 finish:async id=>{if([...objects].some(p=>p.startsWith(id+'/')))return false;for(const[p,owner]of rows)if(owner===id)rows.delete(p);return true},
 deleteIdentity:async id=>{assert.equal(id,'owner');assert.ok(![...objects].some(p=>p.startsWith('owner/')));deleted=true},
 }};
}
async function drain(b){let result;for(let i=0;i<8;i++){result=await deleteAccount(input,b.deps);if(result.status===200)return result;}assert.fail('Não houve progresso nos lotes');}
for(const count of [0,1,100,101,250])test(`exclusão avança e termina com ${count} fotografias`,async()=>{const b=backend(count);assert.equal((await drain(b)).state,'deleted');assert.ok(b.deleted);assert.ok(b.objects.has('other/protected'));assert.ok(b.rows.has('other/protected'));if(count>100)assert.notDeepEqual(b.selected[0],b.selected[1]);});
test('falha no meio do lote confirma apenas arquivos ausentes e retoma',async()=>{const b=backend(250);b.failAfter=37;assert.equal((await deleteAccount(input,b.deps)).status,503);assert.equal([...b.rows.values()].filter(x=>x==='owner').length,213);assert.ok(!b.deleted);await drain(b);assert.ok(b.deleted)});
test('interrupção após Storage e antes do ACK pode repetir o mesmo lote com segurança',async()=>{const b=backend(101);b.ackFails=true;assert.equal((await deleteAccount(input,b.deps)).status,503);assert.ok(!b.deleted);b.ackFails=false;await drain(b);assert.ok(b.deleted);assert.ok(b.objects.has('other/protected'))});
test('remover retorna sucesso mas deixa arquivo: identidade permanece',async()=>{const b=backend(1);b.deps.remove=async()=>{};assert.equal((await deleteAccount(input,b.deps)).status,202);assert.ok(!b.deleted);assert.ok(b.rows.has('owner/0000'))});
test('chamadas repetidas após conclusão não removem outro proprietário',async()=>{const b=backend(1);await drain(b);assert.equal((await deleteAccount(input,b.deps)).status,401);assert.ok(b.objects.has('other/protected'))});
test('chamadas concorrentes sobre o mesmo lote são seguras e recuperáveis',async()=>{const b=backend(250);await Promise.all([deleteAccount(input,b.deps),deleteAccount(input,b.deps)]);assert.ok(!b.deleted);await drain(b);assert.ok(b.deleted);assert.ok(b.objects.has('other/protected'))});
test('lote de outro proprietário é recusado antes da API Storage',async()=>{const b=backend(1);let removed=false;b.deps.prepare=async()=>({waiting:false,paths:['other/protected']});b.deps.remove=async()=>{removed=true};assert.equal((await deleteAccount(input,b.deps)).status,503);assert.equal(removed,false);assert.ok(b.objects.has('other/protected'))});
