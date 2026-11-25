// Lançador de entrega: apenas configuração pública, sem arquivos administrativos.
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { spawn, spawnSync } = require('node:child_process');
const net = require('node:net');
const { lgpdUiEnvironment } = require('./helpers/lgpd-ui-env.cjs');
const root = path.resolve(__dirname, '..');
process.chdir(root);
try {
  if (process.argv[2] && process.argv[2] !== '--check') throw Error();
  const values = parseEnv(fs.readFileSync('.env.academic.local', 'utf8'));
  const allowed = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
  if (Object.keys(values).some(key => !allowed.includes(key))) throw Error();
  const env = lgpdUiEnvironment(process.env, { ref: 'ilkprwaxszztejsasmcs',
    url: values.EXPO_PUBLIC_SUPABASE_URL, publicKey: values.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY });
  if (process.argv[2] === '--check') { console.log('PASSOU: ambiente acadêmico, apenas configuração pública; nenhum processo iniciado.'); process.exit(0); }
  const commands = spawnSync('ps', ['ax', '-o', 'command='], { encoding: 'utf8' }).stdout || '';
  if (/(?:\/|\s)expo\s+start\b|expo\/bin\/cli\s+start\b|@expo\/cli.*\bstart\b/.test(commands)) {
    console.error('Já existe Expo em execução; encerre o Metro anterior antes de iniciar.'); process.exit(1);
  }
  const server = net.createServer();
  server.once('error', () => { console.error('Porta 8081 ocupada; nenhum segundo Metro iniciado.'); process.exitCode = 1; });
  server.listen(8081, '127.0.0.1', () => server.close(() => {
    console.log('Ambiente acadêmico: falaai-lgpd-validacao. A trava remota não foi alterada.');
    const child = spawn(process.execPath, [path.join(root, 'node_modules/expo/bin/cli'), 'start', '--dev-client', '--clear', '--port', '8081'], { env, stdio: 'inherit' });
    child.once('error', () => { console.error('Não foi possível iniciar Metro.'); process.exitCode = 1; });
    child.once('exit', code => { process.exitCode = code ?? 1; });
  }));
} catch { console.error('Configure .env.academic.local apenas com URL e Publishable Key do ambiente de entrega.'); process.exitCode = 1; }
