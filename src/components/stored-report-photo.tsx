import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { Button, Notice, ReportPhoto, ui } from './app-ui';

// Só o caminho é persistido. URL assinada fica neste componente e expira em 10 min.
export default function StoredReportPhoto({ path }: { path: string }) {
  const { getPhotoUrl } = useApp();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setUrl(null);
    setLoading(true);
    setError(null);
    void getPhotoUrl(path).then((value) => { if (active) setUrl(value); })
      .catch((failure: unknown) => { if (active) setError(failure instanceof Error ? failure.message : 'Foto indisponível.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, getPhotoUrl, attempt]);
  useEffect(() => {
    const timer = setInterval(retry, 9 * 60 * 1000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') retry(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [retry]);
  return <View style={ui.field}>
    {loading && <Notice>Carregando acesso privado à fotografia…</Notice>}
    {error && <Notice error>{error}</Notice>}
    {url && <ReportPhoto key={`${path}:${attempt}`} uri={url} />}
    <Button title="Atualizar fotografia" secondary busy={loading} onPress={retry} />
  </View>;
}
