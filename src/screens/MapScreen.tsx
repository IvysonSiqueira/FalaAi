import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';

export default function MapScreen({ navigation }: any) {
  const { occurrences } = useApp();
  const [selectedFilter, setSelectedFilter] = useState('Todas');
  const [activePin, setActivePin] = useState<any>(null);

  const filters = ['Todas', 'Buraco na rua', 'Iluminação', 'Lixo acumulado', 'Vazamento', 'Calçada', 'Outros'];

  const filteredPins = selectedFilter === 'Todas' 
    ? occurrences 
    : occurrences.filter((p: any) => p.category.toLowerCase() === selectedFilter.toLowerCase());

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mapa</Text>
      <Text style={styles.subtitle}>Ocorrências na cidade · toque num pin</Text>

      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContainer}>
          {filters.map((filter) => {
            const isSelected = selectedFilter === filter;
            return (
              <Pressable
                key={filter}
                onPress={() => {
                  setSelectedFilter(filter);
                  setActivePin(null);
                }}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, isSelected && styles.filterTextActive]}>{filter}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.mapCard}>
        <View style={styles.regionCircle} />
        <View style={styles.regionBlock1}><Text style={styles.regionText}>VILA NOVA</Text></View>
        <View style={styles.regionBlock2}><Text style={styles.regionText}>JARDINS</Text></View>
        <View style={styles.river} />

        {filteredPins.map((pin: any) => {
          const isSelected = activePin?.id === pin.id;
          return (
            <Pressable
              key={pin.id}
              onPress={() => setActivePin(pin)}
              style={[
                styles.pinWrapper, 
                { 
                  top: pin.top || 150, 
                  left: pin.left || 150,
                  marginLeft: -14,
                  marginTop: -14 
                }
              ]}
            >
              <View style={[styles.pinDot, { backgroundColor: pin.color || '#2563eb' }, isSelected && styles.pinSelected]} />
              <View style={[styles.pinShadow, { backgroundColor: pin.color || '#2563eb' }]} />
            </Pressable>
          );
        })}

        {activePin && (
          <Pressable
            style={styles.floatingCard}
            onPress={() => navigation.navigate('ReportDetail', { report: activePin })}
          >
            <View style={styles.cardIconBox}><Text style={{ fontSize: 20 }}>{activePin.icon}</Text></View>
            <View style={styles.cardContent}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>{activePin.title}</Text>
                <View style={styles.cardBadge}><Text style={styles.cardBadgeText}>{activePin.status}</Text></View>
              </View>
              <Text style={styles.cardDescription} numberOfLines={1}>{activePin.description}</Text>
              {/* Exibe o autor real do chamado no mapa */}
              <Text style={styles.cardAuthor}>Por: {activePin.author || 'Cidadão'}</Text>
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f5f0', paddingTop: 50, paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: '900', color: '#0b132b', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 16 },
  filtersWrapper: { height: 48, marginBottom: 16 },
  filtersContainer: { alignItems: 'center', gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
  filterChipActive: { backgroundColor: '#0b132b', borderColor: '#0b132b' },
  filterText: { fontSize: 14, fontWeight: '600', color: '#334155' },
  filterTextActive: { color: '#ffffff' },
  mapCard: { flex: 1, backgroundColor: '#dce5d9', borderRadius: 24, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 20 },
  regionCircle: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#bcd3b8', top: 50, left: 20, opacity: 0.7 },
  regionBlock1: { position: 'absolute', width: 130, height: 60, borderRadius: 14, backgroundColor: '#cdd7cb', bottom: 70, left: 30, justifyContent: 'center', alignItems: 'center', opacity: 0.6 },
  regionBlock2: { position: 'absolute', width: 120, height: 60, borderRadius: 14, backgroundColor: '#cdd7cb', top: 100, right: 40, justifyContent: 'center', alignItems: 'center', opacity: 0.6 },
  river: { position: 'absolute', width: '120%', height: 60, backgroundColor: '#b8c9d9', bottom: 40, left: -20, transform: [{ rotate: '-8deg' }], opacity: 0.7, borderRadius: 20 },
  regionText: { fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 1 },
  pinWrapper: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: 28, height: 28 },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#ffffff', zIndex: 2 },
  pinSelected: { transform: [{ scale: 1.4 }], borderColor: '#2563eb', borderWidth: 3 },
  pinShadow: { position: 'absolute', width: 10, height: 10, borderRadius: 5, bottom: -2, opacity: 0.4 },
  floatingCard: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: '#ffffff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  cardIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardContent: { flex: 1 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0b132b' },
  cardBadge: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  cardBadgeText: { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },
  cardDescription: { fontSize: 12, color: '#64748b', lineHeight: 16 },
  cardAuthor: { fontSize: 11, fontWeight: '700', color: '#2563eb', marginTop: 4 },
});