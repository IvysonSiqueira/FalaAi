import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import OccurrenceMap from '../components/occurrence-map';
import { Notice, OccurrenceCard, Screen, ui } from '../components/app-ui';
import { CATEGORIES } from '../constants/categories';
import { AppColors as colors } from '../constants/theme';
import { useApp } from '../context/AppContext';
import type { CategoryId, TabScreenProps } from '../types';

export default function MapScreen({ navigation }: TabScreenProps<'Mapa'>) {
  const { occurrences } = useApp();
  const [filter, setFilter] = useState<CategoryId | 'all'>('all');
  const [showMap, setShowMap] = useState(true);
  const reports = filter === 'all' ? occurrences : occurrences.filter((report) => report.categoryId === filter);
  const locatedCount = reports.filter((report) => report.coordinates).length;
  const openReport = (reportId: string) => navigation.navigate('ReportDetail', { reportId });

  return <Screen tab>
    <FlatList style={ui.flex} contentContainerStyle={ui.content} data={reports} keyExtractor={(item) => item.id}
      ListHeaderComponent={<View style={styles.header}>
        <View style={styles.heading}>
          <Text style={[ui.title, ui.flex]}>Mapa</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={showMap ? 'Mostrar somente lista' : 'Mostrar mapa e lista'}
            onPress={() => setShowMap((value) => !value)} style={({ pressed }) => [styles.toggle, pressed && ui.secondaryPressed]}>
            <Text style={styles.toggleText}>{showMap ? 'Ver só lista' : 'Ver mapa'}</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {[{ id: 'all', label: 'Todas' } as const, ...CATEGORIES].map((category) => <Pressable key={category.id}
            accessibilityRole="button" accessibilityState={{ selected: filter === category.id }}
            onPress={() => setFilter(category.id)} style={({ pressed }) => [styles.chip, filter === category.id && styles.active, pressed && ui.pressed]}>
            <Text style={[styles.chipText, filter === category.id && styles.activeText]}>{category.label}</Text>
          </Pressable>)}
        </ScrollView>
        {showMap && <OccurrenceMap reports={reports} onSelect={openReport} />}
        <View style={styles.summary}>
          <Text style={ui.sectionTitle}>Ocorrências</Text>
          <Text style={ui.subtitle}>{reports.length} registro(s) · {locatedCount} com GPS</Text>
        </View>
        {reports.length > locatedCount && <Notice>Registros com endereço manual aparecem na lista, sem marcador.</Notice>}
      </View>}
      renderItem={({ item }) => <OccurrenceCard report={item} onPress={() => openReport(item.id)} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={<View style={ui.card}>
        <Text style={ui.sectionTitle}>{occurrences.length ? 'Nenhum relato neste filtro' : 'Ainda não há ocorrências'}</Text>
        <Notice>{occurrences.length ? 'Escolha outra categoria ou selecione “Todas”.' : 'Use “Relatar um problema” no Início para adicionar o primeiro registro.'}</Notice>
      </View>}
    />
  </Screen>;
}
const styles = StyleSheet.create({
  header: { gap: 12, marginBottom: 16 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  toggle: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  toggleText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  filters: { gap: 8, paddingVertical: 2 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.secondary, fontWeight: '600', fontSize: 14 },
  activeText: { color: colors.surface },
  summary: { gap: 4, marginTop: 4 },
  separator: { height: 12 },
});
