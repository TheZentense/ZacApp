import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

export type UserRole = 'citizen' | 'admin' | 'maintenance';

type SessionContextValue = {
  role: UserRole;
  email: string;
  department: string | null;
  signIn: (email: string) => void;
  signOut: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('citizen');
  const [email, setEmail] = useState('ciudadano@zacapp.gt');
  const [department, setDepartment] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      role,
      email,
      department,
      signIn: (value: string) => {
        const normalizedEmail = value.trim().toLowerCase();
        setEmail(normalizedEmail);
        if (normalizedEmail.startsWith('superadmin') || normalizedEmail.startsWith('admin')) {
          setRole('admin');
          setDepartment(null);
        } else if (normalizedEmail.includes('mantenimiento.agua')) {
          setRole('maintenance');
          setDepartment('Agua potable');
        } else {
          setRole('citizen');
          setDepartment(null);
        }
      },
      signOut: () => {
        setRole('citizen');
        setEmail('ciudadano@zacapp.gt');
        setDepartment(null);
      }
    }),
    [department, email, role]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession debe utilizarse dentro de SessionProvider.');
  return session;
}
