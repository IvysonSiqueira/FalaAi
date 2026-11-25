// Não muda arquivos de ambiente, não habilita função remota e não executa exclusão.
const fs=require('node:fs');const{parseEnv}=require('node:util');const{spawn,spawnSync}=require('node:child_process');
const path=require('node:path');const net=require('node:net');const{lgpdUiEnvironment}=require('./helpers/lgpd-ui-env.cjs');
const root=path.resolve(__dirname,'..');process.chdir(root);
try{
 if(process.argv.length>3||(process.argv[2]&&process.argv[2]!=='--check'))throw Error();
 if(spawnSync('git',['branch','--show-current'],{encoding:'utf8'}).stdout.trim()!=='codex/prova-iii-supabase')throw Error();
 if(spawnSync('git',['check-ignore','--quiet','--','.env.lgpd-validacao.local']).status!==0)throw Error();
 const metro=require(path.join(root,'metro.config.js'));
 const rules=metro.resolver.blockList;
 const protectedPaths=['.env.local','.env.lgpd-validacao.local','.env.rls-test.local.bak','.artifacts/lgpd/probe.json','scripts/probe.cjs','tests/probe.cjs','supabase/functions/probe.js'];
 if(!Array.isArray(rules)||!protectedPaths.every(file=>rules.some(rule=>rule.test(path.join(root,file)))))throw Error();
 const values=parseEnv(fs.readFileSync('.env.lgpd-validacao.local','utf8'));
 const env=lgpdUiEnvironment(process.env,{ref:values.FALAAI_LGPD_PROJECT_REF?.trim(),url:values.FALAAI_LGPD_URL?.trim(),publicKey:values.FALAAI_LGPD_PUBLISHABLE_KEY?.trim()});
 if(values.FALAAI_LGPD_PROJECT_NAME!=='falaai-lgpd-validacao')throw Error();
 if(process.argv[2]==='--check'){console.log('PASSOU: destino descartável; somente Publishable Key; dotenv automático desabilitado; isolamento Metro confirmado; nenhum processo iniciado.');process.exit(0);}
 const commands=spawnSync('ps',['ax','-o','command='],{encoding:'utf8'}).stdout||'';
 if(/(?:\/|\s)expo\s+start\b|expo\/bin\/cli\s+start\b|@expo\/cli.*\bstart\b/.test(commands)){console.error('Já existe um processo Expo. Encerre-o manualmente antes de iniciar o teste isolado.');process.exit(1);}
 const server=net.createServer();
 server.once('error',()=>{console.error('Porta 8081 ocupada. Nenhum segundo Metro foi iniciado.');process.exitCode=1;});
 server.listen(8081,'127.0.0.1',()=>server.close(()=>{
  console.log('Metro isolado: falaai-lgpd-validacao. Nenhuma configuração remota foi alterada.');
  const child=spawn(process.execPath,[path.join(root,'node_modules/expo/bin/cli'),'start','--dev-client','--clear','--port','8081'],{cwd:root,stdio:'inherit',env});
  child.once('error',()=>{console.error('Não foi possível iniciar o Expo isolado.');process.exitCode=1;});
  child.once('exit',code=>{process.exitCode=code??1;});
 }));
}catch{console.error('Teste isolado bloqueado. Confira branch, projeto descartável e arquivo local ignorado. Nenhum valor foi impresso.');process.exitCode=1;}
