const {test}=require('node:test');const assert=require('node:assert/strict');
const{createClient}=require('@supabase/supabase-js');const{scopedFetch,apiKeyHeaders}=require('./helpers/lgpd-target.cjs');
const origin='https://'+'z'.repeat(20)+'.supabase.co';
for(const kind of ['sb_secret_synthetic','sb_publishable_synthetic'])test('SDK sem sessão envia nova API key só em apikey ('+(kind.startsWith('sb_secret')?'secret':'publishable')+')',async()=>{
 const seen=[];const fake=scopedFetch(origin,async(_url,options)=>{seen.push(new Headers(options.headers));return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}})});
 const client=createClient(origin,kind,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:fake}});
 await client.from('synthetic_table').select('id');assert.equal(seen.length,1);assert.equal(seen[0].get('apikey'),kind);assert.equal(seen[0].has('Authorization'),false);assert.match(seen[0].get('User-Agent'),/Node/);
});
test('Auth admin do SDK usa secret sem Bearer opaco — transporte simulado',async()=>{
 let headers;const client=createClient(origin,'sb_secret_synthetic',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:scopedFetch(origin,async(_url,init)=>{headers=new Headers(init.headers);return new Response('{"users":[]}',{status:200,headers:{'Content-Type':'application/json'}})})}});
 await client.auth.admin.listUsers();assert.equal(headers.get('apikey'),'sb_secret_synthetic');assert.equal(headers.has('Authorization'),false);
});
test('transporte preserva JWT do usuário e JWT legado service_role',async()=>{
 for(const[key,bearer]of[['sb_publishable_synthetic','synthetic.user.jwt'],['synthetic.legacy.jwt','synthetic.legacy.jwt']]){
  const fetcher=scopedFetch(origin,async(_url,init)=>{const h=new Headers(init.headers);assert.equal(h.get('Authorization'),'Bearer '+bearer);return new Response('{}')});
  await fetcher(origin+'/rest/v1/',{headers:{apikey:key,Authorization:'Bearer '+bearer}});
 }
});
test('GET avulso usa apikey, User-Agent de Node e nenhum Bearer',()=>{const h=apiKeyHeaders('sb_secret_synthetic');assert.equal(h.get('apikey'),'sb_secret_synthetic');assert.equal(h.has('Authorization'),false);assert.match(h.get('User-Agent'),/Node/);assert.ok(!/Mozilla|Chrome|Safari/.test(h.get('User-Agent')))});
test('Bearer opaco divergente é bloqueado antes da rede',async()=>{let called=false;const fetcher=scopedFetch(origin,async()=>{called=true});await assert.rejects(fetcher(origin+'/rest/v1/',{headers:{apikey:'sb_secret_synthetic',Authorization:'Bearer sb_secret_other'}}));assert.equal(called,false)});
