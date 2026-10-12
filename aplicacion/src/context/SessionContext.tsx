import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type UserRole = 'citizen' | 'admin' | 'superadmin' | 'maintenance' | 'employee';

type SessionContextValue = {
  role: UserRole;
  email: string;
  department: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('citizen');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));

  const applyIdentity = (value?: string | null) => {
    const normalizedEmail = value?.trim().toLowerCase() ?? '';
    setEmail(normalizedEmail);
    setIsAuthenticated(Boolean(normalizedEmail));

    if (normalizedEmail.startsWith('superadmin')) {
      setRole('superadmin');
      setDepartment(null);
    } else if (normalizedEmail.startsWith('admin')) {
      setRole('admin');
      setDepartment(null);
    } else if (normalizedEmail.includes('mantenimiento.agua')) {
      setRole('maintenance');
      setDepartment('Agua potable');
    } else if (normalizedEmail.includes('empleado.agua')) {
      setRole('employee');
      setDepartment('Agua potable');
    } else {
      setRole('citizen');
      setDepartment(null);
    }
  };

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      applyIdentity(data.session?.user.email);
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      applyIdentity(session?.user.email);
      setIsLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      role,
      email,
      department,
      isAuthenticated,
      isLoading,
      signIn: async (value: string, password: string) => {
        if (!isSupabaseConfigured || !supabase) throw new Error('Supabase no está configurado.');
        const { error } = await supabase.auth.signInWithPassword({ email: value.trim().toLowerCase(), password });
        if (error) throw error;
      },
      signUp: async (name: string, value: string, password: string) => {
        if (!isSupabaseConfigured || !supabase) throw new Error('Supabase no está configurado.');
        const { data, error } = await supabase.auth.signUp({
          email: value.trim().toLowerCase(),
          password,
          options: { data: { full_name: name.trim(), role: 'citizen' } }
        });
        if (error) throw error;
        return Boolean(data.session);
      },
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
        applyIdentity(null);
      }
    }),
    [department, email, isAuthenticated, isLoading, role]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession debe utilizarse dentro de SessionProvider.');
  return session;
}
