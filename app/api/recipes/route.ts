import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { RecipesByCategory } from '@/lib/supabase'

// GET /api/recipes — retorna todas as receitas agrupadas por categoria
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw error

    // Agrupa por categoria
    const grouped: RecipesByCategory = {
      breakfast:      [],
      morningSnack:   [],
      lunch:          [],
      afternoonSnack: [],
      dinner:         [],
      detoxJuice:     [],
    }

    const rows = (data ?? []) as import('@/lib/supabase').Recipe[]
    for (const recipe of rows) {
      const cat = recipe.category as keyof RecipesByCategory
      if (grouped[cat]) grouped[cat].push(recipe)
    }


    return NextResponse.json(grouped, {
      headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate' }
    })
  } catch (err) {
    console.error('GET /api/recipes error:', err)
    return NextResponse.json({ error: 'Erro ao buscar receitas' }, { status: 500 })
  }
}
