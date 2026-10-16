import { Text, View } from 'react-native';
import { Notice, ui } from './app-ui';
import type { Occurrence } from '../types';

export type OccurrenceMapProps = { reports: Occurrence[]; onSelect: (id: string) => void };

// O Metro escolhe occurrence-map.native.tsx no Android/iOS. Na web não importa módulos nativos.
export default function OccurrenceMap(_props: OccurrenceMapProps) {
  return <View style={ui.card}><Text style={ui.sectionTitle}>Explore os relatos</Text><Notice>O mapa integrado está disponível no Android e iOS. Na web, consulte a lista e abra a localização no mapa externo pelos detalhes dos registros com GPS.</Notice></View>;
}
