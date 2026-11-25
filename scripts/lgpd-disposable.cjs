// Preflight sem rede por padrão. Não importa Expo nem modifica seu ambiente.
const fs=require('node:fs');const path=require('node:path');const{parseEnv}=require('node:util');const{spawnSync}=require('node:child_process');
const{validateTarget,PRIMARY_PROJECT_REF}=require('../tests/helpers/lgpd-target.cjs');
const root=path.resolve(__dirname,'..');
try{
 const mode=process.argv[2]||'--preflight';
 if(!['--preflight','--run-rpc'].includes(mode)||process.argv.length>3)throw Error('Modo inválido. Use --preflight ou --run-rpc.');
 const envFile=path.join(root,'.env.lgpd-validacao.local');
 const ignored=spawnSync('git',['check-ignore','--quiet','--','.env.lgpd-validacao.local'],{cwd:root});
 if(ignored.status!==0)throw Error('Arquivo de credenciais não está ignorado pelo Git.');
 const credentials=parseEnv(fs.readFileSync(envFile,'utf8'));
 const names=['FALAAI_LGPD_PROJECT_NAME','FALAAI_LGPD_PROJECT_REF','FALAAI_LGPD_URL','FALAAI_LGPD_PUBLISHABLE_KEY','FALAAI_LGPD_ADMIN_KEY'];
 for(const name of names)console.log(name+' presente: '+!!credentials[name]);
 const app=parseEnv(fs.readFileSync(path.join(root,'.env.local'),'utf8'));
 const currentPrimary=new URL(app.EXPO_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
 if(!/^[a-z0-9]{20}$/.test(currentPrimary))throw Error('Não foi possível confirmar o bloqueio do projeto principal.');
 const config=validateTarget(credentials,mode==='--run-rpc',currentPrimary);
 console.log('Destino corresponde ao Ref configurado: true');
 console.log('Destino é diferente do principal fixado e do aplicativo: '+(config.ref!==PRIMARY_PROJECT_REF&&config.ref!==currentPrimary));
 console.log('Preflight não verifica nome/chaves no servidor e não acessa rede: true');
 if(mode==='--preflight')process.exit(0);
 // Todas as autorizações são explícitas. Nada herda segredos do ambiente Expo.
 const allowed=Object.fromEntries(Object.entries(credentials).filter(([name])=>name.startsWith('FALAAI_LGPD_')));
 const result=spawnSync(process.execPath,['--test',path.join(root,'tests/account-deletion.disposable.integration.cjs')],{
  cwd:root,stdio:'inherit',env:{PATH:process.env.PATH,...allowed,FALAAI_LGPD_RUN_AUTHORIZED:'yes',FALAAI_LGPD_CURRENT_PRIMARY_REF:currentPrimary},
 });
 process.exitCode=result.status??1;
}catch{
 // Não imprimir objetos/stack/valores provenientes de arquivos de credenciais.
 console.error('Preflight bloqueado: confira campos obrigatórios, destino descartável, bloqueio do principal e autorizações locais. Nenhum teste foi iniciado.');
 process.exitCode=1;
}
