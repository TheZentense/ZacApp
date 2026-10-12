import { supabase } from '@/lib/supabase';

type CreateReportInput = {
  categoryName: string;
  description: string;
  location: string;
};

export async function createReport({ categoryName, description, location }: CreateReportInput) {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Inicia sesión para registrar un reporte.');

  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('name', categoryName.trim())
    .eq('active', true)
    .single();

  if (categoryError || !category) throw new Error('La categoría seleccionada no está disponible.');

  const cleanDescription = description.trim();
  const { data: incident, error: incidentError } = await supabase
    .from('incidents')
    .insert({
      citizen_id: authData.user.id,
      category_id: category.id,
      title: cleanDescription.slice(0, 80),
      description: cleanDescription,
      address_reference: location.trim()
    })
    .select('id, code')
    .single();

  if (incidentError) throw incidentError;
  return incident;
}
