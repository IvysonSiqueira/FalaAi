import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Notice, Screen, ui } from '../components/app-ui';
import { AppColors as colors } from '../constants/theme';
import { useApp } from '../context/AppContext';

export default function ProfileScreen() {
  const { currentUser, occurrences, signOut } = useApp();
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
      <View style={styles.totalSummary}>
        <Text style={styles.total}>{mine.length}</Text>
        <Text style={ui.body}>{mine.length === 1 ? 'ocorrência registrada' : 'ocorrências registradas'}</Text>
        <Text style={ui.subtitle}>Nesta sessão do aplicativo</Text>
      </View>
      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.statNumber}>{open}</Text><Text style={ui.subtitle}>Em aberto</Text></View>
        <View style={styles.stat}><Text style={[styles.statNumber, { color: colors.success }]}>{resolved}</Text><Text style={ui.subtitle}>Resolvidas</Text></View>
      </View>
      <Notice>Novos relatos começam como “Aberta”. O protótipo não possui acompanhamento da prefeitura nem atualização de status.</Notice>
    </View>
    <View style={ui.card}>
      <Text style={ui.sectionTitle}>Sobre o FalaAí</Text>
      <Text style={ui.body}>Participação cidadã com foto e localização.</Text>
      <Text style={ui.subtitle}>Versão 1.0 · protótipo acadêmico</Text>
      <View style={styles.academic}>
        <Text style={ui.label}>Dados temporários</Text>
        <Notice>Login demonstrativo, sem autenticação de produção. Ao sair, a sessão é encerrada. Cadastros, senhas e ocorrências ficam apenas na memória e são apagados ao reiniciar o aplicativo. Não use senhas reais.</Notice>
        <Notice>Fotos podem usar arquivos temporários do aparelho. Não há garantia de conservação após encerrar o aplicativo.</Notice>
      </View>
    </View>
    <Button title="Sair da conta" destructive onPress={signOut} />
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
