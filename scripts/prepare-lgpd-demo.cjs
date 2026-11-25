// Node apenas: criação explicitamente autorizada de duas contas descartáveis.
const fs=require('node:fs');const {parseEnv}=require('node:util');const {randomUUID,randomBytes}=require('node:crypto');const {execFileSync}=require('node:child_process');
const {createClient}=require('@supabase/supabase-js');const {validateTarget,scopedFetch,apiKeyHeaders}=require('../tests/helpers/lgpd-target.cjs');
async function main(){
 if(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim()!=='codex/prova-iii-supabase')throw Error('BRANCH');
 const mainBefore=fs.readFileSync('.env.local');const config=validateTarget(parseEnv(fs.readFileSync('.env.lgpd-validacao.local','utf8')));
 if(config.ref!=='ilkprwaxszztejsasmcs'||config.runAuthorized)throw Error('TARGET_OR_FLAGS');
 const file='.env.lgpd-demo.local';execFileSync('git',['check-ignore','--quiet',file]);if(fs.existsSync(file))throw Error('DEMO_FILE_EXISTS');
 const net=scopedFetch(config.url);const make=key=>createClient(config.url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:net}});const admin=make(config.adminKey);
 const listed=await admin.auth.admin.listUsers({page:1,perPage:1000});if(listed.error)throw Error('INVENTORY');
 console.log(JSON.stringify({existingUsers:listed.data.users.length,existingUnconfirmed:listed.data.users.filter(u=>!u.email_confirmed_at).length}));
 const records=['A','B'].map(label=>({label,email:`lgpd-demo-${label.toLowerCase()}-${randomUUID()}@example.com`,password:randomBytes(24).toString('base64url')+'!#Aa9$'}));
 let content='# Contas de demonstração — somente projeto descartável. Não versionar.\nFALAAI_LGPD_PROJECT_REF='+config.ref+'\n';
 for(const r of records)content+=`DEMO_${r.label}_EMAIL=${JSON.stringify(r.email)}\nDEMO_${r.label}_PASSWORD=${JSON.stringify(r.password)}\n`;
 fs.writeFileSync(file,content,{mode:0o600,flag:'wx'});
 for(const r of records){const created=await admin.auth.admin.createUser({email:r.email,password:r.password,email_confirm:true,user_metadata:{name:'Demonstração '+r.label,privacy_accepted:true,privacy_version:'2026-11-24-v1'}});if(created.error)throw Error('CREATE_'+r.label);r.id=created.data.user.id;fs.appendFileSync(file,`DEMO_${r.label}_USER_ID=${JSON.stringify(r.id)}\n`);
 const client=make(config.publicKey);const login=await client.auth.signInWithPassword({email:r.email,password:r.password});if(login.error||login.data.user?.id!==r.id)throw Error('LOGIN_'+r.label);
 const profile=await client.from('profiles').select('id').eq('id',r.id).single();const consent=await client.from('privacy_acceptances').select('version,accepted_at').eq('user_id',r.id).single();
 console.log(JSON.stringify({account:r.label,created:true,confirmed:!!created.data.user.email_confirmed_at,publicLogin:true,profile:!profile.error,serverConsent:!consent.error&&consent.data?.version==='2026-11-24-v1'&&!!consent.data?.accepted_at}));
 await client.auth.signOut({scope:'local'});
 }
 const response=await net(config.url+'/functions/v1/delete-account',{method:'POST',headers:apiKeyHeaders(config.publicKey)});let state;try{state=(await response.json()).state}catch{}console.log(JSON.stringify({deletionHttp:response.status,deletionDisabled:state==='disabled',mainEnvUnchanged:mainBefore.equals(fs.readFileSync('.env.local')),credentialsIgnored:true}));
}
main().catch(()=>{console.error('Operação interrompida; detalhes sensíveis omitidos. Verifique o arquivo local antes de repetir.');process.exitCode=1;});
