export const PRIVACY_VERSION = '2026-11-24-v1';
export const PRIVACY_NOTICE = `Aviso de privacidade — FalaAí (protótipo acadêmico)

Usamos seu nome e e-mail para identificar sua conta e autenticar o acesso. O Supabase trata a senha na autenticação; o aplicativo não mantém sua senha após o envio.

Descrição, categoria, endereço, coordenadas GPS e fotografias opcionais são usados para registrar e localizar problemas urbanos. A câmera, a galeria e o GPS são acessados mediante permissão; não coletamos localização em segundo plano.

Conta, relatos e fotografias são armazenados no Supabase. Outros usuários autenticados podem consultar relatos comunitários, fotografias e localização informada. Não inclua rostos, placas, documentos, dados sensíveis ou informações pessoais de terceiros. As fotos usam bucket privado e links temporários; quem já acessou uma imagem pode ter guardado uma cópia.

A sessão é mantida neste aparelho até sair. Este protótipo não encaminha denúncias à prefeitura. Evite dados pessoais desnecessários e use uma senha exclusiva de teste.

A versão deste aviso e a data do aceite serão registradas no servidor quando a migração de privacidade estiver ativa. Contas antigas não recebem aceite retroativo.

A exclusão de conta ainda está em preparação e não está habilitada nesta versão. Quando validada, removerá relatos, fotografias e identidade da conta. Falhas parciais exigirão nova tentativa antes da conclusão; cópias em backups do provedor e imagens já salvas por terceiros não são apagadas imediatamente por essa operação. Para solicitações durante a avaliação, procure o responsável pelo projeto pelo canal utilizado na disciplina.`;

export function privacyRegistration(accepted: boolean): { privacyVersion: string } {
  if (!accepted) throw new Error('Leia o aviso e marque o aceite para criar sua conta.');
  return { privacyVersion: PRIVACY_VERSION };
}
