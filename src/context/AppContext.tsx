import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext<any>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState({
    name: 'Cidadão',
    email: 'teste@email.com',
  });

  const [registeredUsers, setRegisteredUsers] = useState([
    { name: 'Cidadão', email: 'teste@email.com', password: '123456' }
  ]);

  const [occurrences, setOccurrences] = useState<any[]>([]);

  const registerUser = (newUser: { name: string; email: string; password: string }) => {
    setRegisteredUsers((prev) => [...prev, newUser]);
  };

  const addOccurrence = (newReport: any) => {
    setOccurrences((prev) => [newReport, ...prev]);
  };

  return (
    <AppContext.Provider value={{ currentUser, setCurrentUser, registeredUsers, registerUser, occurrences, addOccurrence }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}