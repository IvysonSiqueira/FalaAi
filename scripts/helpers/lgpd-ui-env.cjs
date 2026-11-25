// Somente ferramentas Node: nunca importar no bundle Expo.
function lgpdUiEnvironment(base,config){
 const ref='ilkprwaxszztejsasmcs';
 if(config.ref!==ref||config.url!=='https://'+ref+'.supabase.co'||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publicKey))throw Error('Destino de UI isolada inválido');
 // Allowlist, não spread do ambiente: credenciais administrativas nunca chegam ao Metro.
 const allow=['PATH','HOME','USER','TMPDIR','SHELL','LANG','TERM','COLORTERM','NVM_BIN','NODE_EXTRA_CA_CERTS'];
 const env=Object.fromEntries(allow.filter(k=>base[k]).map(k=>[k,base[k]]));
 return {...env,EXPO_NO_DOTENV:'1',EXPO_NO_TELEMETRY:'1',
 EXPO_PUBLIC_SUPABASE_URL:config.url,EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.publicKey,
 EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED:'true',EXPO_PUBLIC_ACCOUNT_DELETION_PROJECT_REF:ref};
}
module.exports={lgpdUiEnvironment};
