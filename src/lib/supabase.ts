import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
export const dataMode = supabase ? 'Supabase preparado' : 'Demo local'
