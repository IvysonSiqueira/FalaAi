import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppColors as colors, AppRadius as radius, AppSpacing as space } from '../constants/theme';
import { getCategory } from '../constants/categories';
import type { Occurrence, OccurrenceStatus } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({ children, keyboard = false, tab = false }: { children: ReactNode; keyboard?: boolean; tab?: boolean }) {
  return (
    <SafeAreaView style={ui.screen} edges={tab ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={ui.screenContent} enabled={keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Button({ title, onPress, busy = false, disabled = false, secondary = false, destructive = false }: {
  title: string; onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean; destructive?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy} onPress={onPress}
      style={({ pressed }) => [ui.button, secondary && ui.secondaryButton, destructive && ui.destructiveButton, (disabled || busy) ? ui.disabledButton : pressed && (destructive ? ui.destructivePressed : secondary ? ui.secondaryPressed : ui.buttonPressed)]}>
      {busy && <ActivityIndicator color={colors.primary} />}
      <Text style={[ui.buttonText, secondary && ui.secondaryText, destructive && ui.error, (disabled || busy) && ui.disabledText]}>{title}</Text>
    </Pressable>
  );
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <Text accessibilityLiveRegion="polite" style={[ui.notice, error && ui.error]}>{children}</Text>;
}

export function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <View style={ui.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} style={({ pressed }) => [ui.back, pressed && ui.secondaryPressed]}>
      <Text style={ui.backText}>‹</Text>
    </Pressable>
    <Text style={ui.headerTitle}>{title}</Text>
  </View>;
}

function PhotoContent({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  // A proporção inicial é apenas um espaço de carregamento; contain nunca corta a foto.
  const [aspectRatio, setAspectRatio] = useState(4 / 3);
  if (failed) return <View style={[ui.card, ui.photoUnavailable]}>
    <Text style={ui.label}>Foto indisponível</Text>
    <Notice>Não foi possível carregar esta foto. O arquivo pode não estar mais disponível neste dispositivo.</Notice>
  </View>;
  return <View style={ui.photoFrame}>
    <Image accessibilityLabel="Foto completa da ocorrência" source={{ uri }} resizeMode="contain"
      style={[ui.photo, { aspectRatio }]}
      onLoad={({ nativeEvent }) => {
        const { width, height } = nativeEvent.source;
        if (width > 0 && height > 0) setAspectRatio(width / height);
        setLoading(false);
      }}
      onError={() => { setFailed(true); setLoading(false); }} />
    {loading && <View pointerEvents="none" style={ui.photoLoading}><ActivityIndicator color={colors.primary} /><Notice>Carregando foto…</Notice></View>}
  </View>;
}
export function ReportPhoto({ uri }: { uri: string }) {
  return <PhotoContent key={uri} uri={uri} />;
}

export function StatusBadge({ status }: { status: OccurrenceStatus }) {
  return <View style={[ui.badge, status === 'Resolvida' && ui.resolvedBadge, status === 'Em análise' && ui.reviewBadge]}>
    <Text style={[ui.badgeText, status === 'Resolvida' && ui.resolvedText, status === 'Em análise' && ui.reviewText]}>{status}</Text>
  </View>;
}

export function OccurrenceCard({ report, onPress }: { report: Occurrence; onPress: () => void }) {
  const category = getCategory(report.categoryId);
  const validDate = report.createdAt && Number.isFinite(Date.parse(report.createdAt));
  return <Pressable accessibilityRole="button" accessibilityLabel={`Ver detalhes: ${report.title}. ${report.status}. ${report.location || ''}`}
    onPress={onPress} style={({ pressed }) => [ui.card, pressed && ui.secondaryPressed]}>
    <View style={ui.cardHeading}>
      <View style={[ui.categoryIcon, { backgroundColor: category.color }]}><Text accessible={false} style={{ fontSize: 22 }}>{category.icon}</Text></View>
      <View style={ui.flex}>
        <Text style={ui.cardTitle}>{report.title || category.label}</Text>
        {report.title && report.title !== category.label && <Text style={ui.subtitle}>{category.label}</Text>}
      </View>
      <StatusBadge status={report.status} />
    </View>
    <Text style={ui.body} numberOfLines={3}>{report.description}</Text>
    <View style={ui.cardFooter}>
      <Text style={ui.subtitle} numberOfLines={2}>{report.location?.trim() || (report.coordinates ? 'Local registrado por GPS' : 'Endereço não informado')}</Text>
      {validDate ? <Text style={ui.notice}>Registrada em {new Date(report.createdAt).toLocaleDateString('pt-BR')}</Text> : null}
    </View>
  </Pressable>;
}

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  screenContent: { flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center' },
  content: { padding: space.screen, paddingBottom: space.xxl, gap: space.lg },
  title: { fontSize: 28, fontWeight: '800', color: colors.navy },
  subtitle: { fontSize: 14, color: colors.secondary, lineHeight: 21 },
  label: { fontSize: 15, fontWeight: '700', color: colors.navy },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: colors.navy, minHeight: 48 },
  inputError: { borderColor: colors.error },
  button: { minHeight: 48, padding: 14, borderRadius: radius.control, backgroundColor: colors.primary, flexDirection: 'row', gap: 10, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  secondaryButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.navy },
  buttonPressed: { backgroundColor: colors.primaryPressed },
  secondaryPressed: { backgroundColor: colors.activeSurface, borderColor: colors.primary },
  disabledButton: { backgroundColor: '#e2e8f0', borderWidth: 1, borderColor: colors.border },
  disabledText: { color: colors.secondary },
  pressed: { opacity: 0.8 },
  notice: { color: colors.secondary, fontSize: 13, lineHeight: 20 },
  error: { color: colors.error },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  back: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 32, color: colors.navy },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.navy },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: space.lg, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  body: { fontSize: 16, lineHeight: 24, color: colors.navy },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.navy },
  field: { gap: 6 },
  destructivePressed: { backgroundColor: '#fff1f2' },
  destructiveButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: '#fecaca' },
  cardHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: colors.navy },
  categoryIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardFooter: { borderTopWidth: 1, borderTopColor: colors.subtleBorder, paddingTop: 10, gap: 4 },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#dbeafe' },
  badgeText: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#1d4ed8' },
  resolvedBadge: { backgroundColor: '#dcfce7' },
  resolvedText: { color: '#166534' },
  reviewBadge: { backgroundColor: '#fef3c7' },
  reviewText: { color: '#92400e' },
  photoFrame: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#eef2f6', borderWidth: 1, borderColor: colors.subtleBorder },
  photo: { width: '100%' },
  photoUnavailable: { paddingVertical: 24 },
  photoLoading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#eef2f6' },
});
