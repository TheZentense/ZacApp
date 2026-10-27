import { supabase } from '@/lib/supabase';

export async function requireAdministrator() {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Inicia sesión nuevamente.');
  const { data, error } = await supabase.from('profiles').select('role, status').eq('id', auth.user.id).single();
  if (error || data?.role !== 'administrador' || data.status !== 'ACTIVO') throw new Error('Esta función requiere un perfil administrativo verificado y activo.');
  return supabase;
}
