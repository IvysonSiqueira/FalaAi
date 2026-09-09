import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';

export default function HomeScreen({ navigation }: any) {
  const { currentUser, occurrences } = useApp();
  
  // Filtra apenas as ocorrências do usuário logado atual
  const mine = occurrences.filter((item: any) => item.author === currentUser.name);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Bom dia</Text>
        <Text style={styles.title}>{currentUser.name}</Text>
        <Text style={styles.subtitle}>O que está acontecendo na sua cidade?</Text>
      </View>

      <View style={styles.content}>
        <Pressable 
          style={styles.actionCard} 
          onPress={() => navigation.navigate('NewReport')}
        >
          <View style={styles.plusIconBox}>
            <Text style={styles.plusIcon}>+</Text>
          </View>
          <View>
            <Text style={styles.actionTitle}>Relatar um problema</Text>
            <Text style={styles.actionSubtitle}>Buraco, luz, lixo, vazamento…</Text>
          </View>
        </Pressable>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#d97706' }]}>{mine.length}</Text>
            <Text style={styles.statLabel}>Em análise</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#15803d' }]}>0</Text>
            <Text style={styles.statLabel}>Resolvidas</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Suas ocorrências</Text>
          <Text style={styles.sectionTotal}>{mine.length} no total</Text>
        </View>

        <View style={styles.listContainer}>
          {mine.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma ocorrência registrada ainda.</Text>
          ) : (
            mine.map((item: any) => (
              <Pressable 
                key={item.id} 
                style={styles.occurrenceCard}
                onPress={() => navigation.navigate('ReportDetail', { report: item })}
              >
                <View style={styles.cardIconBox}>
                  <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                </View>
                <View style={styles.cardContent}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <View style={styles.cardBadge}>
                      <Text style={styles.cardBadgeText}>{item.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f5f0' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  greeting: { fontSize: 14, fontWeight: '500', color: '#64748b' },
  title: { fontSize: 32, fontWeight: '900', color: '#0b132b', marginTop: 2 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 8 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  actionCard: { backgroundColor: '#0b132b', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  plusIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  plusIcon: { fontSize: 28, color: '#ffffff', fontWeight: 'bold', marginTop: -2 },
  actionTitle: { fontSize: 18, fontWeight: '800', color: '#ffffff' },
  actionSubtitle: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: '#ffffff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  statNumber: { fontSize: 28, fontWeight: '900' },
  statLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0b132b' },
  sectionTotal: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  listContainer: { gap: 12 },
  emptyText: { fontSize: 13, color: '#64748b', fontStyle: 'italic', textAlign: 'center', marginTop: 10 },
  occurrenceCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  cardIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardContent: { flex: 1 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0b132b' },
  cardBadge: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  cardBadgeText: { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },
  cardDescription: { fontSize: 12, color: '#64748b', lineHeight: 16 },
});