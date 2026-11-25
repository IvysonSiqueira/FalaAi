import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Linking, ScrollView, Text, View } from 'react-native';
import { BackHeader, Button, Notice, Screen, StatusBadge, ui } from '../components/app-ui';
import StoredReportPhoto from '../components/stored-report-photo';
import { getCategory } from '../constants/categories';
import { useApp } from '../context/AppContext';
import type { StackScreenProps } from '../types';

export default function ReportDetailScreen({ route, navigation }: StackScreenProps<'ReportDetail'>) {
  const { currentUser, occurrences, loadOccurrence, deleteOccurrence } = useApp();
  const reportId = route.params.reportId;
  const report = occurrences.find((item) => item.id === reportId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const request = useMemo(() => ({ id: reportId, attempt }), [reportId, attempt]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const pending = useRef(false);
  const [mapError, setMapError] = useState('');
  const [opening, setOpening] = useState(false);
  const own = report?.authorId === currentUser?.id;

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setConfirmDelete(false);
    void loadOccurrence(request.id).catch((failure: unknown) => {
      if (active) setError(failure instanceof Error ? failure.message : 'Não foi possível carregar a ocorrência.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request, loadOccurrence]));

  async function remove() {
    if (!own || pending.current) return;
    pending.current = true;
    setDeleting(true);
    setError(null);
    try {
      await deleteOccurrence(reportId);
      navigation.goBack();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível excluir a ocorrência.');
    } finally { pending.current = false; setDeleting(false); }
  }

  async function openExternalMap() {
    if (!report?.coordinates || opening) return;
    setOpening(true);
    setMapError('');
    try {
      const { latitude, longitude } = report.coordinates;
      await Linking.openURL(`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`);
    } catch { setMapError('Não foi possível abrir o mapa externo. Consulte as coordenadas abaixo.'); }
    finally { setOpening(false); }
  }

  return <Screen>
    <BackHeader title="Detalhes da ocorrência" onBack={() => { if (!deleting) navigation.goBack(); }} />
    <ScrollView contentContainerStyle={ui.content}>
      {loading && <Notice>Consultando ocorrência no servidor…</Notice>}
      {error && <View style={ui.card}>
        <Notice error>{error}</Notice>
        {report && <Notice>Os dados abaixo são da última consulta e podem estar desatualizados.</Notice>}
        <Button title="Consultar novamente" secondary disabled={deleting} onPress={() => setAttempt((value) => value + 1)} />
      </View>}
      {!report ? !loading && !error && <View style={ui.card}><Text style={ui.label}>Ocorrência não encontrada</Text>
        <Notice>O registro foi excluído ou não está disponível para sua conta.</Notice>
        <Button title="Voltar" onPress={() => navigation.goBack()} />
      </View> : <>
        <View style={ui.card}>
          <StatusBadge status={report.status} />
          <Text style={ui.title}>{report.title || getCategory(report.categoryId).label}</Text>
          <Text style={ui.body}>{report.description}</Text>
        </View>
        <View style={ui.card}>{report.photoPath ? <StoredReportPhoto path={report.photoPath} /> : <Notice>Este relato não possui fotografia. A foto é opcional.</Notice>}</View>
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
          <View style={ui.field}><Text style={ui.label}>Registrado por</Text><Text style={ui.body}>{own ? currentUser?.name : 'Participante da comunidade (nome não público)'}</Text></View>
          {report.createdAt && Number.isFinite(Date.parse(report.createdAt)) ? <View style={ui.field}>
            <Text style={ui.label}>Data do registro</Text><Text style={ui.subtitle}>{new Date(report.createdAt).toLocaleString('pt-BR')}</Text>
          </View> : null}
        </View>
        {own && <View style={ui.card}>
          <Button title="Editar ocorrência" secondary disabled={loading || deleting || !!error} onPress={() => navigation.navigate('NewReport', { reportId })} />
          {confirmDelete ? <>
            <Notice error>Excluir esta ocorrência permanentemente? Esta ação não pode ser desfeita.</Notice>
            <Button title="Confirmar exclusão" destructive busy={deleting} onPress={() => void remove()} />
            <Button title="Cancelar" secondary disabled={deleting} onPress={() => setConfirmDelete(false)} />
          </> : <Button title="Excluir ocorrência" destructive disabled={loading || deleting || !!error} onPress={() => setConfirmDelete(true)} />}
        </View>}
        <Notice>Registro persistido no Supabase para o projeto acadêmico. Nenhuma ocorrência é enviada à prefeitura.</Notice>
      </>}
    </ScrollView>
  </Screen>;
}
