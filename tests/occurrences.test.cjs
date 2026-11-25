const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createOccurrenceService, toOccurrence } = require('../src/services/occurrences.ts');
const draft = { categoryId: 'buraco', description: 'Um buraco perigoso na rua principal.', location: 'Rua principal', coordinates: { latitude: 0, longitude: -35 } };
const row = { id: '11111111-1111-4111-8111-111111111111', author_id: 'owner-a', category_id: 'buraco', description: draft.description, location: draft.location, latitude: 0, longitude: -35, photo_path: 'file:///not-remote.jpg', status: 'Aberta', created_at: '2026-11-21T00:00:00Z', updated_at: '2026-11-21T00:00:00Z' };
function fake(results) {
 const calls=[];
 const client={from(table){calls.push(['from',table]);const q={};for(const method of ['select','insert','update','delete','eq','order','range','single','maybeSingle'])q[method]=(...args)=>{calls.push([method,...args]);return q;};q.then=(yes,no)=>Promise.resolve(results.shift()).then(yes,no);return q;}};
 return {client,calls};
}
test('criação envia somente campos permitidos, sem proprietário, foto local, status ou ID', async()=>{
 const {client,calls}=fake([{data:row,error:null}]);
 const result=await createOccurrenceService(client).create({...draft,author_id:'forged',photo:'file:///local.jpg',status:'Resolvida',id:'forged'});
 assert.equal(result.id,row.id);
 assert.deepEqual(calls.find(c=>c[0]==='insert')[1],{category_id:'buraco',description:draft.description,location:draft.location,latitude:0,longitude:-35});
 assert.equal(result.photo,null);
});
test('nova consulta recupera o registro persistido, mantém coordenada zero e nunca trata photo_path como URL', async()=>{
 const {client}=fake([{data:[row],error:null},{data:row,error:null}]);
 const service=createOccurrenceService(client);
 const list=await service.list();
 assert.equal(list[0].coordinates.latitude,0);
 assert.equal(list[0].photo,null);
 assert.deepEqual(await service.get(row.id),list[0]);
 assert.equal(toOccurrence({...row,latitude:null,longitude:null}).coordinates,null);
});
test('listagem pagina até o fim para não truncar indicadores no limite do servidor', async()=>{
 const {client,calls}=fake([{data:Array.from({length:500},(_,index)=>({...row,id:`row-${index}`})),error:null},{data:[{...row,id:'last'}],error:null}]);
 assert.equal((await createOccurrenceService(client).list()).length,501);
 assert.deepEqual(calls.filter(c=>c[0]==='range'),[['range',0,499],['range',500,999]]);
});
test('edição restringe UUID e proprietário e retorna versão confirmada pelo servidor', async()=>{
 const {client,calls}=fake([{data:{...row,description:'Descrição atualizada depois da confirmação.'},error:null}]);
 const result=await createOccurrenceService(client).update(row.id,'owner-a',draft);
 assert.match(result.description,/atualizada/);
 assert.deepEqual(calls.filter(c=>c[0]==='eq'),[['eq','id',row.id],['eq','author_id','owner-a']]);
 assert.ok(!('photo_path' in calls.find(c=>c[0]==='update')[1]));
});
test('exclusão exige uma linha retornada: ação bloqueada por RLS nunca vira sucesso', async()=>{
 const {client}=fake([{data:[],error:null},{data:[{id:row.id}],error:null}]);
 const service=createOccurrenceService(client);
 await assert.rejects(service.remove(row.id,'owner-b'),/não encontrada|permissão/);
 await service.remove(row.id,'owner-a');
});
test('edição de outro usuário sem linha afetada falha e leitura ausente retorna null', async()=>{
 const {client}=fake([{data:null,error:null},{data:null,error:null}]);
 const service=createOccurrenceService(client);
 await assert.rejects(service.update(row.id,'owner-b',draft),/não encontrada|permissão/);
 assert.equal(await service.get(row.id),null);
});
test('rede/erros de banco não são confundidos com lista vazia nem expõem detalhes internos', async()=>{
 const {client}=fake([{data:null,error:{code:'42501',message:'private db detail'}}]);
 await assert.rejects(createOccurrenceService(client).list(),e=>/permissão/.test(e.message)&&!e.message.includes('private'));
 const failed={from(){throw new TypeError('Network request failed');}};
 await assert.rejects(createOccurrenceService(failed).create(draft),/conexão/);
});
test('validação rejeita descrição, categoria, localização e coordenadas inválidas antes da rede',async()=>{
 const {client,calls}=fake([]);const service=createOccurrenceService(client);
 for(const value of [{...draft,description:'curta'},{...draft,categoryId:'invalid'},{...draft,location:'',coordinates:null},{...draft,coordinates:{latitude:91,longitude:0}},{...draft,description:'a'.repeat(401)}]) await assert.rejects(service.create(value));
 assert.equal(calls.length,0);
});
test('photo_path remoto é recuperado sem persistir a URL assinada ou os bytes',async()=>{
 const path='11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.png';
 const{client,calls}=fake([{data:{...row,photo_path:path},error:null},{data:{...row,photo_path:null},error:null}]);const api=createOccurrenceService(client);
 const result=await api.create({...draft,photoChange:{base64:'bytes-local',uri:'file:///local.png'}},path);
 assert.equal(result.photoPath,path);assert.equal(result.photo,null);
 assert.equal(calls.find(c=>c[0]==='insert')[1].photo_path,path);
 assert.ok(!JSON.stringify(calls).includes('bytes-local'));
 await api.update(row.id,'owner-a',draft,null);assert.equal(calls.find(c=>c[0]==='update')[1].photo_path,null);
});
