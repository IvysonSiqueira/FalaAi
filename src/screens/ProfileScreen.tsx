import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import OccurrenceFeedback from '../components/occurrence-feedback';
import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Notice, Screen, ui } from '../components/app-ui';
import { AppColors as colors } from '../constants/theme';
import { useApp } from '../context/AppContext';

export default function ProfileScreen() {
  const { currentUser, occurrences, signOut, occurrencesLoading, occurrencesError, refreshOccurrences } = useApp();
  useFocusEffect(useCallback(() => { void refreshOccurrences(); }, [refreshOccurrences]));
  const countUnavailable = occurrences.length === 0 && (occurrencesLoading || !!occurrencesError);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  async function handleSignOut() {
    if (pending.current) return;
    pending.current = true;
    setLeaving(true);
    setError(null);
    try { await signOut(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível sair. Tente novamente.'); }
    finally { pending.current = false; setLeaving(false); }
  }
  if (!currentUser) return null;
  const mine = occurrences.filter((report) => report.authorId === currentUser.id);
  const resolved = mine.filter((report) => report.status === 'Resolvida').length;
  const open = mine.length - resolved;

  return <Screen tab><ScrollView contentContainerStyle={ui.content}>
    <Text style={ui.title}>Seu perfil</Text>
    <View style={styles.userCard}>
      <View style={styles.avatar}><Text style={styles.initial}>{currentUser.name.charAt(0).toUpperCase()}</Text></View>
      <View style={styles.identity}><Text style={styles.name}>{currentUser.name}</Text><Text selectable style={styles.email}>{currentUser.email}</Text></View>
    </View>
    <View style={ui.card}>
      <Text style={ui.sectionTitle}>Seus relatos</Text>
      <OccurrenceFeedback loading={occurrencesLoading} error={occurrencesError} hasItems={occurrences.length > 0} onRefresh={refreshOccurrences} />
      <View style={styles.totalSummary}>
        <Text style={styles.total}>{countUnavailable ? '—' : mine.length}</Text>
        <Text style={ui.body}>{mine.length === 1 ? 'ocorrência registrada' : 'ocorrências registradas'}</Text>
        <Text style={ui.subtitle}>Persistidas na sua conta</Text>
      </View>
      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.statNumber}>{countUnavailable ? '—' : open}</Text><Text style={ui.subtitle}>Em aberto</Text></View>
        <View style={styles.stat}><Text style={[styles.statNumber, { color: colors.success }]}>{countUnavailable ? '—' : resolved}</Text><Text style={ui.subtitle}>Resolvidas</Text></View>
      </View>
      <Notice>Novos relatos começam como “Aberta”. O protótipo não possui acompanhamento da prefeitura nem atualização de status.</Notice>
    </View>
    <View style={ui.card}>
      <Text style={ui.sectionTitle}>Sobre o FalaAí</Text>
      <Text style={ui.body}>Participação cidadã com foto e localização.</Text>
      <Text style={ui.subtitle}>Versão 1.0 · protótipo acadêmico</Text>
      <View style={styles.academic}>
        <Text style={ui.label}>Conta e dados</Text>
        <Notice>Sua conta é autenticada pelo Supabase e a sessão é restaurada neste aparelho até você sair. A senha não é armazenada pelo aplicativo. Os relatos são salvos no Supabase e permanecem após sair ou reiniciar. Use uma senha exclusiva de teste.</Notice>
        <Notice>Fotografias selecionadas são vinculadas aos relatos em Storage privado. A exibição usa acesso temporário autorizado; falhas de limpeza podem ser retomadas após reconectar.</Notice>
      </View>
    </View>
    <View style={ui.card}>
      <Text style={ui.sectionTitle}>Privacidade</Text>
      <Notice>A exclusão está em preparação e ainda não envia solicitações ao servidor.</Notice>
      <Button title="Solicitar exclusão da minha conta" destructive onPress={() => Alert.alert(
        'Excluir minha conta',
        'A operação definitiva removerá sua conta, relatos e fotografias. O recurso está bloqueado até os testes de segurança e implantação. Nenhum dado será excluído agora.',
        [{ text: 'Voltar', style: 'cancel' }, { text: 'Entendi — recurso indisponível' }],
      )} />
    </View>
    {error && <Notice error>{error}</Notice>}
    <Button title="Sair da conta" busy={leaving} destructive onPress={handleSignOut} />
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({
  userCard: { backgroundColor: colors.navy, borderRadius: 20, padding: 20, gap: 16 },
  avatar: { width: 52, height: 52, backgroundColor: colors.primary, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  initial: { color: '#fff', fontSize: 24, fontWeight: '800' },
  identity: { gap: 6, alignSelf: 'stretch' },
  name: { color: '#fff', fontSize: 24, lineHeight: 32, fontWeight: '800' },
  email: { color: '#cbd5e1', fontSize: 15, lineHeight: 22, flexShrink: 1 },
  totalSummary: { gap: 4, alignSelf: 'stretch' },
  total: { color: colors.navy, fontSize: 32, fontWeight: '800' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: 100, backgroundColor: colors.background, borderRadius: 12, padding: 12, gap: 4 },
  statNumber: { color: colors.primary, fontSize: 24, fontWeight: '800' },
  academic: { borderTopWidth: 1, borderTopColor: colors.subtleBorder, paddingTop: 12, gap: 8 },
});
