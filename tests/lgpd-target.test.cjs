const{test}=require('node:test');const assert=require('node:assert/strict');
const{validateTarget,PRIMARY_PROJECT_REF,scopedFetch}=require('./helpers/lgpd-target.cjs');
const ref='z'.repeat(20);
const config=()=>({FALAAI_LGPD_PROJECT_NAME:'falaai-lgpd-validacao',FALAAI_LGPD_PROJECT_REF:ref,FALAAI_LGPD_URL:`https://${ref}.supabase.co`,FALAAI_LGPD_PUBLISHABLE_KEY:'sb_publishable_synthetic',FALAAI_LGPD_ADMIN_KEY:'sb_secret_synthetic',FALAAI_LGPD_ALLOW_TESTS:'',FALAAI_LGPD_ALLOW_FIXTURE_DELETION:''});
test('preflight valida destino sem autorizar operações',()=>{const c=validateTarget(config());assert.equal(c.ref,ref);assert.equal(c.runAuthorized,false)});
test('bloqueia explicitamente o projeto principal mesmo com confirmações',()=>{const c=config();c.FALAAI_LGPD_PROJECT_REF=PRIMARY_PROJECT_REF;c.FALAAI_LGPD_URL=`https://${PRIMARY_PROJECT_REF}.supabase.co`;assert.throws(()=>validateTarget(c),/principal/)});
test('ref divergente, nome incorreto e campo ausente são recusados',()=>{for(const change of [{FALAAI_LGPD_PROJECT_REF:'y'.repeat(20)},{FALAAI_LGPD_PROJECT_NAME:'falaai-prova3'},{FALAAI_LGPD_ADMIN_KEY:''}])assert.throws(()=>validateTarget({...config(),...change}))});
test('nega URL com credencial, caminho, query, porta, domínio arbitrário ou HTTP',()=>{for(const url of [`http://${ref}.supabase.co`,`https://${ref}.supabase.co/rest/v1`,`https://${ref}.supabase.co/?x=1`,`https://user:pass@${ref}.supabase.co`,`https://${ref}.supabase.co:444`,`https://${ref}.example.com`])assert.throws(()=>validateTarget({...config(),FALAAI_LGPD_URL:url}))});
test('execução exige as duas autorizações e chave pública não administrativa',()=>{assert.throws(()=>validateTarget(config(),true),/autorização/);const c={...config(),FALAAI_LGPD_ALLOW_TESTS:'yes',FALAAI_LGPD_ALLOW_FIXTURE_DELETION:'yes'};assert.equal(validateTarget(c,true).runAuthorized,true);assert.throws(()=>validateTarget({...c,FALAAI_LGPD_PUBLISHABLE_KEY:'sb_secret_synthetic'}))});
test('fetch recusa outro host antes da rede e bloqueia redirecionamento',async()=>{let calls=0;const fetcher=scopedFetch(`https://${ref}.supabase.co`,async(_url,options)=>{calls++;assert.equal(options.redirect,'error');return new Response('{}')});await assert.rejects(fetcher('https://example.invalid'));assert.equal(calls,0);await fetcher(`https://${ref}.supabase.co/auth/v1/user`);assert.equal(calls,1)});
test('também bloqueia o destino principal lido do aplicativo se ele mudar',()=>{assert.throws(()=>validateTarget(config(),false,ref),/principal/)});
test('service_role legada deve declarar papel e ref do descartável',()=>{
 const jwt=claims=>'header.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.synthetic';
 assert.equal(validateTarget({...config(),FALAAI_LGPD_ADMIN_KEY:jwt({role:'service_role',ref})}).ref,ref);
 for(const claims of [{role:'authenticated',ref},{role:'service_role',ref:PRIMARY_PROJECT_REF}])assert.throws(()=>validateTarget({...config(),FALAAI_LGPD_ADMIN_KEY:jwt(claims)}));
});
