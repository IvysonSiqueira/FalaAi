import { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { BackHeader, Button, Notice, ReportPhoto, Screen, StatusBadge, ui } from '../components/app-ui';
import { getCategory } from '../constants/categories';
import { useApp } from '../context/AppContext';
import type { StackScreenProps } from '../types';

export default function ReportDetailScreen({ route, navigation }: StackScreenProps<'ReportDetail'>) {
  const { occurrences } = useApp();
  const report = occurrences.find((item) => item.id === route.params?.reportId);
  const [mapError, setMapError] = useState('');
  const [opening, setOpening] = useState(false);

  async function openExternalMap() {
    if (!report?.coordinates || opening) return;
    setOpening(true);
    setMapError('');
    try {
      const { latitude, longitude } = report.coordinates;
      await Linking.openURL(`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`);
    } catch {
      setMapError('Não foi possível abrir o mapa externo. Consulte as coordenadas abaixo.');
    } finally {
      setOpening(false);
    }
  }

  return <Screen>
    <BackHeader title="Detalhes da ocorrência" onBack={() => navigation.goBack()} />
    <ScrollView contentContainerStyle={ui.content}>
      {!report ? <View style={ui.card}><Text style={ui.label}>Ocorrência não encontrada</Text>
        <Notice>O registro não está disponível nesta sessão. Volte e selecione outra ocorrência.</Notice>
        <Button title="Voltar" onPress={() => navigation.goBack()} />
      </View> : <>
        <View style={ui.card}>
          <StatusBadge status={report.status} />
          <Text style={ui.title}>{report.title || getCategory(report.categoryId).label}</Text>
          {report.title && report.title !== getCategory(report.categoryId).label && <Text style={ui.subtitle}>{getCategory(report.categoryId).label}</Text>}
          <Text style={ui.body}>{report.description}</Text>
        </View>
        {report.photo ? <ReportPhoto uri={report.photo} /> : <View style={ui.card}><Notice>Este relato não possui foto. A fotografia é opcional.</Notice></View>}
        <View style={ui.card}>
          <Text style={ui.sectionTitle}>Localização</Text>
          <Text selectable style={ui.body}>{report.location?.trim() || (report.coordinates ? 'Local registrado por GPS' : 'Endereço não informado')}</Text>
          {report.coordinates ? <>
            <View style={ui.field}>
              <Text style={ui.label}>Coordenadas GPS</Text>
              <Text selectable style={ui.subtitle}>Latitude: {report.coordinates.latitude.toFixed(6)}{'\n'}Longitude: {report.coordinates.longitude.toFixed(6)}</Text>
            </View>
            <Button title="Abrir no OpenStreetMap" secondary busy={opening} onPress={() => void openExternalMap()} />
            {mapError ? <Notice error>{mapError}</Notice> : null}
          </> : <Notice>Endereço manual: não há coordenadas GPS associadas a este registro.</Notice>}
        </View>
        <View style={ui.card}>
          <Text style={ui.sectionTitle}>Sobre o registro</Text>
          <View style={ui.field}><Text style={ui.label}>Registrado por</Text><Text style={ui.body}>{report.author}</Text></View>
          {report.createdAt && Number.isFinite(Date.parse(report.createdAt)) ? <View style={ui.field}>
            <Text style={ui.label}>Data do registro</Text><Text style={ui.subtitle}>{new Date(report.createdAt).toLocaleString('pt-BR')}</Text>
          </View> : null}
        </View>
        <Notice>Registro demonstrativo local. Nenhuma ocorrência é enviada à prefeitura. Os dados ficam apenas nesta sessão do aplicativo.</Notice>
      </>}
    </ScrollView>
  </Screen>;
}
