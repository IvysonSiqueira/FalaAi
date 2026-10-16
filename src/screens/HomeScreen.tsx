import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AppColors as colors } from '../constants/theme';
import { Screen, OccurrenceCard, ui } from '../components/app-ui';
import type { TabScreenProps } from '../types';

export default function HomeScreen({ navigation }: TabScreenProps<'Início'>) {
  const { currentUser, occurrences } = useApp();
  if (!currentUser) return null;
  const mine = occurrences.filter((item) => item.authorId === currentUser.id);
  const openCount = mine.filter((item) => item.status !== 'Resolvida').length;
  const resolvedCount = mine.filter((item) => item.status === 'Resolvida').length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <Screen tab>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.listContent}
        data={mine}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.greeting}>{greeting}</Text>
              <Text style={styles.title}>{currentUser.name}</Text>
              <Text style={styles.subtitle}>O que está acontecendo na sua cidade?</Text>
            </View>

            <View style={styles.content}>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.actionCard, pressed && ui.pressed]}
                onPress={() => navigation.navigate('NewReport')}
              >
                <View style={styles.plusIconBox}>
                  <Text style={styles.plusIcon}>+</Text>
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Relatar um problema</Text>
                  <Text style={styles.actionSubtitle}>Buraco, luz, lixo, vazamento…</Text>
                </View>
              </Pressable>

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={[styles.statNumber, { color: '#d97706' }]}>{openCount}</Text>
                  <Text style={styles.statLabel}>Em aberto</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statNumber, { color: '#15803d' }]}>{resolvedCount}</Text>
                  <Text style={styles.statLabel}>Resolvidas</Text>
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Suas ocorrências</Text>
                <Text style={styles.sectionTotal}>{mine.length} no total</Text>
              </View>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <OccurrenceCard report={item} onPress={() => navigation.navigate('ReportDetail', { reportId: item.id })} />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.listItem}>
            <Text style={styles.emptyText}>Nenhuma ocorrência registrada ainda.</Text>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f5f0' },
  header: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 20 },
  greeting: { fontSize: 14, fontWeight: '500', color: colors.secondary },
  title: { fontSize: 30, fontWeight: '800', color: colors.navy, marginTop: 2 },
  subtitle: { fontSize: 14, color: colors.secondary, marginTop: 8 },
  content: { paddingHorizontal: 20 },
  listContent: { paddingBottom: 40 },
  listItem: { paddingHorizontal: 20 },
  actionCard: { backgroundColor: '#0b132b', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, minHeight: 64, flexDirection: 'row', alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  plusIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  plusIcon: { fontSize: 28, color: '#ffffff', fontWeight: 'bold', marginTop: -2 },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 18, fontWeight: '800', color: '#ffffff' },
  actionSubtitle: { fontSize: 14, color: '#94a3b8', marginTop: 2 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statCard: { flexGrow: 1, flexBasis: 120, backgroundColor: '#ffffff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  statNumber: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 14, fontWeight: '600', color: colors.secondary, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.navy },
  sectionTotal: { fontSize: 14, fontWeight: '600', color: colors.secondary },
  separator: { height: 12 },
  emptyText: { fontSize: 14, color: colors.secondary, textAlign: 'center', marginTop: 10 },
});
