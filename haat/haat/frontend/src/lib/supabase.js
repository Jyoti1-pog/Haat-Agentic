import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const hasSupabaseEnv = Boolean(url && key)

if (!hasSupabaseEnv) {
  console.warn('[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set — auth will not work')
}

export const supabase = hasSupabaseEnv ? createClient(url, key) : null
