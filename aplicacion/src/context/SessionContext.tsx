import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { clearBiometricAccess, enableBiometricAccess, hasStrongBiometrics, isBiometricEnabledFor, verifyBiometricAccess } from '@/lib/biometricAccess';
import type { UserRole as DatabaseRole } from '@/types/domain';
import { isDatabaseRole, visualRoleFor } from '@/services/sessionPolicy';

export type UserRole = 'citizen' | 'admin' | 'superadmin' | 'maintenance' | 'employee';
const BACKGROUND_AT_KEY = '@zacapp/security/background-at';
const BACKGROUND_SESSION_LIMIT_MS = 10 * 60 * 1000;

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
  isLocked: boolean;
  isUnlocking: boolean;
  lockedEmail: string;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  unlockWithBiometrics: () => Promise<void>;
  unlockWithPassword: (password: string) => Promise<void>;
  enableBiometrics: () => Promise<boolean>;
  disableBiometrics: () => Promise<void>;
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
  const [isLocked, setIsLocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [lockedEmail, setLockedEmail] = useState('');
  const [lockedAccountId, setLockedAccountId] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const lockVersion = useRef(0);
  const authActionRef = useRef(false);
  const signingOutRef = useRef(false);
  const registeredUserRef = useRef<User | null>(null);
  const unlockPendingRef = useRef(false);

  const lockRegisteredSession = useCallback(async (user: User) => {
    const version = ++lockVersion.current;
    ++identityVersion.current;
    supabase?.auth.stopAutoRefresh?.();
    setIsLocked(true);
    setIsAuthenticated(false);
    setIsGuest(false);
    setRole('citizen');
    setDatabaseRole(null);
    setUserId(null);
    setDepartmentId(null);
    setDepartment(null);
    setFullName('');
    setPhone('');
    setEmail('');
    setLockedAccountId(user.id);
    registeredUserRef.current = user;
    setLockedEmail(user.email?.trim().toLowerCase() ?? '');
    const [available, enabled] = await Promise.all([hasStrongBiometrics(), isBiometricEnabledFor(user.id)]);
    if (version !== lockVersion.current) return;
    setBiometricAvailable(available);
    setBiometricEnabled(enabled);
  }, []);

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
    registeredUserRef.current = null;
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
    setProfileError('');
    setEmail(user.email?.trim().toLowerCase() ?? '');
    setIsAuthenticated(anonymousIdentity);
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
    if (error || !data || !isDatabaseRole(data.role) || data.status !== 'ACTIVO') {
      setProfileError('No fue posible verificar tu perfil. Las funciones del personal no están disponibles.');
      if (!anonymousIdentity) applyEmailFallback(null);
      return anonymousIdentity;
    }
    const verifiedDatabaseRole = data.role;
    const departmentData = data.department as unknown as { name?: string } | { name?: string }[] | null;
    const departmentName = Array.isArray(departmentData) ? departmentData[0]?.name : departmentData?.name;
    setDatabaseRole(verifiedDatabaseRole);
    setIsAuthenticated(true);
    registeredUserRef.current = anonymousIdentity ? null : user;
    setUserId(user.id);
    setDepartmentId(typeof data.department_id === 'number' ? data.department_id : null);
    setRole(visualRoleFor(verifiedDatabaseRole));

    setFullName(data.full_name || '');
    setPhone(data.phone || '');
    setDepartment(departmentName ?? null);
    return true;
  }, [applyEmailFallback]);

  const signOutLocal = useCallback(async () => {
    signingOutRef.current = true;
    ++lockVersion.current;
    // Hide the previous account before the network sign-out can yield. A slow
    // response must not reopen its protected routes or display cached data.
    await hydrateIdentity(null);
    setIsLocked(false);
    setLockedAccountId(null);
    setLockedEmail('');
    setBiometricEnabled(false);
    supabase?.auth.stopAutoRefresh?.();
    try {
      if (supabase) await supabase.auth.signOut({ scope: 'local' });
    } finally {
      if (Platform.OS === 'android') await clearBiometricAccess().catch(() => undefined);
      await AsyncStorage.removeItem(BACKGROUND_AT_KEY).catch(() => undefined);
      signingOutRef.current = false;
    }
  }, [hydrateIdentity]);

  const finishRegisteredUnlock = useCallback(async (user: User, version: number) => {
    const active = await hydrateIdentity(user);
    if (!active) {
      await signOutLocal();
      throw new Error('La cuenta está inactiva o no fue posible verificar el perfil.');
    }
    if (version !== lockVersion.current) {
      await lockRegisteredSession(user);
      throw new Error('El desbloqueo se interrumpió. Inténtalo de nuevo.');
    }
    setIsLocked(false);
    setLockedAccountId(null);
    setLockedEmail('');
    supabase?.auth.startAutoRefresh?.();
  }, [hydrateIdentity, lockRegisteredSession, signOutLocal]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let cancelled = false;
    client.auth.getSession().then(async ({ data, error }) => {
      if (cancelled) return;
      if (error) throw error;
      const user = data.session?.user;
      if (Platform.OS === 'android' && user && !user.is_anonymous) {
        const backgroundAt = await AsyncStorage.getItem(BACKGROUND_AT_KEY);
        if (backgroundAt && Date.now() - Number(backgroundAt) >= BACKGROUND_SESSION_LIMIT_MS) {
          await signOutLocal();
        } else {
          await AsyncStorage.removeItem(BACKGROUND_AT_KEY);
          if (await isBiometricEnabledFor(user.id)) await lockRegisteredSession(user);
          else {
            const isActive = await hydrateIdentity(user);
            if (!isActive) await signOutLocal();
            else client.auth.startAutoRefresh?.();
          }
        }
      } else {
        const isActive = await hydrateIdentity(user);
        if (!isActive) await signOutLocal();
        else if (Platform.OS === 'android' && user?.is_anonymous) client.auth.startAutoRefresh?.();
      }
    }).catch(async () => {
      if (!cancelled) {
        await signOutLocal().catch(() => undefined);
        setProfileError('No fue posible recuperar la sesión de forma segura. Inicia sesión de nuevo.');
      }
    }).finally(() => { if (!cancelled) setIsLoading(false); });

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY') {
        recoveryRef.current = true;
        setIsPasswordRecovery(true);
      }
      if (event === 'SIGNED_OUT') {
        recoveryRef.current = false;
        setIsPasswordRecovery(false);
        ++lockVersion.current;
        setIsLocked(false);
        setLockedAccountId(null);
        setLockedEmail('');
        setBiometricEnabled(false);
        client.auth.stopAutoRefresh?.();
        if (Platform.OS === 'android' && !signingOutRef.current) void clearBiometricAccess().catch(() => undefined);
        void hydrateIdentity(null).finally(() => setIsLoading(false));
        return;
      }
      if (Platform.OS === 'android') {
        if (event === 'INITIAL_SESSION' || authActionRef.current) return;
        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
        if (session?.user && !session.user.is_anonymous) {
          void lockRegisteredSession(session.user).finally(() => setIsLoading(false));
          return;
        }
        if (session?.user?.is_anonymous) {
          ++lockVersion.current;
          setIsLocked(false);
          setLockedAccountId(null);
          setLockedEmail('');
          client.auth.startAutoRefresh?.();
        }
      }
      void hydrateIdentity(session?.user).finally(() => setIsLoading(false));
    });

    return () => { cancelled = true; data.subscription.unsubscribe(); };
  }, [hydrateIdentity, lockRegisteredSession, signOutLocal]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !supabase) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' && registeredUserRef.current && !isLocked) {
        void AsyncStorage.setItem(BACKGROUND_AT_KEY, String(Date.now()));
      } else if (nextState === 'active') {
        void (async () => {
          const backgroundAt = await AsyncStorage.getItem(BACKGROUND_AT_KEY);
          if (!backgroundAt) return;
          if (Date.now() - Number(backgroundAt) >= BACKGROUND_SESSION_LIMIT_MS) await signOutLocal();
          else await AsyncStorage.removeItem(BACKGROUND_AT_KEY);
        })();
      }
    });
    return () => subscription.remove();
  }, [isLocked, lockRegisteredSession, signOutLocal]);

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
      isLocked,
      isUnlocking,
      lockedEmail,
      biometricEnabled,
      biometricAvailable,
      unlockWithBiometrics: async () => {
        if (!supabase || !isLocked || !lockedAccountId) throw new Error('No hay una sesión bloqueada.');
        if (unlockPendingRef.current) return;
        unlockPendingRef.current = true;
        setIsUnlocking(true);
        const version = lockVersion.current;
        try {
          if (!await verifyBiometricAccess(lockedAccountId)) throw new Error('No se pudo verificar la biometría. Usa tu contraseña.');
          const { data, error } = await supabase.auth.getUser();
          if (error || !data.user || data.user.id !== lockedAccountId || data.user.is_anonymous) {
            throw new Error('No se pudo verificar la sesión con Supabase. Usa tu contraseña.');
          }
          await finishRegisteredUnlock(data.user, version);
          await AsyncStorage.removeItem(BACKGROUND_AT_KEY);
        } finally {
          unlockPendingRef.current = false;
          setIsUnlocking(false);
        }
      },
      unlockWithPassword: async (password: string) => {
        if (!supabase || !isLocked || !lockedAccountId || !lockedEmail || !password) throw new Error('Escribe la contraseña de esta cuenta.');
        if (unlockPendingRef.current) return;
        unlockPendingRef.current = true;
        authActionRef.current = true;
        setIsUnlocking(true);
        const version = lockVersion.current;
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email: lockedEmail, password });
          if (error || !data.user) throw error ?? new Error('No se pudo iniciar sesión.');
          if (data.user.id !== lockedAccountId) {
            await signOutLocal();
            throw new Error('La identidad de la sesión cambió. Inicia sesión de nuevo.');
          }
          await finishRegisteredUnlock(data.user, version);
          await AsyncStorage.removeItem(BACKGROUND_AT_KEY);
        } finally {
          authActionRef.current = false;
          unlockPendingRef.current = false;
          setIsUnlocking(false);
        }
      },
      enableBiometrics: async () => {
        if (!supabase || Platform.OS !== 'android' || !isAuthenticated || isGuest || !userId || isLocked || !databaseRole) {
          throw new Error('Inicia sesión con una cuenta verificada para activar la biometría.');
        }
        const { data, error } = await supabase.auth.getUser();
        if (error || data.user?.id !== userId || data.user.is_anonymous) throw new Error('No se pudo verificar la sesión con Supabase.');
        const enabled = await enableBiometricAccess(userId);
        setBiometricAvailable(await hasStrongBiometrics());
        setBiometricEnabled(enabled);
        return enabled;
      },
      disableBiometrics: async () => {
        await clearBiometricAccess();
        setBiometricEnabled(false);
      },
      signIn: async (value: string, password: string, captchaToken?: string) => {
        if (!isSupabaseConfigured || !supabase) throw new Error('Supabase no está configurado.');
        authActionRef.current = true;
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: value.trim().toLowerCase(),
            password,
            options: captchaToken ? { captchaToken } : undefined
          });
          if (error || !data.user) throw error ?? new Error('No se pudo verificar la cuenta.');
          const isActive = await hydrateIdentity(data.user);
          if (!isActive) {
            await signOutLocal();
            throw new Error('account inactive');
          }
          if (Platform.OS === 'android' && data.user && !data.user.is_anonymous) {
            if (!await isBiometricEnabledFor(data.user.id)) await clearBiometricAccess().catch(() => undefined);
            setBiometricAvailable(await hasStrongBiometrics());
            setBiometricEnabled(await isBiometricEnabledFor(data.user.id));
            setIsLocked(false);
            supabase.auth.startAutoRefresh?.();
          }
        } finally {
          authActionRef.current = false;
        }
      },
      signInAsGuest: async (captchaToken?: string) => {
        if (!isSupabaseConfigured || !supabase) throw new Error('Supabase no está configurado.');
        const options = captchaToken ? { captchaToken, data: { full_name: 'Ciudadano invitado' } } : { data: { full_name: 'Ciudadano invitado' } };
        authActionRef.current = true;
        try {
          const { data, error } = await supabase.auth.signInAnonymously({ options });
          if (error) throw error;
          const isActive = await hydrateIdentity(data.user);
          if (!isActive) {
            await signOutLocal();
            throw new Error('guest access unavailable');
          }
          if (Platform.OS === 'android') supabase.auth.startAutoRefresh?.();
        } finally {
          authActionRef.current = false;
        }
      },
      linkGuestEmail: async (name: string, value: string, password: string) => {
        if (!isSupabaseConfigured || !supabase) throw new Error('Supabase no está configurado.');
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session?.user?.is_anonymous) throw new Error('anonymous session required');
        authActionRef.current = true;
        try {
          const { data, error } = await supabase.auth.updateUser({
            email: value.trim().toLowerCase(),
            password,
            data: { full_name: name.trim() }
          });
          if (error) throw error;
          if (!await hydrateIdentity(data.user)) {
            await signOutLocal();
            throw new Error('No se pudo verificar el perfil.');
          }
          if (Platform.OS === 'android' && data.user && !data.user.is_anonymous) supabase.auth.startAutoRefresh?.();
        } finally {
          authActionRef.current = false;
        }
      },
      signUp: async (name: string, value: string, password: string, captchaToken?: string) => {
        if (!isSupabaseConfigured || !supabase) throw new Error('Supabase no está configurado.');
        authActionRef.current = true;
        try {
          const { data, error } = await supabase.auth.signUp({
            email: value.trim().toLowerCase(),
            password,
            options: { data: { full_name: name.trim(), role: 'citizen' }, ...(captchaToken ? { captchaToken } : {}) }
          });
          if (error) throw error;
          if (data.session?.user && !await hydrateIdentity(data.session.user)) {
            await signOutLocal();
            throw new Error('No se pudo verificar el perfil.');
          }
          if (Platform.OS === 'android' && data.session?.user) supabase.auth.startAutoRefresh?.();
          return Boolean(data.session);
        } finally {
          authActionRef.current = false;
        }
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
      signOut: signOutLocal
    }),
    [biometricAvailable, biometricEnabled, databaseRole, department, departmentId, email, finishRegisteredUnlock, fullName, hydrateIdentity, isAuthenticated, isGuest, isLoading, isLocked, isPasswordRecovery, isUnlocking, lockedAccountId, lockedEmail, phone, profileError, role, signOutLocal, userId]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession debe utilizarse dentro de SessionProvider.');
  return session;
}
