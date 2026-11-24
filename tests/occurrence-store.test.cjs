const {test}=require('node:test');const assert=require('node:assert/strict');
const {createOccurrenceStore}=require('../src/services/occurrence-store.ts');
const report={id:'one',authorId:'a',description:'Descrição suficientemente longa.',createdAt:'2026-11-21T00:00:00Z'};
const draft={categoryId:'lixo',description:report.description,location:'Rua',coordinates:null};
function setup(overrides={}){const api={list:async()=>[report],get:async()=>report,create:async()=>report,update:async()=>({...report,description:'Descrição atualizada e persistida.'}),remove:async()=>{},...overrides};let state;const store=createOccurrenceStore(api,'a',value=>{state=value;});return{store,api,state:()=>state};}
test('create/update/delete compartilham somente respostas confirmadas com todas as telas',async()=>{
 const {store,state}=setup();await store.refresh();assert.equal(state().items.length,1);
 await store.update(report.id,draft);assert.match(state().items[0].description,/atualizada/);
 await store.remove(report.id);assert.deepEqual(state().items,[]);
 await store.create(draft);assert.equal(state().items[0].id,report.id);
});
test('erro mantém dados anteriores e distingue erro de lista vazia; retry recupera',async()=>{
 const {store,api,state}=setup();await store.refresh();api.list=async()=>{throw new Error('Sem conexão');};await store.refresh();assert.equal(state().items.length,1);assert.equal(state().error,'Sem conexão');assert.equal(state().loading,false);
 api.list=async()=>[];await store.refresh();assert.deepEqual(state().items,[]);assert.equal(state().error,null);
});
test('resposta de lista anterior à edição não sobrescreve versão confirmada',async()=>{
 let resolve;const {store,api,state}=setup();await store.refresh();api.list=()=>new Promise(done=>{resolve=done;});const pending=store.refresh();await store.update(report.id,draft);resolve([report]);await pending;assert.match(state().items[0].description,/atualizada/);assert.equal(state().loading,false);
});
test('logout/descarte impede respostas atrasadas e operações de outra sessão',async()=>{
 let resolve;const {store,state}=setup({list:()=>new Promise(done=>{resolve=done;})});const pending=store.refresh();const before=state();store.dispose();resolve([report]);await pending;assert.equal(state(),before);await assert.rejects(store.create(draft),/sessão/);
});
test('usuário não altera/exclui registro de outro e não envia mutação à API',async()=>{
 let calls=0;const {store}=setup({list:async()=>[{...report,authorId:'b'}],update:async()=>{calls++;},remove:async()=>{calls++;}});await store.refresh();await assert.rejects(store.update(report.id,draft),/proprietário/);await assert.rejects(store.remove(report.id),/proprietário/);assert.equal(calls,0);
});
test('duplo envio é bloqueado e falha não adiciona registro nem anuncia sucesso',async()=>{
 let reject;const {store,state}=setup({create:()=>new Promise((_resolve,no)=>{reject=no;})});const first=store.create(draft);await assert.rejects(store.create(draft),/Aguarde/);reject(new Error('Sem conexão'));await assert.rejects(first,/conexão/);assert.deepEqual(state().items,[]);
});
test('consulta por UUID atualiza cache e registro remoto excluído é removido',async()=>{
 const {store,api,state}=setup();await store.refresh();api.get=async()=>({...report,description:'Alterado externamente no servidor.'});await store.load(report.id);assert.match(state().items[0].description,/externamente/);api.get=async()=>null;assert.equal(await store.load(report.id),null);assert.deepEqual(state().items,[]);
});
test('falhas de edição/exclusão mantêm o registro confirmado e liberam nova tentativa',async()=>{
 const {store,api,state}=setup({update:async()=>{throw new Error('Sem conexão');},remove:async()=>{throw new Error('Sem conexão');}});await store.refresh();
 await assert.rejects(store.update(report.id,draft),/conexão/);assert.equal(state().items[0].description,report.description);
 await assert.rejects(store.remove(report.id),/conexão/);assert.equal(state().items.length,1);
 api.remove=async()=>{};await store.remove(report.id);assert.deepEqual(state().items,[]);
});
test('consulta atrasada não ressuscita ocorrência excluída',async()=>{
 let resolve;const {store,api,state}=setup();await store.refresh();api.get=()=>new Promise(done=>{resolve=done;});const old=store.load(report.id);await store.remove(report.id);resolve(report);assert.equal(await old,null);assert.deepEqual(state().items,[]);
});
test('última atualização da lista prevalece sobre consulta anterior fora de ordem',async()=>{
 const resolves=[];const {store,state}=setup({list:()=>new Promise(done=>resolves.push(done))});const first=store.refresh();const second=store.refresh();resolves[1]([{...report,description:'Última versão retornada pelo servidor.'}]);await second;resolves[0]([report]);await first;assert.match(state().items[0].description,/Última/);
});
test('mutação confirmada após troca de conta não publica dados nem sucesso na sessão anterior',async()=>{
 let resolve;const {store,state}=setup({create:()=>new Promise(done=>{resolve=done;})});const pending=store.create(draft);const before=state();store.dispose();resolve(report);await assert.rejects(pending,/sessão/);assert.equal(state(),before);
});
test('detalhes carregados durante listagem não fazem a lista perder os outros registros',async()=>{
 let resolve;const second={...report,id:'two'};const {store,state}=setup({list:()=>new Promise(done=>{resolve=done;}),get:async()=>({...report,description:'Versão mais recente dos detalhes.'})});const pending=store.refresh();await store.load(report.id);resolve([report,second]);await pending;assert.equal(state().items.length,2);assert.match(state().items.find(item=>item.id===report.id).description,/mais recente/);
});
test('consultas simultâneas de UUIDs diferentes não geram ausência falsa',async()=>{
 const resolves={};const {store,state}=setup({get:id=>new Promise(done=>{resolves[id]=done;})});const first=store.load('one');const second=store.load('two');resolves.one(report);await first;resolves.two({...report,id:'two'});assert.equal((await second).id,'two');assert.equal(state().items.length,2);
});
