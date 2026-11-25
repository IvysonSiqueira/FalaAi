// Validação de desenvolvimento somente no Metro local. Não imprime ou salva bundle.
const fs=require('node:fs');const path=require('node:path');const{parseEnv}=require('node:util');
const root=path.resolve(__dirname,'..');
(async()=>{
 let probe,createdProbe=false;
 try {
 const {randomUUID}=require('node:crypto');
 const sentinel='FALAAI_PRIVATE_METRO_PROBE_'+randomUUID();
 probe=path.join(root,'.env.lgpd-fixtures-regression-'+randomUUID()+'.local');
 fs.writeFileSync(probe,JSON.stringify({privateProbe:sentinel,fixtures:[]}),{flag:'wx',mode:0o600});
 createdProbe=true;
 const query='platform=android&dev=true&minify=false&lazy=false';
 const bundleResponse=await fetch('http://127.0.0.1:8081/index.bundle?'+query,{signal:AbortSignal.timeout(120000)});
 if(bundleResponse.status!==200){console.log(JSON.stringify({android_dev_http:bundleResponse.status,passed:false}));process.exitCode=1;return;}
 const bundle=await bundleResponse.text();
 const mapResponse=await fetch('http://127.0.0.1:8081/index.map?'+query,{signal:AbortSignal.timeout(120000)});
 if(mapResponse.status!==200){console.log(JSON.stringify({android_dev_http:200,map_http:mapResponse.status,passed:false}));process.exitCode=1;return;}
 const map=await mapResponse.json();
 const sources=(map.sources||[]).map(s=>String(s).replace(/\\/g,'/'));
 const lazyResponse=await fetch('http://127.0.0.1:8081/index.bundle?platform=android&dev=true&minify=false&lazy=true&hot=false&transform.engine=hermes',{signal:AbortSignal.timeout(120000)});
 const lazyBundle=await lazyResponse.text();
 const content=bundle+'\n'+lazyBundle+'\n'+(map.sourcesContent||[]).join('\n');
 const sensitive=[];
 for(const name of ['.env.lgpd-validacao.local','.env.rls-test.local','.env.rls-test.local.bak','.env.local']){
  if(!fs.existsSync(path.join(root,name)))continue;
  const env=parseEnv(fs.readFileSync(path.join(root,name),'utf8'));
  for(const [key,value] of Object.entries(env))if(/PASSWORD|TOKEN|ADMIN_KEY|SECRET_KEY|SERVICE_ROLE/i.test(key)&&typeof value==='string'&&value.length>=8)sensitive.push(value);
 }
 const project=parseEnv(fs.readFileSync(path.join(root,'.env.lgpd-validacao.local'),'utf8'));
 const main=parseEnv(fs.readFileSync(path.join(root,'.env.local'),'utf8'));
 const projectRoot=root.replace(/\\/g,'/');
 const internalSource=sources.some(s=>{
  // Metro source paths may be relative, absolute or prefixed by [project]/.
  const p=s.startsWith(projectRoot+'/')?s.slice(projectRoot.length+1):s.replace(/^\[project\]\//,'');
  return /(^|\/)\.env[^/]*$/.test(p)||/^(scripts|tests|supabase|docs|\.artifacts|\.git)\//.test(p)||/\.(bak|backup|orig|tmp)$/.test(p);
 });
 const secretPresent=sensitive.some(v=>content.includes(v)||content.includes(JSON.stringify(v).slice(1,-1)));
 const result={android_dev_http:200,android_dev_lazy_hermes_http:lazyResponse.status,map_http:200,source_count:sources.length,
  legacy_json_probe_excluded:!content.includes(sentinel),
  artifacts_present:fs.existsSync(path.join(root,'.artifacts/lgpd')),
  no_internal_sources:!internalSource,no_known_credentials:!secretPresent,
  disposable_url_present:bundle.includes(project.FALAAI_LGPD_URL),
  disposable_public_key_present:bundle.includes(project.FALAAI_LGPD_PUBLISHABLE_KEY),
  main_url_absent:!main.EXPO_PUBLIC_SUPABASE_URL||!bundle.includes(main.EXPO_PUBLIC_SUPABASE_URL),
 };
 result.passed=lazyResponse.status===200&&result.legacy_json_probe_excluded&&result.artifacts_present&&result.no_internal_sources&&result.no_known_credentials&&result.disposable_url_present&&result.disposable_public_key_present&&result.main_url_absent;
 console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;
 } finally { if(createdProbe)fs.unlinkSync(probe); }
})().catch(()=>{console.log('Validação local falhou; nenhum bundle, credencial ou resposta bruta foi exibido.');process.exitCode=1;});
