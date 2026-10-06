import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

export type UserRole = 'citizen' | 'admin' | 'maintenance_manager' | 'maintenance_employee';

type SessionContextValue = {
  role: UserRole;
  email: string;
  department: string | null;
  departmentLabel: string | null;
  signIn: (email: string) => void;
  signOut: () => void;
};

const maintenanceAccounts: Record<string, { category: string; label: string }> = {
  'mantenimiento.agua': { category: 'Agua potable', label: 'Agua de Zacapa' },
  'mantenimiento.luz': { category: 'Alumbrado público', label: 'Luz (EEMZA)' },
  'mantenimiento.eemza': { category: 'Alumbrado público', label: 'Luz (EEMZA)' },
  'mantenimiento.limpieza': { category: 'Limpieza', label: 'Limpieza municipal' },
  'mantenimiento.secretaria': { category: 'Secretaría', label: 'Secretaría municipal' },
  'secretaria': { category: 'Secretaría', label: 'Secretaría municipal' }
};

const maintenanceEmployeeAccounts: Record<string, { category: string; label: string }> = {
  'empleado.agua': { category: 'Agua potable', label: 'Agua de Zacapa' },
  'empleado.luz': { category: 'Alumbrado público', label: 'Luz (EEMZA)' },
  'empleado.eemza': { category: 'Alumbrado público', label: 'Luz (EEMZA)' },
  'empleado.limpieza': { category: 'Limpieza', label: 'Limpieza municipal' },
  'empleado.secretaria': { category: 'Secretaría', label: 'Secretaría municipal' }
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('citizen');
  const [email, setEmail] = useState('ciudadano@zacapp.gt');
  const [department, setDepartment] = useState<string | null>(null);
  const [departmentLabel, setDepartmentLabel] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      role,
      email,
      department,
      departmentLabel,
      signIn: (value: string) => {
        const normalizedEmail = value.trim().toLowerCase();
        setEmail(normalizedEmail);
        if (normalizedEmail.startsWith('superadmin') || normalizedEmail.startsWith('admin')) {
          setRole('admin');
          setDepartment(null);
          setDepartmentLabel(null);
        } else {
          const employeeAccount = Object.entries(maintenanceEmployeeAccounts).find(([key]) => normalizedEmail.includes(key))?.[1];
          if (employeeAccount) {
            setRole('maintenance_employee');
            setDepartment(employeeAccount.category);
            setDepartmentLabel(employeeAccount.label);
            return;
          }

          const account = Object.entries(maintenanceAccounts).find(([key]) => normalizedEmail.includes(key))?.[1];
          if (account) {
            setRole('maintenance_manager');
            setDepartment(account.category);
            setDepartmentLabel(account.label);
            return;
          }
          setRole('citizen');
          setDepartment(null);
          setDepartmentLabel(null);
        }
      },
      signOut: () => {
        setRole('citizen');
        setEmail('ciudadano@zacapp.gt');
        setDepartment(null);
        setDepartmentLabel(null);
      }
    }),
    [department, departmentLabel, email, role]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession debe utilizarse dentro de SessionProvider.');
  return session;
}
