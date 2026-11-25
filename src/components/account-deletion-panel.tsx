import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, AppState, Modal, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Notice, Screen, ui } from './app-ui';
import { useApp } from '../context/AppContext';
import { PRIVACY_NOTICE, PRIVACY_VERSION } from '../lib/privacy';
import { createDeletionFlow, deletionMessages, type DeletionView } from '../services/account-deletion';

export default function AccountDeletionPanel({ ownerId }: { ownerId: string }) {
  const { accountDeletionEnabled, requestAccountDeletion, checkAccountDeletionPending, finishAccountDeletion, signOut } = useApp();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [exitError, setExitError] = useState(false);
  const [view, setView] = useState<DeletionView>({ kind: 'idle', open: false });
  const complete = useCallback(async () => {
    await finishAccountDeletion(ownerId);
    Alert.alert('Conta excluída', 'O servidor confirmou a exclusão. A sessão e os dados desta conta foram removidos do aplicativo.');
  }, [finishAccountDeletion, ownerId]);
  const flow = useMemo(() => createDeletionFlow(requestAccountDeletion, complete, setView), [requestAccountDeletion, complete]);
  useEffect(() => { flow.activate(); return () => flow.dispose(); }, [flow]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') setPassword(''); });
    return () => subscription.remove();
  }, []);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (accountDeletionEnabled) void checkAccountDeletionPending().then((pending) => { if (active) flow.restore(pending); })
      .catch(() => { if (active) flow.restore(null); });
    return () => { active = false; setPassword(''); };
  }, [accountDeletionEnabled, checkAccountDeletionPending, flow]));
  const busy = view.kind === 'submitting';
  const cleanupOnly = view.kind === 'cleanup-required';
  const resuming = ['pending', 'retry', 'unknown', 'session-unavailable'].includes(view.kind);
  function cancel() { if (!busy) { setPassword(''); setExitError(false); flow.cancel(); } }
  function submit() {
    if (busy) return;
    const entered = password;
    setPassword('');
    void flow.submit(entered);
  }
  async function leaveUnconfirmed() {
    setPassword('');
    setExitError(false);
    try { await signOut(); }
    catch { setExitError(true); }
  }
  return <View style={ui.card}>
    <Text style={ui.sectionTitle} accessibilityRole="header">Privacidade</Text>
    <Button title={privacyOpen ? 'Fechar aviso de privacidade' : 'Consultar aviso de privacidade'} secondary onPress={() => setPrivacyOpen((value) => !value)} />
    {privacyOpen && <View style={ui.field}>
      <Text style={ui.subtitle}>Versão {PRIVACY_VERSION}</Text>
      <Text selectable style={ui.body}>{PRIVACY_NOTICE}</Text>
    </View>}
    <Notice>{accountDeletionEnabled
      ? 'Exclusão disponível para validação neste ambiente isolado. A remoção definitiva exige sua senha e confirmação.'
      : 'A exclusão permanece desabilitada neste ambiente até a implantação autorizada. Você pode consultar o aviso de privacidade.'}</Notice>
    {!view.open && deletionMessages[view.kind] && <Notice error>{deletionMessages[view.kind]}</Notice>}
    <Button title={resuming ? 'Retomar exclusão da minha conta' : 'Excluir minha conta'} destructive disabled={!accountDeletionEnabled}
      onPress={() => { setPassword(''); flow.open(); }} />
    <Modal visible={view.open} animationType="slide" onRequestClose={cancel}>
      <Screen keyboard>
        <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={ui.content}>
          <View accessibilityViewIsModal style={ui.field}>
            <Text style={ui.title} accessibilityRole="header">Excluir minha conta</Text>
            <Notice error>Esta ação é definitiva. Sua conta, seus relatos e suas fotografias serão removidos. Uma limpeza já iniciada não pode ser desfeita.</Notice>
            <Text style={ui.body}>Você pode cancelar antes de enviar. Se houver uma interrupção depois do envio, retome com esta mesma conta até a conclusão. Não criaremos outra conta nem apagaremos dados de outros usuários.</Text>
            {deletionMessages[view.kind] && <Notice error>{deletionMessages[view.kind]}</Notice>}
            {!cleanupOnly && <View style={ui.field}>
              <Text style={ui.label}>Senha atual desta conta</Text>
              <TextInput accessibilityLabel="Senha atual para confirmar exclusão da conta" style={ui.input}
                value={password} onChangeText={setPassword} secureTextEntry editable={!busy} maxLength={128}
                autoCapitalize="none" autoCorrect={false} textContentType="password" autoComplete="current-password"
                returnKeyType="done" onSubmitEditing={submit} />
              <Text style={ui.subtitle}>A senha será usada somente para reautenticar esta solicitação. Não será salva.</Text>
            </View>}
            {busy && <Notice>Conferindo a solicitação… Nenhum sucesso será informado antes da confirmação do servidor.</Notice>}
            <Button title={cleanupOnly ? 'Concluir limpeza local' : resuming ? 'Retomar exclusão' : 'Confirmar exclusão definitiva'}
              destructive busy={busy} disabled={!cleanupOnly && !password} onPress={submit} />
            <Button title={cleanupOnly ? 'Fechar — conta já excluída' : resuming ? 'Fechar e retomar depois' : 'Cancelar'} secondary disabled={busy} onPress={cancel} />
            {view.kind === 'session-unavailable' && <Button title="Sair deste aparelho sem confirmar exclusão" secondary onPress={() => { void leaveUnconfirmed(); }} />}
            {exitError && <Notice error>Não foi possível concluir a saída local. Tente novamente.</Notice>}
          </View>
        </ScrollView>
      </Screen>
    </Modal>
  </View>;
}
