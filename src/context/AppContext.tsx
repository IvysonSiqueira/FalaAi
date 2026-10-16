import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Occurrence, User } from '../types';
import { isValidEmail, normalizeEmail } from '../utils/validation';

type DemoAccount = { user: User; password: string };
type Credentials = { email: string; password: string; name?: string };
type AppContextValue = {
  currentUser: User | null;
  occurrences: Occurrence[];
  signIn: (credentials: Credentials) => void;
  registerUser: (credentials: Credentials) => void;
  signOut: () => void;
  addOccurrence: (report: Occurrence) => void;
};
const DEMO_USER: User = { id: 'teste@email.com', name: 'Cidadão', email: 'teste@email.com' };
const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  // Login acadêmico: contas e senhas ficam somente na memória, nunca no armazenamento.
  const [accounts, setAccounts] = useState<DemoAccount[]>([{ user: DEMO_USER, password: '123456' }]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);

  function signIn({ email, password }: Credentials) {
    const account = accounts.find((item) => item.user.email === normalizeEmail(email) && item.password === password);
    if (!account) throw new Error('E-mail ou senha incorretos. Cadastre-se ou use a conta de demonstração.');
    setCurrentUser(account.user);
  }

  function registerUser({ name = '', email, password }: Credentials) {
    const normalizedEmail = normalizeEmail(email);
    if (!name.trim() || !isValidEmail(email) || password.length < 6 || !password.trim()) {
      throw new Error('Informe nome, e-mail válido e senha com pelo menos 6 caracteres.');
    }
    if (accounts.some((account) => account.user.email === normalizedEmail)) {
      throw new Error('Este e-mail já está cadastrado. Use a opção Entrar.');
    }
    const user: User = { id: normalizedEmail, name: name.trim(), email: normalizedEmail };
    setAccounts((previous) => [...previous, { user, password }]);
    setCurrentUser(user);
  }

  function addOccurrence(report: Occurrence) {
    if (!currentUser || report.authorId !== currentUser.id) throw new Error('Entre novamente para registrar a ocorrência.');
    setOccurrences((previous) => [report, ...previous]);
  }

  return (
    <AppContext.Provider value={{ currentUser, occurrences, signIn, registerUser, signOut: () => setCurrentUser(null), addOccurrence }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp deve ser usado dentro de AppProvider.');
  return context;
}
