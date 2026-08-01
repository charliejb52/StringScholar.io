import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const missingEnv =
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl === 'your_project_url' ||
  supabaseAnonKey === 'your_anon_key';

if (missingEnv) {
  console.error(
    '[Bard] Missing Supabase env vars.\n' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env and restart the dev server.',
  );
}

export const supabase: SupabaseClient = missingEnv
  ? (null as unknown as SupabaseClient)
  : createClient(supabaseUrl, supabaseAnonKey);

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
