import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { requireBackendCapability } from '@/lib/backendCapabilities';
import { isDatabaseRole, visualRoleFor } from '@/services/sessionPolicy';
import type { UserRole as DatabaseRole } from '@/types/domain';

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
  const [databaseRole, setDatabaseRole] = useState<DatabaseRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [profileError, setProfileError] = useState('');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const recoveryRef = useRef(false);
  const identityVersion = useRef(0);
  const mounted = useRef(true);
  const [department, setDepartment] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));

  const applyEmailFallback = useCallback((value?: string | null) => {
    const normalizedEmail = value?.trim().toLowerCase() ?? '';
    setEmail(normalizedEmail);
    setIsAuthenticated(Boolean(normalizedEmail));

    // An email address never grants a role, including when profile lookup fails.
    setRole('citizen');
    setDatabaseRole(null);
    setUserId(null);
    setDepartmentId(null);
    setDepartment(null);
  }, []);

  const hydrateIdentity = useCallback(async (user?: User | null) => {
    const version = ++identityVersion.current;
    const current = () => mounted.current && version === identityVersion.current;
    if (!mounted.current) return;
    setIsLoading(true);
    setProfileError('');
    applyEmailFallback(user?.email);
    setFullName('');
    if (!user) {
      setIsLoading(false);
      return;
    }
    setFullName(typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '');
    try {
      if (!supabase) return;
      // Read only existing fields. phone/status and their policies are not verified.
      const { data, error } = await supabase.from('profiles').select('full_name, role, department_id, department:departments(name)').eq('id', user.id).single();
      if (!current()) return;
      if (error || !data || !isDatabaseRole(data.role)) {
        setProfileError('No fue posible verificar tu perfil. Las funciones del personal no están disponibles.');
        return;
      }
      const area = data.department as unknown as { name?: string } | { name?: string }[] | null;
      setDatabaseRole(data.role);
      setUserId(user.id);
      setDepartmentId(typeof data.department_id === 'number' && Number.isSafeInteger(data.department_id) && data.department_id > 0 ? data.department_id : null);
      setRole(visualRoleFor(data.role));
      setFullName(data.full_name || '');
      setDepartment((Array.isArray(area) ? area[0]?.name : area?.name) ?? null);
    } catch {
      if (current()) setProfileError('No fue posible verificar tu perfil. Intenta iniciar sesión nuevamente.');
    } finally {
      if (current()) setIsLoading(false);
    }
  }, [applyEmailFallback]);

  useEffect(() => {
    mounted.current = true;
    ++identityVersion.current;
    const client = supabase;
    if (!client) return () => { mounted.current = false; };
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let authChanged = false;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      authChanged = true;
      ++identityVersion.current;
      applyEmailFallback(session?.user?.email);
      setIsLoading(true);
      if (event === 'PASSWORD_RECOVERY') { recoveryRef.current = true; setIsPasswordRecovery(true); }
      if (event === 'SIGNED_OUT') { recoveryRef.current = false; setIsPasswordRecovery(false); }
      // Leave the auth callback before starting other Supabase requests.
      const timer = setTimeout(() => { timers.delete(timer); if (mounted.current) void hydrateIdentity(session?.user); }, 0);
      timers.add(timer);
    });
    let active = true;
    client.auth.getSession().then(({ data: sessionData, error }) => {
      if (active && !authChanged) void hydrateIdentity(error ? null : sessionData.session?.user);
    }).catch(() => { if (active && !authChanged) void hydrateIdentity(null); });
    const receiveRecovery = async (url: string | null) => {
      if (!active || !url || Platform.OS === 'web') return;
      const expected = Linking.createURL('/reset-password').split(/[?#]/)[0];
      if (url.split(/[?#]/)[0] !== expected) return;
      const params = new URLSearchParams(url.split('#')[1] ?? '');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (params.get('type') !== 'recovery' || !accessToken || !refreshToken) return;
      const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (!error && active) { recoveryRef.current = true; setIsPasswordRecovery(true); }
    };
    void Linking.getInitialURL().then(receiveRecovery).catch(() => {});
    const linkListener = Linking.addEventListener('url', ({ url }) => { void receiveRecovery(url).catch(() => {}); });
    return () => { active = false; mounted.current = false; timers.forEach(clearTimeout); data.subscription.unsubscribe(); linkListener.remove(); };
  }, [applyEmailFallback, hydrateIdentity]);

  const value = useMemo(
    () => ({
      role,
      email,
      fullName,
      phone: '',
      databaseRole,
      userId,
      departmentId,
      profileError,
      isPasswordRecovery,
      department,
      isAuthenticated,
      isLoading,
      signIn: async (value: string, password: string) => {
        if (!isSupabaseConfigured || !supabase) throw new Error('Supabase no está configurado.');
        const { data, error } = await supabase.auth.signInWithPassword({ email: value.trim().toLowerCase(), password });
        if (error) throw error;
        await hydrateIdentity(data.user);
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
        if (!currentPassword || newPassword.length < 8) throw new Error('Completa la contraseña actual y una nueva de al menos 8 caracteres.');
        const { error } = await supabase.auth.updateUser({ password: newPassword, current_password: currentPassword });
        if (error) throw error;
      },
      requestPasswordReset: async (value: string, redirectTo: string) => {
        if (!supabase) throw new Error('Supabase no está configurado.');
        if (redirectTo !== Linking.createURL('/reset-password')) throw new Error('Destino de recuperación no válido.');
        const { error } = await supabase.auth.resetPasswordForEmail(value.trim().toLowerCase(), { redirectTo });
        if (error) throw error;
      },
      completePasswordRecovery: async (newPassword: string) => {
        if (!supabase || !recoveryRef.current) throw new Error('Solicita un enlace de recuperación válido.');
        if (newPassword.length < 8) throw new Error('Utiliza al menos 8 caracteres.');
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        recoveryRef.current = false;
        setIsPasswordRecovery(false);
        await supabase.auth.signOut({ scope: 'local' });
      },
      updateProfile: async (name: string, phone: string) => {
        requireBackendCapability('profileEditing');
        if (!supabase) throw new Error('Supabase no está configurado.');
        const { error } = await supabase.rpc('update_own_profile', { p_full_name: name.trim(), p_phone: phone.trim() || null });
        if (error) throw error;
      },
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
        await hydrateIdentity(null);
      }
    }),
    [databaseRole, department, departmentId, email, fullName, hydrateIdentity, isAuthenticated, isLoading, isPasswordRecovery, profileError, role, userId]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession debe utilizarse dentro de SessionProvider.');
  return session;
}
