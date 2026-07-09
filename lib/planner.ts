import type { Recipe, RecipesByCategory } from './supabase'
import type { UserData, NutritionData } from './calculator'

export interface MealPlanDay {
  day: number
  dayName: string
  date: string
  meals: Partial<Record<Recipe['category'], Recipe>>
  detoxJuice?: Recipe
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
}

export const MEAL_LABELS: Record<Recipe['category'], { label: string; emoji: string; time: string }> = {
  breakfast:       { label: 'Café da Manhã',     emoji: '☀️',  time: '07:00' },
  morningSnack:    { label: 'Lanche da Manhã',   emoji: '🍎',  time: '10:00' },
  lunch:           { label: 'Almoço',            emoji: '🍽️', time: '12:30' },
  afternoonSnack:  { label: 'Lanche da Tarde',   emoji: '🥤',  time: '15:30' },
  dinner:          { label: 'Jantar',            emoji: '🌙',  time: '19:00' },
  detoxJuice:      { label: 'Suco Detox',        emoji: '🥬',  time: '06:30' }
}

export const GOAL_LABELS: Record<UserData['goal'], string> = {
  lose:     'Emagrecimento',
  maintain: 'Manutenção',
  gain:     'Ganho de Massa'
}

const MEAL_TYPES: Array<Exclude<Recipe['category'], 'detoxJuice'>> = [
  'breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner'
]

const CALORIE_DISTRIBUTION: Record<string, number> = {
  breakfast:      0.25,
  morningSnack:   0.10,
  lunch:          0.35,
  afternoonSnack: 0.10,
  dinner:         0.20
}

const DAY_NAMES = [
  'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'
]

function selectRecipe(
  pool: Recipe[],
  targetCal: number,
  recentIds: string[]
): Recipe | undefined {
  if (!pool?.length) return undefined
  const available = pool.filter(r => !recentIds.includes(r.id))
  const candidates = available.length > 0 ? available : pool

  const scored = candidates.map(r => ({
    recipe: r,
    score: Math.abs(r.calories - targetCal) + Math.random() * 50
  }))
  scored.sort((a, b) => a.score - b.score)

  const top = scored.slice(0, Math.min(3, scored.length))
  return top[Math.floor(Math.random() * top.length)].recipe
}

function getDateLabel(dayIndex: number): string {
  const date = new Date()
  date.setDate(date.getDate() + dayIndex)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

export function generatePlan(
  userData: UserData,
  nutritionData: NutritionData,
  recipes: RecipesByCategory,
  days: number
): MealPlanDay[] {
  const { targetCalories } = nutritionData
  const plan: MealPlanDay[] = []

  const recentlyUsed: Record<string, string[]> = {
    breakfast: [], morningSnack: [], lunch: [],
    afternoonSnack: [], dinner: [], detoxJuice: []
  }

  for (let i = 0; i < days; i++) {
    const day: MealPlanDay = {
      day: i + 1,
      dayName: DAY_NAMES[i % 7],
      date: getDateLabel(i),
      meals: {},
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0
    }

    // Seleciona cada refeição
    for (const mealType of MEAL_TYPES) {
      const targetCal = Math.round(targetCalories * CALORIE_DISTRIBUTION[mealType])
      const pool = recipes[mealType] ?? []
      const recipe = selectRecipe(pool, targetCal, recentlyUsed[mealType])

      if (recipe) {
        day.meals[mealType] = recipe
        day.totalCalories += recipe.calories
        day.totalProtein  += recipe.protein ?? 0
        day.totalCarbs    += recipe.carbs ?? 0
        day.totalFat      += recipe.fat ?? 0

        recentlyUsed[mealType].push(recipe.id)
        if (recentlyUsed[mealType].length > 3) recentlyUsed[mealType].shift()
      }
    }

    // Suco detox
    const juicePool = recipes.detoxJuice ?? []
    const juice = selectRecipe(juicePool, 80, recentlyUsed.detoxJuice)
    if (juice) {
      day.detoxJuice = juice
      day.totalCalories += juice.calories
      recentlyUsed.detoxJuice.push(juice.id)
      if (recentlyUsed.detoxJuice.length > 3) recentlyUsed.detoxJuice.shift()
    }

    plan.push(day)
  }

  return plan
}

export function buildWhatsAppText(
  plan: MealPlanDay[],
  userData: UserData,
  nutritionData: NutritionData
): string {
  const goal = GOAL_LABELS[userData.goal]
  let msg = `🥗 *PLANO ALIMENTAR FIT* 🥗\n`
  msg += `━━━━━━━━━━━━━━━━━━\n\n`
  msg += `👤 *${userData.name}*\n`
  msg += `🎯 ${goal}\n`
  msg += `🔥 *${nutritionData.targetCalories} kcal/dia*\n`
  msg += `📅 Duração: *${plan.length} dias*\n\n`
  msg += `💊 *Macros Diários:*\n`
  msg += `   🥩 Proteína: ${nutritionData.macros.protein}g\n`
  msg += `   🍚 Carboidrato: ${nutritionData.macros.carbs}g\n`
  msg += `   🥑 Gordura: ${nutritionData.macros.fat}g\n`
  msg += `━━━━━━━━━━━━━━━━━━\n\n`

  const maxDays = Math.min(plan.length, 7)
  plan.slice(0, maxDays).forEach(day => {
    msg += `📆 *DIA ${day.day} — ${day.dayName}*\n`
    msg += `📅 _${day.date}_\n\n`

    const emojis: Partial<Record<Recipe['category'], string>> = {
      breakfast: '☀️', morningSnack: '🍎',
      lunch: '🍽️', afternoonSnack: '🥤', dinner: '🌙'
    }
    const labels: Partial<Record<Recipe['category'], string>> = {
      breakfast: 'Café', morningSnack: 'Lanche Manhã',
      lunch: 'Almoço', afternoonSnack: 'Lanche Tarde', dinner: 'Jantar'
    }

    for (const [type, recipe] of Object.entries(day.meals)) {
      const k = type as Recipe['category']
      if (!recipe) continue
      msg += `${emojis[k]} *${labels[k]}*\n   ${recipe.name} _(${recipe.calories} kcal)_\n\n`
    }
    if (day.detoxJuice) msg += `🥬 *Suco Detox*\n   ${day.detoxJuice.name}\n\n`
    msg += `📊 _Total: ${day.totalCalories} kcal_\n━━━━━━━━━━━━━━━━━━\n\n`
  })

  if (plan.length > maxDays) msg += `_... + ${plan.length - maxDays} dias no PDF_\n\n`

  msg += `💪 *Dicas:*\n✅ 2L de água/dia\n✅ Suco detox em jejum\n✅ Não pule refeições\n`
  msg += `\n🌟 _Fit Planner — seu plano personalizado_`
  return msg
}
