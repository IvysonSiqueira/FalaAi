const fs=require('node:fs');const path=require('node:path');
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
function artifactPaths(root,runId){
 if(!new RegExp('^'+uuid+'$').test(runId))throw Error('Identificador de evidência inválido');
 const directory=path.join(root,'.artifacts','lgpd',runId);
 return {directory,manifestFile:path.join(directory,'fixtures.json'),reportFile:path.join(directory,'results.json')};
}
function prepareArtifactDirectory(root,runId){
 const paths=artifactPaths(root,runId);
 fs.mkdirSync(paths.directory,{recursive:true,mode:0o700});
 for(const dir of [path.join(root,'.artifacts'),path.join(root,'.artifacts','lgpd'),paths.directory])fs.chmodSync(dir,0o700);
 return paths;
}
function archiveLegacyEvidence(root){
 const pattern=new RegExp('^\\.env\\.lgpd-(fixtures|results)-('+uuid+')\\.local$');
 const result=[];
 for(const name of fs.readdirSync(root)){
  const match=pattern.exec(name);if(!match)continue;
  const source=path.join(root,name),bytes=fs.readFileSync(source);
  JSON.parse(bytes.toString('utf8')); // Somente JSON de controle, nunca dotenv real.
  const paths=prepareArtifactDirectory(root,match[2]);
  const target=match[1]==='fixtures'?paths.manifestFile:paths.reportFile;
  if(fs.existsSync(target))throw Error('Destino de evidência já existe; não foi sobrescrito');
  fs.renameSync(source,target);fs.chmodSync(target,0o600);
  if(!fs.readFileSync(target).equals(bytes))throw Error('Falha de integridade da evidência');
  result.push({source:name,target:path.relative(root,target),preserved:true});
 }
 return result;
}
module.exports={artifactPaths,prepareArtifactDirectory,archiveLegacyEvidence};
