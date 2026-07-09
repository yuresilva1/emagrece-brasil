// ============================================================
// CALCULADORA NUTRICIONAL — Harris-Benedict + TDEE
// ============================================================

export interface UserData {
  name: string
  weight: number   // kg
  height: number   // cm
  age: number
  sex: 'male' | 'female'
  goal: 'lose' | 'maintain' | 'gain'
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive'
  days: 5 | 10 | 20
  waist?: number   // cm (opcional)
  hip?: number     // cm (opcional)
  arm?: number     // cm (opcional)
}

export interface NutritionData {
  bmr: number
  tdee: number
  targetCalories: number
  bmi: { value: string; classification: string; color: string }
  macros: { protein: number; carbs: number; fat: number }
  idealWeight: string
  whr?: { value: string; risk: string } | null
}

export function calculateBMR(data: UserData): number {
  const { weight, height, age, sex } = data
  if (sex === 'male') {
    return 88.36 + (13.4 * weight) + (4.8 * height) - (5.7 * age)
  }
  return 447.6 + (9.2 * weight) + (3.1 * height) - (4.3 * age)
}

export function calculateTDEE(bmr: number, activityLevel: UserData['activityLevel']): number {
  const factors: Record<UserData['activityLevel'], number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    veryActive: 1.9
  }
  return bmr * (factors[activityLevel] ?? 1.375)
}

export function calculateTargetCalories(tdee: number, goal: UserData['goal']): number {
  const factors: Record<UserData['goal'], number> = {
    lose: 0.80,
    maintain: 1.0,
    gain: 1.15
  }
  return Math.round(tdee * factors[goal])
}

export function calculateBMI(weight: number, height: number) {
  const heightM = height / 100
  const bmi = weight / (heightM * heightM)
  let classification: string
  let color: string

  if (bmi < 18.5) { classification = 'Abaixo do peso'; color = '#3b82f6' }
  else if (bmi < 25) { classification = 'Peso normal'; color = '#22c55e' }
  else if (bmi < 30) { classification = 'Sobrepeso'; color = '#f59e0b' }
  else if (bmi < 35) { classification = 'Obesidade I'; color = '#f97316' }
  else if (bmi < 40) { classification = 'Obesidade II'; color = '#ef4444' }
  else { classification = 'Obesidade III'; color = '#dc2626' }

  return { value: bmi.toFixed(1), classification, color }
}

export function calculateMacros(targetCalories: number, goal: UserData['goal']) {
  const ratios: Record<UserData['goal'], [number, number, number]> = {
    lose:     [0.35, 0.35, 0.30],
    maintain: [0.30, 0.40, 0.30],
    gain:     [0.30, 0.45, 0.25]
  }
  const [p, c, f] = ratios[goal]
  return {
    protein: Math.round((targetCalories * p) / 4),
    carbs:   Math.round((targetCalories * c) / 4),
    fat:     Math.round((targetCalories * f) / 9)
  }
}

export function calculateWHR(waist: number, hip: number, sex: UserData['sex']) {
  const whr = waist / hip
  let risk: string
  if (sex === 'male') {
    risk = whr < 0.90 ? 'Baixo risco' : whr < 0.95 ? 'Risco moderado' : 'Alto risco'
  } else {
    risk = whr < 0.80 ? 'Baixo risco' : whr < 0.85 ? 'Risco moderado' : 'Alto risco'
  }
  return { value: whr.toFixed(2), risk }
}

export function calculateIdealWeight(height: number, sex: UserData['sex']): string {
  const heightIn = (height - 152.4) / 2.54
  const ideal = sex === 'male' ? 50 + (2.3 * heightIn) : 45.5 + (2.3 * heightIn)
  const min = Math.max(40, ideal - 5)
  const max = ideal + 5
  return `${min.toFixed(1)} – ${max.toFixed(1)} kg`
}

export function processAll(userData: UserData): NutritionData {
  const bmr = calculateBMR(userData)
  const tdee = calculateTDEE(bmr, userData.activityLevel)
  const targetCalories = calculateTargetCalories(tdee, userData.goal)
  const bmi = calculateBMI(userData.weight, userData.height)
  const macros = calculateMacros(targetCalories, userData.goal)
  const idealWeight = calculateIdealWeight(userData.height, userData.sex)
  const whr = (userData.waist && userData.hip)
    ? calculateWHR(userData.waist, userData.hip, userData.sex)
    : null

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories,
    bmi,
    macros,
    idealWeight,
    whr
  }
}
