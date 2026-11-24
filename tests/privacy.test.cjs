const {test}=require('node:test');const assert=require('node:assert/strict');
const {PRIVACY_VERSION,PRIVACY_NOTICE,privacyRegistration}=require('../src/lib/privacy.ts');
const {createAuthService}=require('../src/services/auth.ts');
test('aceite explícito envia versão sem data escolhida pelo cliente',async()=>{
 let input;const client={auth:{signUp:async(v)=>{input=v;return {data:{session:null,user:{identities:[{}]}},error:null}}}};
 await createAuthService(client).registerUser({name:'Teste',email:'teste@example.com',password:'teste12345',privacyVersion:PRIVACY_VERSION});
 assert.equal(input.options.data.privacy_version,PRIVACY_VERSION);assert.equal(input.options.data.privacy_accepted,true);
 assert.equal(input.options.data.privacy_accepted_at,undefined);
});
test('aviso informa dados, Supabase, comunidade e limitações',()=>{
 for(const term of ['Supabase','GPS','fotografias','Outros usuários autenticados','backups'])assert.ok(PRIVACY_NOTICE.includes(term));
});

test('aceite não marcado é recusado e somente aceite explícito produz metadata',()=>{assert.throws(()=>privacyRegistration(false),/aceite/);assert.deepEqual(privacyRegistration(true),{privacyVersion:PRIVACY_VERSION})});
