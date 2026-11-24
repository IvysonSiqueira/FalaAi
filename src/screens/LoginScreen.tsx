import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Notice, Screen, ui } from '../components/app-ui';
import { AppColors as colors } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { PRIVACY_NOTICE, PRIVACY_VERSION, privacyRegistration } from '../lib/privacy';
import { isValidEmail } from '../utils/validation';

type FormErrors = { name?: string; email?: string; password?: string; form?: string };

export default function LoginScreen() {
  const { signIn, registerUser } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [accepted, setAccepted] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submitting = useRef(false);
  const nameInput = useRef<TextInput>(null);
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);
  const viewport = useRef<View>(null);
  const nameField = useRef<View>(null);
  const emailField = useRef<View>(null);
  const passwordField = useRef<View>(null);
  const passwordAndAction = useRef<View>(null);
  const focusedField = useRef<'name' | 'email' | 'password' | null>(null);
  const scrollOffset = useRef(0);
  const frame = useRef<number | null>(null);

  const revealFocusedField = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const focused = focusedField.current;
      if (!focused) return;
      const field = focused === 'name' ? nameField.current : focused === 'email' ? emailField.current : passwordField.current;
      viewport.current?.measureInWindow((_x, top, _width, height) => {
        if (!height || focusedField.current !== focused) return;
        const reveal = (target: View | null) => target?.measureInWindow((_fieldX, fieldTop, _fieldWidth, fieldHeight) => {
          if (focusedField.current !== focused) return;
          // Desloca somente o necessário, deixando 16 pontos livres acima do teclado.
          const bottomOverflow = fieldTop + fieldHeight - (top + height - 16);
          const topOverflow = fieldTop - (top + 16);
          const delta = topOverflow < 0 ? topOverflow : Math.max(0, bottomOverflow);
          if (Math.abs(delta) > 1) scroll.current?.scrollTo({ y: Math.max(0, scrollOffset.current + delta), animated: false });
        });
        if (focused === 'password') {
          // Mantém senha e envio juntos quando cabem; com fonte grande, prioriza o campo.
          passwordAndAction.current?.measureInWindow((_x, _y, _width, blockHeight) => {
            reveal(blockHeight <= height - 32 ? passwordAndAction.current : field);
          });
        } else reveal(field);
      });
    });
  }, []);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', revealFocusedField);
    return () => {
      subscription.remove();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [revealFocusedField]);

  function focusField(field: 'name' | 'email' | 'password') {
    focusedField.current = field;
    revealFocusedField();
  }

  function clearFieldError(field: 'name' | 'email' | 'password') {
    setErrors((previous) => ({ ...previous, [field]: undefined, form: undefined }));
  }

  async function handleSubmit() {
    if (submitting.current) return;
    const nextErrors: FormErrors = {};
    if (mode === 'register' && !name.trim()) nextErrors.name = 'Informe seu nome.';
    if (!isValidEmail(email)) nextErrors.email = 'Digite um e-mail válido.';
    if (!password.trim()) nextErrors.password = 'Informe sua senha.';
    else if (mode === 'register' && password.length < 8) nextErrors.password = 'Use uma senha com pelo menos 8 caracteres.';
    if (mode === 'register' && !accepted) nextErrors.form = 'Leia o aviso e marque o aceite para criar sua conta.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (nextErrors.name) nameInput.current?.focus();
      else if (nextErrors.email) emailInput.current?.focus();
      else passwordInput.current?.focus();
      return;
    }
    submitting.current = true;
    setIsSubmitting(true);
    setMessage(null);
    try {
      if (mode === 'register') {
        const result = await registerUser({ name, email, password, ...privacyRegistration(accepted) });
        if (result !== 'signed-in') {
          setMode('login');
          setMessage(result === 'check-existing'
            ? 'Se este e-mail já tem conta, use Entrar. Se ainda não foi confirmado, verifique sua caixa de entrada e o spam.'
            : 'Confira sua caixa de entrada e o spam para confirmar o e-mail. Depois, volte ao aplicativo e entre com sua senha.');
        }
      } else await signIn({ email, password });
      setPassword('');
      // O navegador observa currentUser e troca automaticamente o fluxo de telas.
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Não foi possível entrar. Tente novamente.' });
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <Screen keyboard>
      <View ref={viewport} collapsable={false} style={ui.flex} onLayout={revealFocusedField}>
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="none"
          onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}
          contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <Text style={styles.brand}>FalaAí</Text>
            <Text style={styles.title}>Viu um problema? <Text style={styles.highlight}>FalaAí.</Text></Text>
            <Text style={styles.subtitle}>Ajude a transformar sua cidade através da participação cidadã.</Text>
          </View>
          <View style={styles.form}>
            <View style={styles.tabs}>
              {(['login', 'register'] as const).map((value) => (
                <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: mode === value }}
                  disabled={isSubmitting} onPress={() => { setMode(value); setAccepted(false); setErrors({}); setMessage(null); setPassword(''); }}
                  style={({ pressed }) => [styles.tab, mode === value && styles.selected, pressed && ui.pressed]}>
                  <Text style={[styles.tabText, mode === value && styles.selectedText]}>{value === 'login' ? 'Entrar' : 'Criar conta'}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.academicNotice}>
              <Notice>Protótipo acadêmico: conta e sessão no Supabase. Relatos são salvos no Supabase. Fotos selecionadas usam Storage privado. Use uma senha exclusiva de teste.</Notice>
            </View>
            {mode === 'register' && <View ref={nameField} collapsable={false} style={ui.field} onLayout={revealFocusedField}>
              <Text style={ui.label}>Nome</Text>
              <TextInput editable={!isSubmitting} ref={nameInput} accessibilityLabel="Nome" style={[ui.input, errors.name && ui.inputError]} value={name} onChangeText={(value) => { setName(value); clearFieldError('name'); }}
                placeholder="Seu nome" placeholderTextColor="#64748b" maxLength={80} autoComplete="name" returnKeyType="next" submitBehavior="submit"
                onFocus={() => focusField('name')} onBlur={() => { focusedField.current = null; }} onSubmitEditing={() => emailInput.current?.focus()} />
              {errors.name && <Notice error>{errors.name}</Notice>}
            </View>}
            <View ref={emailField} collapsable={false} style={ui.field} onLayout={revealFocusedField}>
              <Text style={ui.label}>E-mail</Text>
              <TextInput editable={!isSubmitting} ref={emailInput} accessibilityLabel="E-mail" style={[ui.input, errors.email && ui.inputError]} value={email} onChangeText={(value) => { setEmail(value); clearFieldError('email'); }}
                placeholder="seu@email.com" placeholderTextColor="#64748b" maxLength={254} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" returnKeyType="next" submitBehavior="submit"
                onFocus={() => focusField('email')} onBlur={() => { focusedField.current = null; }} onSubmitEditing={() => passwordInput.current?.focus()} />
              {errors.email && <Notice error>{errors.email}</Notice>}
              </View>
            <View ref={passwordAndAction} collapsable={false} style={styles.actionBlock} onLayout={revealFocusedField}>
              <View ref={passwordField} collapsable={false} style={ui.field} onLayout={revealFocusedField}>
                <Text style={ui.label}>Senha</Text>
                <TextInput editable={!isSubmitting} ref={passwordInput} accessibilityLabel="Senha" style={[ui.input, errors.password && ui.inputError]} value={password} onChangeText={(value) => { setPassword(value); clearFieldError('password'); }}
                  placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : 'Sua senha'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholderTextColor="#64748b" secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={128}
                  onFocus={() => focusField('password')} onBlur={() => { focusedField.current = null; }} onSubmitEditing={handleSubmit} returnKeyType="go" />
                {errors.password && <Notice error>{errors.password}</Notice>}
              </View>
              {mode === 'register' && <View style={{ gap: 8 }}>
                <Button secondary title={showPrivacy ? 'Recolher aviso de privacidade' : 'Ler aviso de privacidade'} onPress={() => setShowPrivacy(!showPrivacy)} />
                {showPrivacy && <Text selectable style={ui.body}>{PRIVACY_NOTICE}</Text>}
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted, disabled: isSubmitting }}
                  disabled={isSubmitting} onPress={() => { setAccepted(!accepted); setErrors(previous => ({ ...previous, form: undefined })); }}
                  style={({ pressed }) => [{ minHeight: 48, padding: 12, borderWidth: 1, borderColor: colors.primary, borderRadius: 12 }, pressed && ui.pressed]}>
                  <Text style={ui.body}>{accepted ? '☑' : '☐'} Li e aceito o aviso de privacidade ({PRIVACY_VERSION}).</Text>
                </Pressable>
              </View>}
              {message && <Notice>{message}</Notice>}
              {errors.form && <Notice error>{errors.form}</Notice>}
              <Button busy={isSubmitting} title={mode === 'login' ? 'Entrar' : 'Criar conta'} onPress={handleSubmit} />
            </View>
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.navy },
  header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24, gap: 8 },
  brand: { color: '#fff', fontSize: 28, fontWeight: '800', fontStyle: 'italic' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 30 },
  highlight: { color: '#93c5fd' },
  subtitle: { color: '#cbd5e1', fontSize: 14, lineHeight: 20 },
  form: { flexGrow: 1, backgroundColor: colors.background, padding: 20, paddingBottom: 32, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 12 },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: '#e2e8f0', borderRadius: 14 },
  tab: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderRadius: 10 },
  selected: { backgroundColor: colors.surface },
  tabText: { fontSize: 15, fontWeight: '600', color: colors.secondary },
  selectedText: { color: colors.primary, fontWeight: '800' },
  academicNotice: { gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#eff6ff' },
  actionBlock: { gap: 12 },
});
