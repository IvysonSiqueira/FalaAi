// Exclusivamente Node/testes. Este módulo nunca deve ser importado pelo aplicativo.
const PRIMARY_PROJECT_REF = 'wxmsqhmifqvtrlgosrjp';
function validateTarget(env,requireRun=false,additionalPrimaryRef){
 const read=name=>typeof env[name]==='string'?env[name].trim():'';
 const ref=read('FALAAI_LGPD_PROJECT_REF');
 if(ref===PRIMARY_PROJECT_REF||ref===additionalPrimaryRef)throw Error('Projeto principal explicitamente bloqueado.');
 if(!/^[a-z0-9]{20}$/.test(ref))throw Error('Project Ref descartável ausente ou inválido.');
 if(read('FALAAI_LGPD_PROJECT_NAME')!=='falaai-lgpd-validacao')throw Error('Confirme o nome do projeto descartável.');
 let url;try{url=new URL(read('FALAAI_LGPD_URL'))}catch{throw Error('URL descartável inválida.')}
 if(url.protocol!=='https:'||url.hostname!==ref+'.supabase.co'||url.port||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('URL não corresponde exatamente ao Project Ref aprovado.');
 const publicKey=read('FALAAI_LGPD_PUBLISHABLE_KEY');const adminKey=read('FALAAI_LGPD_ADMIN_KEY');
 if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey))throw Error('Publishable Key descartável ausente ou inválida.');
 if(!/^sb_secret_[A-Za-z0-9_-]+$/.test(adminKey)){
  let claims;try{claims=JSON.parse(Buffer.from(adminKey.split('.')[1],'base64url').toString())}catch{}
  // Checagem de escopo, não valida assinatura. A autenticação real cabe ao Supabase.
  if(!claims||claims.role!=='service_role'||claims.ref!==ref)throw Error('Chave administrativa descartável ausente ou incompatível.');
 }
 const runAuthorized=read('FALAAI_LGPD_ALLOW_TESTS')==='yes'&&read('FALAAI_LGPD_ALLOW_FIXTURE_DELETION')==='yes';
 if(requireRun&&!runAuthorized)throw Error('Execução bloqueada: falta autorização explícita de testes e limpeza de fixtures.');
 return Object.freeze({ref,url:url.origin,publicKey,adminKey,runAuthorized});
}
const NODE_USER_AGENT = 'FalaAi-LGPD-Node/' + process.versions.node;
function apiKeyHeaders(key){
 // GET de preflight: API key não é sessão e não deve ser tratada como JWT.
 return new Headers({apikey:key,Accept:'application/json','User-Agent':NODE_USER_AGENT});
}
function scopedFetch(origin,fetcher=globalThis.fetch){
 return async(input,options={})=>{
  const target=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  if(target.origin!==origin||target.username||target.password)throw Error('Rede bloqueada: destino fora do projeto descartável.');
  const headers=new Headers(options.headers??(typeof input==='object'&&!(input instanceof URL)?input.headers:undefined));
  const key=headers.get('apikey');const bearer=headers.get('Authorization');
  if(bearer&&/^Bearer sb_(secret|publishable)_/i.test(bearer)){
   if(bearer!=='Bearer '+key)throw Error('Bearer opaco divergente da API key; requisição bloqueada.');
   // supabase-js 2.119.2 usa fallback opaco em Auth/REST. Corrigir somente
   // o executor Node; JWTs reais de sessão e service_role legado ficam intactos.
   headers.delete('Authorization');
  }
  headers.set('User-Agent',NODE_USER_AGENT);
  try{return await fetcher(input,{...options,headers,redirect:'error'})}catch{throw Error('Falha de rede no ambiente descartável; detalhes omitidos.')}
 };
}
module.exports={PRIMARY_PROJECT_REF,validateTarget,scopedFetch,apiKeyHeaders};
