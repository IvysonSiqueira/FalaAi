import { useApp } from '../context/AppContext';
import { View } from 'react-native';
import { Button, Notice, ui } from './app-ui';

export default function OccurrenceFeedback({ loading, error, hasItems, onRefresh }: {
  loading: boolean; error: string | null; hasItems: boolean; onRefresh: () => Promise<void>;
}) {
  const { photoCleanupWarning, retryPhotoCleanup } = useApp();
  return <View style={ui.field}>
    {photoCleanupWarning && <>
      <Notice error>{photoCleanupWarning}</Notice>
      <Button title="Tentar limpeza de fotos" secondary onPress={() => void retryPhotoCleanup()} />
    </>}
    {loading && <Notice>{hasItems ? 'Atualizando ocorrências…' : 'Carregando ocorrências…'}</Notice>}
    {error && <><Notice error>{error}</Notice>{hasItems && <Notice>Exibindo dados da última consulta. Eles podem estar desatualizados.</Notice>}</>}
    <Button title={error ? 'Tentar novamente' : 'Atualizar ocorrências'} secondary busy={loading} onPress={() => void onRefresh()} />
  </View>;
}
