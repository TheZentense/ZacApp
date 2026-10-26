import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { UserRole as DatabaseRole } from '@/types/domain';
import { isDatabaseRole, visualRoleFor } from '@/services/sessionPolicy';

export type UserRole = 'citizen' | 'admin' | 'superadmin' | 'maintenance' | 'employee';

type SessionContextValue = {
  role: UserRole;
  email: string;
  fullName: string;
  phone: string;
  databaseRole: DatabaseRole | null;
  userId: string | null;
  departmentId: number | null;
  profileError: string;
  isPasswordRecovery: boolean;
  department: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signInAsGuest: (captchaToken?: string) => Promise<void>;
  linkGuestEmail: (name: string, email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, captchaToken?: string) => Promise<boolean>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  requestPasswordReset: (email: string, redirectTo: string, captchaToken?: string) => Promise<void>;
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
  const [databaseRole, setDatabaseRole] = useState<DatabaseRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [profileError, setProfileError] = useState('');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const recoveryRef = useRef(false);
  const identityVersion = useRef(0);
  const [department, setDepartment] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));

  const applyEmailFallback = useCallback((value?: string | null) => {
    const normalizedEmail = value?.trim().toLowerCase() ?? '';
    setEmail(normalizedEmail);
    setIsAuthenticated(Boolean(normalizedEmail));
    setIsGuest(false);

    setRole('citizen');
    setDatabaseRole(null);
    setUserId(null);
    setDepartmentId(null);
    setDepartment(null);
  }, []);

  const hydrateIdentity = useCallback(async (user?: User | null) => {
    const version = ++identityVersion.current;
    const isCurrentIdentity = () => version === identityVersion.current;
    if (!user) {
      applyEmailFallback(null);
      setFullName('');
      setPhone('');
      setProfileError('');
      return true;
    }

    const anonymousIdentity = user.is_anonymous === true;
    setEmail(user.email?.trim().toLowerCase() ?? '');
    setIsAuthenticated(true);
    setIsGuest(anonymousIdentity);
    setRole('citizen');
    setDatabaseRole(null);
    setUserId(user.id);
    setDepartmentId(null);
    setDepartment(null);
    setFullName(typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '');
    if (!supabase) return true;

    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, phone, role, status, department_id, department:departments(name)')
      .eq('id', user.id)
      .single();

    if (!isCurrentIdentity()) return true;
    if (error || !data || !isDatabaseRole(data.role)) {
      setProfileError('No fue posible verificar tu perfil. Las funciones del personal no están disponibles.');
      return true;
    }
    if (data.status === 'INACTIVO') {
      applyEmailFallback(null);
      setFullName('');
      setPhone('');
      setDepartment(null);
      return false;
    }
    const verifiedDatabaseRole = data.role;
    const departmentData = data.department as unknown as { name?: string } | { name?: string }[] | null;
    const departmentName = Array.isArray(departmentData) ? departmentData[0]?.name : departmentData?.name;
    setDatabaseRole(verifiedDatabaseRole);
    setUserId(user.id);
    setDepartmentId(typeof data.department_id === 'number' ? data.department_id : null);
    setRole(visualRoleFor(verifiedDatabaseRole));

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

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveryRef.current = true;
        setIsPasswordRecovery(true);
      }
      if (event === 'SIGNED_OUT') {
        recoveryRef.current = false;
        setIsPasswordRecovery(false);
      }
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
      databaseRole,
      userId,
      departmentId,
      profileError,
      isPasswordRecovery,
      department,
      isAuthenticated,
      isGuest,
      isLoading,
      signIn: async (value: string, password: string, captchaToken?: string) => {
        if (!isSupabaseConfigured || !supabase) throw new Error('Supabase no está configurado.');
        const { data, error } = await supabase.auth.signInWithPassword({
          email: value.trim().toLowerCase(),
          password,
          options: captchaToken ? { captchaToken } : undefined
        });
        if (error) throw error;
        const isActive = await hydrateIdentity(data.user);
        if (!isActive) {
          await supabase.auth.signOut({ scope: 'local' });
          throw new Error('account inactive');
        }
      },
      signInAsGuest: async (captchaToken?: string) => {
        if (!isSupabaseConfigured || !supabase) throw new Error('Supabase no está configurado.');
        const options = captchaToken ? { captchaToken, data: { full_name: 'Ciudadano invitado' } } : { data: { full_name: 'Ciudadano invitado' } };
        const { data, error } = await supabase.auth.signInAnonymously({ options });
        if (error) throw error;
        const isActive = await hydrateIdentity(data.user);
        if (!isActive) {
          await supabase.auth.signOut({ scope: 'local' });
          throw new Error('guest access unavailable');
        }
      },
      linkGuestEmail: async (name: string, value: string, password: string) => {
        if (!isSupabaseConfigured || !supabase) throw new Error('Supabase no está configurado.');
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session?.user?.is_anonymous) throw new Error('anonymous session required');
        const { data, error } = await supabase.auth.updateUser({
          email: value.trim().toLowerCase(),
          password,
          data: { full_name: name.trim() }
        });
        if (error) throw error;
        await hydrateIdentity(data.user);
      },
      signUp: async (name: string, value: string, password: string, captchaToken?: string) => {
        if (!isSupabaseConfigured || !supabase) throw new Error('Supabase no está configurado.');
        const { data, error } = await supabase.auth.signUp({
          email: value.trim().toLowerCase(),
          password,
          options: { data: { full_name: name.trim(), role: 'citizen' }, ...(captchaToken ? { captchaToken } : {}) }
        });
        if (error) throw error;
        return Boolean(data.session);
      },
      updatePassword: async (currentPassword: string, newPassword: string) => {
        if (!supabase) throw new Error('Supabase no está configurado.');
        const { error } = await supabase.auth.updateUser({ password: newPassword, current_password: currentPassword });
        if (error) throw error;
      },
      requestPasswordReset: async (value: string, redirectTo: string, captchaToken?: string) => {
        if (!supabase) throw new Error('Supabase no está configurado.');
        const { error } = await supabase.auth.resetPasswordForEmail(value.trim().toLowerCase(), {
          redirectTo,
          ...(captchaToken ? { captchaToken } : {})
        });
        if (error) throw error;
      },
      completePasswordRecovery: async (newPassword: string) => {
        if (!supabase || !recoveryRef.current) throw new Error('Solicita un enlace de recuperación válido.');
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        recoveryRef.current = false;
        setIsPasswordRecovery(false);
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
        if (supabase) await supabase.auth.signOut({ scope: 'local' });
        await hydrateIdentity(null);
      }
    }),
    [databaseRole, department, departmentId, email, fullName, hydrateIdentity, isAuthenticated, isGuest, isLoading, isPasswordRecovery, phone, profileError, role, userId]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession debe utilizarse dentro de SessionProvider.');
  return session;
}
