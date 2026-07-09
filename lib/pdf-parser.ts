import type { Recipe } from './supabase'

// ============================================================
// PDF PARSER — Extrai receitas do texto bruto do PDF
// Roda apenas no servidor (Node.js)
// ============================================================

type PdfType = 'fit' | 'detox'

const INGREDIENT_PATTERNS = [
  /ingredientes?/i,
  /você vai precisar/i,
  /o que você precisa/i,
  /o que usar/i,
]

const PREP_PATTERNS = [
  /modo de preparo/i,
  /como (fazer|preparar)/i,
  /preparo|preparação/i,
  /instruções/i,
  /passo a passo/i,
]

const MEAL_KEYWORDS: Record<Recipe['category'], string[]> = {
  breakfast:      ['café','mingau','tapioca','panqueca','omelete','ovos','iogurte','granola','torrada','smoothie bowl','açaí'],
  morningSnack:   ['lanche','castanha','mix','maçã','banana','biscoito de arroz','iogurte natural','queijo cottage'],
  lunch:          ['almoço','arroz','feijão','grão','lentilha','frango grelhado','tilápia','salmão','wrap','bowl','curry'],
  afternoonSnack: ['lanche da tarde','vitamina','shake','chá','proteína'],
  dinner:         ['sopa','creme','salada','peixe no','frango ao forno','ceviche','stir-fry','tofu','jantar','omelete fit'],
  detoxJuice:     ['suco','vitamina','agua detox','shot','golden milk','água de coco','limão','gengibre','couve'],
}

function guessMealType(name: string, pdfType: PdfType): Recipe['category'] {
  if (pdfType === 'detox') return 'detoxJuice'
  const lower = name.toLowerCase()

  for (const [category, keywords] of Object.entries(MEAL_KEYWORDS) as [Recipe['category'], string[]][]) {
    if (category === 'detoxJuice') continue
    if (keywords.some(kw => lower.includes(kw))) return category
  }

  // Distribuição padrão aleatória
  const fallbacks: Recipe['category'][] = ['lunch', 'dinner', 'lunch', 'breakfast']
  return fallbacks[Math.floor(Math.random() * fallbacks.length)]
}

function estimateNutrition(category: Recipe['category']): Pick<Recipe, 'calories' | 'protein' | 'carbs' | 'fat'> {
  const defaults: Record<Recipe['category'], [number, number, number, number]> = {
    breakfast:      [260, 14, 30, 10],
    morningSnack:   [160,  6, 20,  8],
    lunch:          [400, 32, 38, 12],
    afternoonSnack: [160,  8, 20,  6],
    dinner:         [280, 26, 22, 10],
    detoxJuice:     [ 80,  2, 18,  1],
  }
  const [calories, protein, carbs, fat] = defaults[category]
  return { calories, protein, carbs, fat }
}

function getEmoji(category: Recipe['category']): string {
  const emojis: Record<Recipe['category'], string> = {
    breakfast: '☀️', morningSnack: '🍎', lunch: '🍽️',
    afternoonSnack: '🥤', dinner: '🌙', detoxJuice: '🥬'
  }
  return emojis[category]
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/^\d+[.\-\)]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isLikelyTitle(line: string): boolean {
  return (
    line.length >= 5 &&
    line.length <= 80 &&
    /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(line) &&
    !line.includes(':') &&
    !INGREDIENT_PATTERNS.some(p => p.test(line)) &&
    !PREP_PATTERNS.some(p => p.test(line))
  )
}

interface ParsedRecipe {
  name: string
  calories?: number
  ingredients: string[]
  prep: string
}

export function parseRecipesFromText(text: string, pdfType: PdfType, pdfSource: string): Omit<Recipe, 'id' | 'created_at'>[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  const parsed: ParsedRecipe[] = []

  let current: ParsedRecipe | null = null
  let state: 'searching' | 'in_name' | 'in_ingredients' | 'in_prep' = 'searching'
  let ingredientBuffer: string[] = []
  let prepBuffer: string[] = []

  function flush() {
    if (current && current.name && ingredientBuffer.length > 0) {
      parsed.push({
        name: current.name,
        calories: current.calories,
        ingredients: ingredientBuffer.slice(0, 15),
        prep: prepBuffer.join(' ').substring(0, 600) || 'Consulte o PDF para o modo de preparo completo.',
      })
    }
    ingredientBuffer = []
    prepBuffer = []
    current = null
    state = 'searching'
  }

  for (const line of lines) {
    // Detecta calorias
    const calMatch = line.match(/(\d{2,4})\s*(kcal|calorias)/i)
    if (calMatch && current) {
      current.calories = parseInt(calMatch[1])
    }

    if (INGREDIENT_PATTERNS.some(p => p.test(line))) { state = 'in_ingredients'; continue }
    if (PREP_PATTERNS.some(p => p.test(line))) { state = 'in_prep'; continue }

    if (isLikelyTitle(line) && state !== 'in_prep') {
      if (current && ingredientBuffer.length > 0) flush()
      current = { name: cleanTitle(line), ingredients: [], prep: '' }
      state = 'in_name'
      continue
    }

    if (state === 'in_ingredients' && line.length > 3) {
      const cleaned = line.replace(/^[-•*·▶►✓✔○●]\s*/, '').trim()
      if (cleaned.length > 2) ingredientBuffer.push(cleaned)
    }

    if (state === 'in_prep' && line.length > 5) {
      prepBuffer.push(line)
    }
  }

  flush()

  // Converte para formato Recipe
  return parsed.map((p, i) => {
    const category = guessMealType(p.name, pdfType)
    const nutrition = estimateNutrition(category)

    return {
      name: p.name,
      category,
      calories: p.calories ?? nutrition.calories,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fat: nutrition.fat,
      ingredients: p.ingredients,
      prep: p.prep,
      emoji: getEmoji(category),
      benefits: category === 'detoxJuice' ? 'Suco detox natural' : undefined,
      pdf_source: pdfSource,
    }
  })
}
