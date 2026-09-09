import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../context/AppContext';

export default function LoginScreen({ navigation }: any) {
  const { setCurrentUser, registeredUsers, registerUser } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  function isValidEmail(val: string) {
    return val.includes('@') && val.includes('.');
  }

  function handleLogin() {
    let hasError = false;
    setEmailError('');
    setPasswordError('');

    if (!email.trim() || !isValidEmail(email)) {
      setEmailError('Digite um e-mail válido.');
      hasError = true;
    }

    if (!password || password.length < 6) {
      setPasswordError('A senha deve ter pelo menos 6 caracteres.');
      hasError = true;
    }

    if (hasError) return;

    if (mode === 'register') {
      if (!name.trim()) {
        alert('Por favor, informe seu nome.');
        return;
      }

      // Verifica se o e-mail já foi cadastrado
      const userExists = registeredUsers.find((u: any) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (userExists) {
        alert('Este e-mail já está cadastrado. Vá em "Entrar".');
        return;
      }

      // Cadastra o novo usuário
      registerUser({ name: name.trim(), email: email.trim(), password });
      setCurrentUser({ name: name.trim(), email: email.trim() });

      alert(`Conta criada com sucesso! Bem-vindo(a), ${name.trim()}!`);
      navigation.replace('MainTabs');

    } else {
      // Modo Entrar: Verifica se a conta realmente existe nos cadastros
      const foundUser = registeredUsers.find(
        (u: any) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
      );

      if (!foundUser) {
        alert('Conta não encontrada ou senha incorreta. Verifique os dados ou crie uma conta.');
        return;
      }

      // Se encontrou, define o usuário e entra
      setCurrentUser({ name: foundUser.name, email: foundUser.email });
      alert(`Bem-vindo(a) de volta, ${foundUser.name}!`);
      navigation.replace('MainTabs');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>FalaAí</Text>
        <Text style={styles.title}>
          Viu um problema?{'\n'}
          <Text style={styles.titleHighlight}>FalaAí.</Text>
        </Text>
        <Text style={styles.subtitle}>
          Ajude a transformar sua cidade através da participação cidadã.
        </Text>
      </View>

      <View style={styles.formCard}>
        <View style={styles.tabRow}>
          <Pressable 
            onPress={() => { setMode('login'); setEmailError(''); setPasswordError(''); }} 
            style={[styles.tabButton, mode === 'login' && styles.tabActive]}
          >
            <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Entrar</Text>
          </Pressable>
          <Pressable 
            onPress={() => { setMode('register'); setEmailError(''); setPasswordError(''); }} 
            style={[styles.tabButton, mode === 'register' && styles.tabActive]}
          >
            <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>Criar conta</Text>
          </Pressable>
        </View>

        {mode === 'register' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              placeholder="Seu nome"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
            />
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={[styles.input, emailError ? styles.inputError : null]}
            placeholder="seu@email.com"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={(text) => { setEmail(text); setEmailError(''); }}
          />
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={[styles.input, passwordError ? styles.inputError : null]}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            value={password}
            onChangeText={(text) => { setPassword(text); setPasswordError(''); }}
          />
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
        </View>

        <Pressable style={styles.submitButton} onPress={handleLogin}>
          <Text style={styles.submitButtonText}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#0b132b', justifyContent: 'space-between' },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 30 },
  brand: { fontSize: 32, fontStyle: 'italic', fontWeight: '900', color: '#ffffff' },
  title: { fontSize: 28, fontWeight: '700', color: '#ffffff', marginTop: 20, lineHeight: 36 },
  titleHighlight: { color: '#93c5fd' },
  subtitle: { fontSize: 14, color: '#94a3b8', marginTop: 12, lineHeight: 20 },
  formCard: { backgroundColor: '#f8f5f0', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginBottom: 20 },
  tabButton: { paddingBottom: 12, marginRight: 24 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#2563eb', fontWeight: 'bold' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#0b132b', marginBottom: 6 },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: '#0b132b' },
  inputError: { borderColor: '#dc2626', borderWidth: 1.5 },
  errorText: { color: '#dc2626', fontSize: 12, marginTop: 4, fontWeight: '600' },
  submitButton: { backgroundColor: '#0b132b', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 10, marginBottom: 16 },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});