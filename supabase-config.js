// Cole aqui os dados de Project Settings > API no painel do Supabase.
// A publishable/anon key pode ficar no navegador. Nunca use a service_role key.
window.FOX_SUPABASE_URL = 'https://tjnerqwzrkavijumptqb.supabase.co';
window.FOX_SUPABASE_KEY = 'sb_publishable_OupjXloiEFHYaxWAGSh-_A_NCDQBF2C';

window.foxSupabase = window.FOX_SUPABASE_URL && window.FOX_SUPABASE_KEY
  ? window.supabase.createClient(window.FOX_SUPABASE_URL, window.FOX_SUPABASE_KEY)
  : null;
