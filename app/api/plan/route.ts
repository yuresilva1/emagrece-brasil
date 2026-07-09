import { NextRequest, NextResponse } from 'next/server'
import { processAll } from '@/lib/calculator'
import { generatePlan } from '@/lib/planner'
import type { RecipesByCategory } from '@/lib/supabase'
import type { UserData } from '@/lib/calculator'

// POST /api/plan — gera plano alimentar personalizado
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userData, recipes } = body as { userData: UserData; recipes: RecipesByCategory }

    if (!userData || !recipes) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    // Calcula nutrição
    const nutritionData = processAll(userData)

    // Gera plano
    const plan = generatePlan(userData, nutritionData, recipes, userData.days)

    return NextResponse.json({ plan, nutritionData })
  } catch (err) {
    console.error('POST /api/plan error:', err)
    return NextResponse.json({ error: 'Erro ao gerar plano' }, { status: 500 })
  }
}
