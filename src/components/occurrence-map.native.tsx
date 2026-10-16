import { Camera, Map, Marker, type CameraRef } from '@maplibre/maplibre-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { getCategory } from '../constants/categories';
import { OPEN_FREE_MAP_STYLE } from '../constants/maps';
import type { Coordinates, Occurrence } from '../types';
import { getMapViewport, toMapPosition, type MapViewport } from '../utils/map-viewport';
import { Button, Notice, ui } from './app-ui';
import type { OccurrenceMapProps } from './occurrence-map';

type LocatedOccurrence = Occurrence & { coordinates: Coordinates };
type LoadStatus = 'loading' | 'ready' | 'error';

function LocatedMap({ reports, viewport, onSelect }: {
  reports: LocatedOccurrence[];
  viewport: MapViewport;
  onSelect: OccurrenceMapProps['onSelect'];
}) {
  const { height } = useWindowDimensions();
  const cameraRef = useRef<CameraRef>(null);
  const styleReady = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<LoadStatus>('loading');

  const fitPoints = useCallback(() => {
    if (!styleReady.current || !cameraRef.current) return;
    if ('center' in viewport) {
      cameraRef.current.easeTo({ ...viewport, duration: 350 });
    } else {
      cameraRef.current.fitBounds(viewport.bounds, { padding: viewport.padding, duration: 350 });
    }
  }, [viewport]);

  useEffect(() => { fitPoints(); }, [fitPoints]);

  useEffect(() => {
    if (status !== 'loading') return;
    // Falhas de rede nem sempre disparam o evento nativo de erro do estilo.
    const timeout = setTimeout(() => setStatus('error'), 20000);
    return () => clearTimeout(timeout);
  }, [attempt, status]);

  function retry() {
    styleReady.current = false;
    setStatus('loading');
    setAttempt((previous) => previous + 1);
  }

  return (
    <View style={[styles.container, { height: Math.max(280, Math.min(460, height * 0.48)) }]}>
      <Map
        key={attempt}
        style={styles.map}
        mapStyle={OPEN_FREE_MAP_STYLE}
        androidView="texture"
        attribution
        accessibilityLabel="Mapa geográfico das ocorrências, dados OpenStreetMap"
        onDidFinishLoadingStyle={() => { styleReady.current = true; fitPoints(); }}
        onDidFinishRenderingMapFully={() => setStatus((current) => current === 'error' ? current : 'ready')}
        onDidFailLoadingMap={() => setStatus('error')}
      >
        <Camera ref={cameraRef} initialViewState={viewport} maxZoom={18} />
        {reports.map((report) => (
          <Marker
            key={report.id}
            id={report.id}
            lngLat={toMapPosition(report.coordinates)}
            accessibilityRole="button"
            accessibilityLabel={`Ver detalhes: ${report.title}`}
            onPress={() => onSelect(report.id)}
          >
            <View collapsable={false} style={styles.markerTouchArea}>
              <View style={[styles.marker, { backgroundColor: getCategory(report.categoryId).pinColor }]} />
            </View>
          </Marker>
        ))}
      </Map>
      {status === 'loading' && (
        <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator color="#2563eb" />
          <Notice>Carregando mapa...</Notice>
        </View>
      )}
      {status === 'error' && (
        <ScrollView style={styles.error} contentContainerStyle={styles.errorContent} nestedScrollEnabled>
          <Text style={ui.sectionTitle}>Mapa indisponível</Text>
          <Notice error>Confira sua conexão e tente novamente. Os relatos continuam disponíveis na lista abaixo.</Notice>
          <Button title="Tentar novamente" secondary onPress={retry} />
        </ScrollView>
      )}
    </View>
  );
}

export default function OccurrenceMap({ reports, onSelect }: OccurrenceMapProps) {
  const located = reports.filter((report): report is LocatedOccurrence => report.coordinates !== null);
  const viewport = getMapViewport(located.map((report) => report.coordinates));
  if (!viewport) {
    return <View style={ui.card}><Text style={ui.sectionTitle}>Sem pontos no mapa</Text><Notice>Nenhuma ocorrência com GPS neste filtro. Os registros com endereço manual continuam na lista abaixo.</Notice></View>;
  }
  return <LocatedMap reports={located} viewport={viewport} onSelect={onSelect} />;
}

const styles = StyleSheet.create({
  container: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#e2e8f0' },
  map: { flex: 1 },
  markerTouchArea: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  marker: { width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: '#fff' },
  loading: { position: 'absolute', top: 12, alignSelf: 'center', maxWidth: '90%', backgroundColor: '#fff', padding: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  error: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#f8f5f0' },
  errorContent: { flexGrow: 1, padding: 20, justifyContent: 'center', gap: 14 },
});
