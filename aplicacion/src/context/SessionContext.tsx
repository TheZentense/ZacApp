import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import type { MaintenanceDepartment } from '@/types/domain';

export type UserRole = 'citizen' | 'admin' | 'maintenance';

type SessionContextValue = {
  role: UserRole;
  email: string;
  department: MaintenanceDepartment | null;
  signIn: (email: string) => void;
  signOut: () => void;
  setDemoRole: (role: UserRole, department?: MaintenanceDepartment | null) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('citizen');
  const [email, setEmail] = useState('ciudadano@zacapp.gt');
  const [department, setDepartment] = useState<MaintenanceDepartment | null>(null);

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
          setDepartment('Agua');
        } else if (normalizedEmail.includes('mantenimiento.eemza')) {
          setRole('maintenance');
          setDepartment('EEMZA');
        } else {
          setRole('citizen');
          setDepartment(null);
        }
      },
      signOut: () => {
        setRole('citizen');
        setEmail('ciudadano@zacapp.gt');
        setDepartment(null);
      },
      setDemoRole: (nextRole: UserRole, nextDepartment: MaintenanceDepartment | null = null) => {
        setRole(nextRole);
        setDepartment(nextRole === 'maintenance' ? nextDepartment ?? 'Agua' : null);
        if (nextRole === 'admin') setEmail('admin@zacapp.gt');
        else if (nextRole === 'maintenance') setEmail(nextDepartment === 'EEMZA' ? 'mantenimiento.eemza@zacapp.gt' : 'mantenimiento.agua@zacapp.gt');
        else setEmail('ciudadano@zacapp.gt');
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
