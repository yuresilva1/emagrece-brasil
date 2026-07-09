import { createClient } from '@supabase/supabase-js'

// Client público (browser) — lazy para evitar erro no build sem .env
let _supabase: ReturnType<typeof createClient> | null = null
export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _supabase
}

// Compat: export direto para rotas que já usam `supabase`
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_t, prop) { return getSupabase()[prop as keyof ReturnType<typeof createClient>] }
})

// Client admin com service role (apenas server-side, lazy)
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}


// Tipos
export interface Recipe {
  id: string
  name: string
  category: 'breakfast' | 'morningSnack' | 'lunch' | 'afternoonSnack' | 'dinner' | 'detoxJuice'
  calories: number
  protein: number
  carbs: number
  fat: number
  ingredients: string[]
  prep?: string
  emoji?: string
  benefits?: string
  pdf_source?: string
  created_at?: string
}

export interface PdfUpload {
  id: string
  filename: string
  pdf_type: 'fit' | 'detox'
  storage_path?: string
  recipes_count: number
  processed: boolean
  error_msg?: string
  created_at: string
}

export type RecipesByCategory = Record<Recipe['category'], Recipe[]>
