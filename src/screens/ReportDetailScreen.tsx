import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ReportDetailScreen({ route, navigation }: any) {
  const { report } = route.params;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Detalhes da ocorrência</Text>
      </View>

      <View style={styles.content}>
        {report.photo && (
          <View style={styles.photoContainer}>
            <Image source={{ uri: report.photo }} style={styles.reportImage} />
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.categoryLabel}>{report.category}</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>{report.status}</Text></View>
          </View>

          <Text style={styles.title}>{report.title}</Text>
          <Text style={styles.description}>{report.description}</Text>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Local:</Text>
            <Text style={styles.infoValue}>{report.location}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Registrado por:</Text>
            {/* Exibe o autor real do chamado */}
            <Text style={styles.infoValueHighlight}>{report.author || 'Cidadão'}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f5f0' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  backButtonText: { fontSize: 26, color: '#0b132b', marginTop: -4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0b132b' },
  content: { padding: 20 },
  photoContainer: { height: 220, borderRadius: 20, overflow: 'hidden', marginBottom: 20, backgroundColor: '#e2e8f0' },
  reportImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  categoryLabel: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  badge: { backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#1d4ed8' },
  title: { fontSize: 20, fontWeight: '900', color: '#0b132b', marginBottom: 8 },
  description: { fontSize: 14, color: '#475569', lineHeight: 22, marginBottom: 20 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  infoLabel: { fontSize: 13, color: '#64748b' },
  infoValue: { fontSize: 13, fontWeight: '700', color: '#0b132b' },
  infoValueHighlight: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
});