import { SymbolView } from 'expo-symbols';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BackHeader, Button, Notice, ReportPhoto, Screen, ui } from '../components/app-ui';
import { AppColors as colors } from '../constants/theme';
import { CATEGORIES } from '../constants/categories';
import { useApp } from '../context/AppContext';
import type { CategoryId, Coordinates, StackScreenProps } from '../types';
import { createOccurrenceId } from '../utils/validation';

type FormErrors = { description?: string; location?: string; form?: string };

export default function NewReportScreen({ navigation }: StackScreenProps<'NewReport'>) {
  const { currentUser, addOccurrence } = useApp();
  const [categoryId, setCategoryId] = useState<CategoryId>('buraco');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState<'camera' | 'gallery' | 'gps' | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [gpsError, setGpsError] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [saved, setSaved] = useState(false);
  function clearFieldError(field: 'description' | 'location') {
    setErrors((previous) => ({ ...previous, [field]: undefined, form: undefined }));
  }
  const descriptionInput = useRef<TextInput>(null);
  const locationInput = useRef<TextInput>(null);
  const operation = useRef(false);
  const submitted = useRef(false);
  const mounted = useRef(true);
  const cancelLocation = useRef<(() => void) | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cancelLocation.current?.(); };
  }, []);

  async function pickImage(source: 'camera' | 'gallery') {
    if (operation.current || submitted.current) return;
    operation.current = true;
    setBusy(source);
    setPhotoError('');
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        if (mounted.current) setPhotoError(`Acesso à ${source === 'camera' ? 'câmera' : 'galeria'} negado. Você pode continuar sem foto ou liberar o acesso nos ajustes do aparelho.`);
        return;
      }
      if (!mounted.current) return;
      // Sem editor nativo ou aspect: mantém o enquadramento entregue pela câmera/galeria.
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 1 };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (mounted.current && !result.canceled && result.assets[0]) setPhoto(result.assets[0].uri);
    } catch {
      if (mounted.current) setPhotoError('Não foi possível abrir a imagem. Tente novamente ou use a outra opção.');
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  async function captureLocation() {
    if (operation.current || submitted.current) return;
    operation.current = true;
    setBusy('gps');
    setGpsError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Localização negada. Digite o endereço manualmente ou libere o acesso nos ajustes do aparelho.');
      if (!(await Location.hasServicesEnabledAsync())) throw new Error('Ative a localização do aparelho ou informe o endereço manualmente.');
      if (!mounted.current) return;
      // A inscrição permite parar a busca após o primeiro resultado ou após 20 segundos.
      const position = await new Promise<Location.LocationObject>((resolve, reject) => {
        let subscription: Location.LocationSubscription | undefined;
        let finished = false;
        const finish = (result?: Location.LocationObject, error?: Error) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          cancelLocation.current = null;
          subscription?.remove();
          if (result) resolve(result);
          else reject(error);
        };
        const timer = setTimeout(() => finish(undefined, new Error('O GPS demorou a responder. Tente em um local aberto ou digite o endereço.')), 20000);
        cancelLocation.current = () => finish(undefined, new Error('Busca de localização cancelada.'));
        Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced }, (result) => finish(result),
          () => finish(undefined, new Error('Não foi possível obter a localização. Tente novamente ou digite o endereço.')))
          .then((listener) => { subscription = listener; if (finished) listener.remove(); })
          .catch(() => finish(undefined, new Error('Não foi possível iniciar o GPS. Digite o endereço ou tente novamente.')));
      });
      if (mounted.current) {
        setCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        clearFieldError('location');
      }
    } catch (error) {
      if (mounted.current) setGpsError(error instanceof Error ? error.message : 'Não foi possível obter sua localização. Informe o endereço manualmente.');
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  function handleSubmit() {
    if (operation.current || submitted.current) return;
    const nextErrors: FormErrors = {};
    if (description.trim().length < 20) nextErrors.description = 'Escreva pelo menos 20 caracteres úteis na descrição.';
    if (!location.trim() && !coordinates) nextErrors.location = 'Informe o endereço ou capture a localização pelo GPS.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !currentUser) {
      if (nextErrors.description) descriptionInput.current?.focus();
      else if (nextErrors.location) locationInput.current?.focus();
      return;
    }
    Keyboard.dismiss();
    submitted.current = true;
    try {
      const category = CATEGORIES.find((item) => item.id === categoryId);
      if (!category) throw new Error('Selecione uma categoria válida.');
      addOccurrence({
        id: createOccurrenceId(), authorId: currentUser.id, author: currentUser.name,
        categoryId, title: category.label, description: description.trim(),
        location: location.trim() || 'Localização registrada por GPS (sem endereço informado)',
        coordinates, photo, status: 'Aberta', createdAt: new Date().toISOString(),
      });
      setSaved(true);
    } catch (error) {
      submitted.current = false;
      setErrors({ form: error instanceof Error ? error.message : 'Não foi possível salvar a ocorrência.' });
    }
  }

  if (saved) return <Screen><BackHeader title="Ocorrência registrada" onBack={() => navigation.goBack()} />
    <ScrollView contentContainerStyle={[ui.content, styles.successContent]}><View style={[ui.card, styles.successCard]}>
      <View style={styles.successIcon} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} tintColor={colors.success} size={48} accessible={false} /></View>
      <Text style={ui.title}>Ocorrência registrada!</Text>
      <Notice>Seu relato já está na lista. Os dados ficam apenas nesta sessão e são apagados ao reiniciar o aplicativo. O registro é demonstrativo e não é enviado à prefeitura.</Notice>
      <Button title="Voltar ao início" onPress={() => navigation.popTo('MainTabs')} />
    </View></ScrollView></Screen>;

  return <Screen keyboard>
    <BackHeader title="Nova ocorrência" onBack={() => navigation.goBack()} />
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={ui.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tipo do problema</Text>
        <View style={styles.grid}>
          {CATEGORIES.map((category) => <Pressable key={category.id} accessibilityRole="radio" accessibilityState={{ checked: categoryId === category.id }}
            onPress={() => setCategoryId(category.id)} style={({ pressed }) => [styles.category, categoryId === category.id && styles.selected, pressed && ui.pressed]}>
            <View style={[styles.icon, { backgroundColor: category.color }]}><Text style={styles.emoji}>{category.icon}</Text></View>
            <View style={ui.flex}><Text style={ui.label}>{category.label}</Text><Text style={styles.categoryHint}>{category.hint}</Text></View>
          </Pressable>)}
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Foto do local <Text style={styles.optional}>(opcional)</Text></Text>
        <Notice>A foto será exibida inteira, sem recorte solicitado pelo FalaAí.</Notice>
        <Button title={busy === 'camera' ? 'Abrindo câmera…' : 'Tirar foto'} secondary onPress={() => void pickImage('camera')} busy={busy === 'camera'} disabled={busy !== null} />
        <Button title={busy === 'gallery' ? 'Abrindo galeria…' : 'Escolher da galeria'} secondary onPress={() => void pickImage('gallery')} busy={busy === 'gallery'} disabled={busy !== null} />
        {photoError ? <Notice error>{photoError}</Notice> : null}
        {photo && <><ReportPhoto uri={photo} /><Button title="Remover foto" secondary onPress={() => setPhoto(null)} disabled={busy !== null} /></>}
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Descrição *</Text>
        <TextInput ref={descriptionInput} accessibilityLabel="Descrição do problema, mínimo de 20 caracteres" style={[ui.input, styles.textArea, errors.description && ui.inputError]}
          placeholder="Conte o que aconteceu..." placeholderTextColor="#64748b" multiline maxLength={400} value={description}
          onChangeText={(value) => { setDescription(value); clearFieldError('description'); }} />
        <Text style={styles.count}>{description.trim().length}/400 · mínimo de 20 caracteres</Text>
        {errors.description && <Notice error>{errors.description}</Notice>}
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Localização *</Text>
        <Notice>Use o GPS no local do problema. Se estiver em outro lugar, informe o endereço manualmente e não capture seu GPS.</Notice>
        <Button title={busy === 'gps' ? 'Buscando localização…' : coordinates ? 'Atualizar localização GPS' : 'Usar localização atual (GPS)'} secondary onPress={() => void captureLocation()} busy={busy === 'gps'} disabled={busy !== null} />
        {busy === 'gps' && <Notice>Buscando sua localização (até 20 segundos)...</Notice>}
        {gpsError ? <Notice error>{gpsError}{coordinates ? ' A localização anterior foi mantida.' : ''}</Notice> : null}
        {coordinates && <>
          <Notice>Localização GPS capturada: {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}</Notice>
          <Button title="Remover GPS e usar só endereço" secondary onPress={() => setCoordinates(null)} disabled={busy !== null} />
        </>}
        <Text style={ui.label}>Endereço ou ponto de referência</Text>
        <TextInput ref={locationInput} accessibilityLabel="Endereço ou ponto de referência" style={[ui.input, errors.location && ui.inputError]} maxLength={200}
          placeholder="Rua, número, bairro ou referência" placeholderTextColor="#64748b" value={location} onChangeText={(value) => { setLocation(value); clearFieldError('location'); }} />
        <Notice>Sem GPS, a ocorrência será listada com o endereço, sem marcador no mapa.</Notice>
        {errors.location && <Notice error>{errors.location}</Notice>}
      </View>
      {errors.form && <Notice error>{errors.form}</Notice>}
      <Button title="Enviar ocorrência" onPress={handleSubmit} disabled={busy !== null} />
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  successContent: { flexGrow: 1, justifyContent: 'center' },
  successCard: { padding: 24, gap: 20 },
  successIcon: { alignSelf: 'flex-start', backgroundColor: '#dcfce7', borderRadius: 20, padding: 12 },
  section: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.subtleBorder, borderRadius: 20, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.navy },
  optional: { fontSize: 14, fontWeight: '400', color: colors.secondary },
  categoryHint: { fontSize: 13, lineHeight: 18, color: colors.secondary },
  grid: { gap: 8 },
  category: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 10, borderRadius: 12, borderWidth: 2, borderColor: '#e2e8f0', minHeight: 60 },
  selected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  icon: { padding: 8, borderRadius: 10 },
  emoji: { fontSize: 20 },
  textArea: { minHeight: 130, textAlignVertical: 'top' },
  count: { textAlign: 'right', color: colors.secondary, fontSize: 13, lineHeight: 20 },
});
