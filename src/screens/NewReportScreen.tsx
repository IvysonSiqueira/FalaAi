import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../context/AppContext';

export default function NewReportScreen({ navigation }: any) {
  const { currentUser, addOccurrence } = useApp();
  const [category, setCategory] = useState('buraco');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [pinPos, setPinPos] = useState({ top: 90, left: 150 });

  const categories = [
    { id: 'buraco', label: 'Buraco na rua', hint: 'Asfalto ou via danificada', icon: '🚧', color: '#fef3c7', pinColor: '#c2410c' },
    { id: 'iluminacao', label: 'Iluminação', hint: 'Poste apagado ou quebrado', icon: '💡', color: '#e0f2fe', pinColor: '#15803d' },
    { id: 'lixo', label: 'Lixo acumulado', hint: 'Descarte irregular', icon: '🗑️', color: '#f1f5f9', pinColor: '#2563eb' },
    { id: 'vazamento', label: 'Vazamento', hint: 'Água ou esgoto aparente', icon: '💧', color: '#dbeafe', pinColor: '#2563eb' },
    { id: 'calcada', label: 'Calçada', hint: 'Piso irregular ou buraco', icon: '🚶', color: '#ffedd5', pinColor: '#15803d' },
    { id: 'outros', label: 'Outros', hint: 'Qualquer outro problema', icon: '⚠️', color: '#fee2e2', pinColor: '#15803d' },
  ];

  const suggestedPlaces = [
    'Rua das Palmeiras, 210', 'Av. Beira-Rio, 88', 'Praça da Matriz', 'Rua do Comércio, 45', 'Av. Central, 450', 'Largo São Pedro'
  ];

  async function pickImage() {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      alert('Precisamos de permissão para acessar a galeria de fotos!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  function handleSubmit() {
    if (!description.trim() || !location.trim()) {
      alert('Por favor, preencha a descrição e o local do problema.');
      return;
    }

    const selectedCategoryObj = categories.find(c => c.id === category);

    // Distribui os pins de forma ampla por toda a área do mapa (evitando que fiquem aglomerados)
    const randomTop = Math.floor(Math.random() * 110) + 30;  // Variação de altura no mapa
    const randomLeft = Math.floor(Math.random() * 260) + 40; // Variação horizontal no mapa

    const newReport = {
      id: Date.now().toString(),
      title: selectedCategoryObj?.label || 'Ocorrência',
      description,
      location,
      status: 'Aberta',
      category: selectedCategoryObj?.label || 'Outros',
      icon: selectedCategoryObj?.icon || '📌',
      color: selectedCategoryObj?.pinColor || '#2563eb',
      photo: photoUri,
      author: currentUser.name,
      top: randomTop,
      left: randomLeft,
    };

    addOccurrence(newReport);
    alert('Ocorrência adicionada com sucesso!');
    navigation.goBack();
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Nova ocorrência</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>Tipo do problema</Text>
        <View style={styles.grid}>
          {categories.map((item) => {
            const isSelected = category === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setCategory(item.id)}
                style={[styles.categoryCard, isSelected && styles.categorySelected]}
              >
                <View style={[styles.iconBox, { backgroundColor: item.color }]}>
                  <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryTitle}>{item.label}</Text>
                  <Text style={styles.categoryHint}>{item.hint}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Foto do local</Text>
        <Pressable style={styles.photoUploadBox} onPress={pickImage}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.previewImage} />
          ) : (
            <>
              <Text style={{ fontSize: 24, marginBottom: 4 }}>➕</Text>
              <Text style={styles.photoUploadText}>Toque para adicionar foto da galeria</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.sectionLabel}>Descrição</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Conte o que aconteceu, com o máximo de detalhe útil..."
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={4}
          maxLength={400}
          value={description}
          onChangeText={setDescription}
        />
        <Text style={styles.charCount}>{description.length}/20 mínimo</Text>

        <Text style={styles.sectionLabel}>Local</Text>
        <TextInput
          style={styles.input}
          placeholder="Rua, número ou ponto de referência"
          placeholderTextColor="#94a3b8"
          value={location}
          onChangeText={setLocation}
        />

        <View style={styles.chipsRow}>
          {suggestedPlaces.map((place) => (
            <Pressable key={place} onPress={() => setLocation(place)} style={styles.chip}>
              <Text style={styles.chipText}>{place}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Ponto no mapa</Text>
        <Text style={styles.mapSubtitle}>Toque no mapa para posicionar o pin.</Text>
        
        <Pressable 
          style={styles.mapCard}
          onPress={(e) => {
            const evt = e.nativeEvent;
            const safeTop = Math.min(Math.max(evt.locationY - 15, 20), 140);
            const safeLeft = Math.min(Math.max(evt.locationX - 10, 20), 320);
            setPinPos({ top: safeTop, left: safeLeft });
          }}
        >
          <View style={styles.regionCircle} />
          <View style={styles.regionBlock1}>
            <Text style={styles.regionText}>VILA NOVA</Text>
          </View>
          <View style={styles.regionBlock2}>
            <Text style={styles.regionText}>JARDINS</Text>
          </View>
          <View style={styles.river} />

          <View style={[styles.mapPin, { top: pinPos.top, left: pinPos.left }]}>
            <Text style={{ fontSize: 20 }}>📍</Text>
          </View>
        </Pressable>

        <Pressable style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Enviar ocorrência</Text>
        </Pressable>
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
  content: { paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 50 },
  sectionLabel: { fontSize: 16, fontWeight: '800', color: '#0b132b', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  categoryCard: { width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  categorySelected: { borderColor: '#2563eb', borderWidth: 2, backgroundColor: '#f8fafc' },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  categoryInfo: { flex: 1 },
  categoryTitle: { fontSize: 14, fontWeight: '800', color: '#0b132b' },
  categoryHint: { fontSize: 11, color: '#64748b', marginTop: 2 },
  photoUploadBox: { height: 140, backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 20, overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoUploadText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  textArea: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: '#0b132b', height: 120, textAlignVertical: 'top' },
  charCount: { textAlign: 'right', fontSize: 11, color: '#64748b', marginTop: 6, marginBottom: 16 },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: '#0b132b', marginBottom: 10 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  chipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  mapSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 10 },
  mapCard: { height: 180, backgroundColor: '#dce5d9', borderRadius: 20, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 24 },
  regionCircle: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#bcd3b8', top: 20, left: 20, opacity: 0.7 },
  regionBlock1: { position: 'absolute', width: 100, height: 45, borderRadius: 10, backgroundColor: '#cdd7cb', bottom: 30, left: 20, justifyContent: 'center', alignItems: 'center', opacity: 0.6 },
  regionBlock2: { position: 'absolute', width: 100, height: 45, borderRadius: 10, backgroundColor: '#cdd7cb', top: 20, right: 20, justifyContent: 'center', alignItems: 'center', opacity: 0.6 },
  river: { position: 'absolute', width: '120%', height: 40, backgroundColor: '#b8c9d9', bottom: 25, left: -10, transform: [{ rotate: '-8deg' }], opacity: 0.7, borderRadius: 10 },
  regionText: { fontSize: 10, fontWeight: '800', color: '#64748b', letterSpacing: 1 },
  mapPin: { position: 'absolute' },
  submitButton: { backgroundColor: '#2563eb', borderRadius: 16, paddingVertical: 18, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});