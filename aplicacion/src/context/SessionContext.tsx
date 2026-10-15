import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type UserRole = 'citizen' | 'admin' | 'superadmin' | 'maintenance' | 'employee';

type SessionContextValue = {
  role: UserRole;
  email: string;
  fullName: string;
  phone: string;
  department: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  requestPasswordReset: (email: string, redirectTo: string) => Promise<void>;
  completePasswordRecovery: (newPassword: string) => Promise<void>;
  updateProfile: (name: string, phone: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('citizen');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));

  const applyEmailFallback = useCallback((value?: string | null) => {
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
  }, []);

  const hydrateIdentity = useCallback(async (user?: User | null) => {
    if (!user) {
      applyEmailFallback(null);
      setFullName('');
      setPhone('');
      return true;
    }

    applyEmailFallback(user.email);
    setFullName(typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '');
    if (!supabase) return true;

    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, phone, role, status, department:departments(name)')
      .eq('id', user.id)
      .single();

    if (error || !data) return true;
    if (data.status === 'INACTIVO') {
      applyEmailFallback(null);
      setFullName('');
      setPhone('');
      setDepartment(null);
      return false;
    }
    const databaseRole = data.role as string;
    const departmentData = data.department as unknown as { name?: string } | { name?: string }[] | null;
    const departmentName = Array.isArray(departmentData) ? departmentData[0]?.name : departmentData?.name;
    const normalizedEmail = user.email?.trim().toLowerCase() ?? '';

    if (normalizedEmail.startsWith('superadmin')) setRole('superadmin');
    else if (databaseRole === 'administrador' || databaseRole === 'supervisor') setRole('admin');
    else if (databaseRole === 'mantenimiento') setRole('maintenance');
    else if (['operador', 'coordinador', 'comunicacion'].includes(databaseRole)) setRole('employee');
    else setRole('citizen');

    setFullName(data.full_name || '');
    setPhone(data.phone || '');
    setDepartment(departmentName ?? null);
    return true;
  }, [applyEmailFallback]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    client.auth.getSession().then(async ({ data }) => {
      const isActive = await hydrateIdentity(data.session?.user);
      if (!isActive) await client.auth.signOut({ scope: 'local' });
      setIsLoading(false);
    });

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      hydrateIdentity(session?.user).finally(() => setIsLoading(false));
    });

    return () => data.subscription.unsubscribe();
  }, [hydrateIdentity]);

  const value = useMemo(
    () => ({
      role,
      email,
      fullName,
      phone,
      department,
      isAuthenticated,
      isLoading,
      signIn: async (value: string, password: string) => {
        if (!isSupabaseConfigured || !supabase) throw new Error('Supabase no está configurado.');
        const { data, error } = await supabase.auth.signInWithPassword({ email: value.trim().toLowerCase(), password });
        if (error) throw error;
        const isActive = await hydrateIdentity(data.user);
        if (!isActive) {
          await supabase.auth.signOut({ scope: 'local' });
          throw new Error('account inactive');
        }
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
      updatePassword: async (currentPassword: string, newPassword: string) => {
        if (!supabase) throw new Error('Supabase no está configurado.');
        const { error } = await supabase.auth.updateUser({ password: newPassword, current_password: currentPassword });
        if (error) throw error;
      },
      requestPasswordReset: async (value: string, redirectTo: string) => {
        if (!supabase) throw new Error('Supabase no está configurado.');
        const { error } = await supabase.auth.resetPasswordForEmail(value.trim().toLowerCase(), { redirectTo });
        if (error) throw error;
      },
      completePasswordRecovery: async (newPassword: string) => {
        if (!supabase) throw new Error('Supabase no está configurado.');
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      },
      updateProfile: async (name: string, phoneValue: string) => {
        if (!supabase) throw new Error('Supabase no está configurado.');
        const normalizedName = name.trim();
        const normalizedPhone = phoneValue.trim();
        const { error } = await supabase.rpc('update_own_profile', {
          p_full_name: normalizedName,
          p_phone: normalizedPhone || null
        });
        if (error) throw error;
        setFullName(normalizedName);
        setPhone(normalizedPhone);
      },
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
        await hydrateIdentity(null);
      }
    }),
    [department, email, fullName, hydrateIdentity, isAuthenticated, isLoading, phone, role]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession debe utilizarse dentro de SessionProvider.');
  return session;
}
