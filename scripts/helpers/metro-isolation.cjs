// Lido pelo Node na configuração do Metro; nunca faz parte do bundle do aplicativo.
function isolationPatterns(projectRoot){
 const root=projectRoot.replace(/\\/g,'/').replace(/\/$/,'');
 const escaped=root.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\//g,'[\\\\/]');
 return [
  // Expo 57 usa require.context amplo para dotenv em dev. O CLI já injeta as
  // variáveis públicas; nenhum .env físico precisa ser um módulo do cliente.
  /[\\/]\.env[^\\/]*(?:[\\/].*)?$/,
  new RegExp('^'+escaped+'[\\\\/](?:scripts|tests|supabase|docs|\\.artifacts|\\.git)(?:[\\\\/].*)?$'),
  /(?:\.bak|\.backup|\.orig|\.tmp|~)$/,
 ];
}
module.exports={isolationPatterns};
