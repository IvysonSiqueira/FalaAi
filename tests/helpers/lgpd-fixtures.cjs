// Escopo exclusivo de testes Node; não importar no aplicativo.
function fixtureScope(persist=()=>{}){
 const records=new Map();const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
 const snapshot=()=>[...records].map(([id,paths])=>({id,paths:[...paths]}));
 function requireUser(id){if(!records.has(id))throw Error('Fixture fora do manifesto');return id;}
 return {snapshot,requireUser,
 addUser(id){if(!uuid.test(id)||records.has(id))throw Error('UUID de fixture inválido');records.set(id,new Set());persist(snapshot());return id;},
 addPath(id,path){requireUser(id);if(typeof path!=='string'||!path.startsWith(id+'/')||!uuid.test(path.split('/')[1]?.replace(/\.(jpg|png|webp)$/,''))||!new RegExp('^'+id+'/[0-9a-f-]{36}\\.(jpg|png|webp)$').test(path))throw Error('Caminho fora da fixture');records.get(id).add(path);persist(snapshot());return path;},
 requirePath(id,path){requireUser(id);if(!records.get(id).has(path))throw Error('Arquivo fora do manifesto');return path;},
 };
}
module.exports={fixtureScope};
