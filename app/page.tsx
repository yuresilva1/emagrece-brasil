'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { processAll } from '@/lib/calculator'
import { generatePlan, buildWhatsAppText, MEAL_LABELS, GOAL_LABELS } from '@/lib/planner'
import type { UserData, NutritionData } from '@/lib/calculator'
import type { RecipesByCategory } from '@/lib/supabase'
import type { MealPlanDay } from '@/lib/planner'

// ── Tipos estendidos para o novo formulário ──────────────────
interface FormData {
  nomeCompleto: string
  idade: string
  peso: string
  altura: string
  kgPerder: number
  incomoda: string[]
  dias: 5 | 10 | 20
}

const INCOMODA_OPTIONS = [
  { id: 'barriga',  icon: '🫃', label: 'Barriga' },
  { id: 'coxas',   icon: '🦵', label: 'Coxas' },
  { id: 'bracos',  icon: '💪', label: 'Braços' },
  { id: 'costas',  icon: '🔙', label: 'Costas' },
  { id: 'quadril', icon: '🍑', label: 'Quadril' },
  { id: 'rosto',   icon: '😮', label: 'Rosto / Papada' },
  { id: 'pernas',  icon: '🦿', label: 'Pernas' },
  { id: 'geral',   icon: '⚖️', label: 'Corpo todo' },
]

const LOADING_MSGS = [
  '🧮 Calculando seu metabolismo...',
  '🔥 Definindo sua meta calórica...',
  '🥗 Selecionando as melhores receitas...',
  '🥬 Incluindo sucos detox diários...',
  '📅 Montando o cronograma...',
  '✨ Finalizando seu plano personalizado...',
]

const DAY_NAMES = ['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo']

type Screen = 'splash' | 'form' | 'loading' | 'plan'

// ── Componente Principal ─────────────────────────────────────
export default function Home() {
  const [screen, setScreen]           = useState<Screen>('splash')
  const [form, setForm]               = useState<FormData>({ nomeCompleto: '', idade: '', peso: '', altura: '', kgPerder: 10, incomoda: [], dias: 10 })
  const [userData, setUserData]       = useState<UserData | null>(null)
  const [nutrition, setNutrition]     = useState<NutritionData | null>(null)
  const [plan, setPlan]               = useState<MealPlanDay[]>([])
  const [recipes, setRecipes]         = useState<RecipesByCategory | null>(null)
  const [currentDay, setCurrentDay]   = useState(0)
  const [loadMsg, setLoadMsg]         = useState(LOADING_MSGS[0])
  const [loadPct, setLoadPct]         = useState(0)
  const [expanded, setExpanded]       = useState<Record<string, boolean>>({})
  const [toast, setToast]             = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [pdfLoading, setPdfLoading]   = useState(false)
  const sliderRef = useRef<HTMLInputElement>(null)

  // ── Vai para formulário após splash ──────────────────────
  useEffect(() => {
    const t = setTimeout(() => setScreen('form'), 2600)
    return () => clearTimeout(t)
  }, [])

  // ── Busca receitas do banco ───────────────────────────────
  useEffect(() => {
    fetch('/api/recipes')
      .then(r => r.json())
      .then(setRecipes)
      .catch(() => console.warn('Sem receitas do banco, usando padrão'))
  }, [])

  // ── Atualiza cor do slider dinamicamente ─────────────────
  useEffect(() => {
    if (sliderRef.current) {
      const pct = ((form.kgPerder - 1) / 49) * 100
      sliderRef.current.style.setProperty('--val', `${pct}%`)
    }
  }, [form.kgPerder])

  // ── Toast ─────────────────────────────────────────────────
  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Validação ─────────────────────────────────────────────
  const isValid = form.nomeCompleto.trim().length >= 2 &&
                  parseInt(form.idade) >= 10 &&
                  parseFloat(form.peso) > 0 &&
                  parseFloat(form.altura) > 0

  // ── Toggle "O que incomoda" ───────────────────────────────
  function toggleBother(id: string) {
    setForm(f => ({
      ...f,
      incomoda: f.incomoda.includes(id) ? f.incomoda.filter(x => x !== id) : [...f.incomoda, id]
    }))
  }

  // ── Submissão do formulário ───────────────────────────────
  async function handleSubmit() {
    if (!isValid) return

    const ud: UserData = {
      name:          form.nomeCompleto.trim(),
      weight:        parseFloat(form.peso),
      height:        parseFloat(form.altura),
      age:           parseInt(form.idade),
      sex:           'female',       // simplificado por enquanto
      goal:          'lose',
      activityLevel: 'light',
      days:          form.dias,
    }

    setUserData(ud)
    setScreen('loading')

    // Animação de loading
    let i = 0
    const interval = setInterval(() => {
      if (i < LOADING_MSGS.length) {
        setLoadMsg(LOADING_MSGS[i])
        setLoadPct(Math.round(((i + 1) / LOADING_MSGS.length) * 100))
        i++
      } else {
        clearInterval(interval)
        setTimeout(() => {
          try {
            const nd = processAll(ud)
            setNutrition(nd)

            // Usa receitas do banco ou as padrão
            const dbCount = recipes ? Object.values(recipes).reduce((a, b) => a + b.length, 0) : 0
            const recipeData = dbCount > 0 ? recipes! : getDefaultRecipes()
            const p = generatePlan(ud, nd, recipeData, form.dias)
            setPlan(p)
            setCurrentDay(0)
            setScreen('plan')
          } catch {
            showToast('Erro ao gerar o plano. Tente novamente.', 'err')
            setScreen('form')
          }
        }, 400)
      }
    }, 420)
  }

  // ── Seleciona dia ─────────────────────────────────────────
  function selectDay(i: number) {
    setCurrentDay(i)
    setExpanded({})
  }

  // ── Expande receita ───────────────────────────────────────
  function toggleExpand(id: string) {
    setExpanded(e => ({ ...e, [id]: !e[id] }))
  }

  // ── Download PDF ──────────────────────────────────────────
  async function handlePDF() {
    if (!plan.length || !userData || !nutrition) return
    setPdfLoading(true)
    try {
      // Importa jsPDF dinamicamente (só no browser)
      const { jsPDF } = (await import('jspdf')).default ? await import('jspdf') : { jsPDF: (window as any).jspdf?.jsPDF }
      generatePDF(new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }))
      showToast('✅ PDF baixado com sucesso!')
    } catch {
      showToast('Erro ao gerar PDF.', 'err')
    } finally {
      setPdfLoading(false)
    }
  }

  function generatePDF(doc: any) {
    if (!userData || !nutrition) return
    const pageW = doc.internal.pageSize.getWidth()
    const m = 15, cW = pageW - m * 2

    // Capa
    doc.setFillColor(22, 163, 74)
    doc.rect(0, 0, pageW, 60, 'F')
    doc.setFillColor(34, 197, 94)
    doc.rect(0, 50, pageW, 20, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text('EMAGRECE BRASIL', pageW / 2, 25, { align: 'center' })
    doc.setFontSize(12)
    doc.text('Plano Alimentar Personalizado', pageW / 2, 36, { align: 'center' })
    doc.setFontSize(16)
    doc.setTextColor(22, 163, 74)
    doc.text(userData.name, pageW / 2, 76, { align: 'center' })

    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)
    const info = [
      ['🎯 Objetivo', `Perder ${form.kgPerder} kg`],
      ['🔥 Meta calórica', `${nutrition.targetCalories} kcal/dia`],
      ['📅 Duração', `${plan.length} dias`],
      ['💪 IMC', `${nutrition.bmi.value} — ${nutrition.bmi.classification}`],
    ]
    let y = 90
    info.forEach(([l, v]) => {
      doc.setFillColor(248, 250, 252)
      doc.roundedRect(m, y - 5, cW, 11, 1, 1, 'F')
      doc.setFont('helvetica', 'bold')
      doc.text(l, m + 3, y + 2)
      doc.setFont('helvetica', 'normal')
      doc.text(v, pageW - m - 3, y + 2, { align: 'right' })
      y += 14
    })

    // Dias
    plan.forEach(day => {
      doc.addPage()
      doc.setFillColor(34, 197, 94)
      doc.rect(0, 0, pageW, 18, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text(`DIA ${day.day} — ${day.dayName.toUpperCase()}`, pageW / 2, 12, { align: 'center' })

      let dy = 26
      Object.entries(day.meals).forEach(([type, recipe]) => {
        if (!recipe) return
        const info = MEAL_LABELS[type as keyof typeof MEAL_LABELS]
        doc.setFillColor(240, 253, 244)
        doc.roundedRect(m, dy, cW, 32, 2, 2, 'F')
        doc.setFillColor(34, 197, 94)
        doc.rect(m, dy, 3, 32, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(22, 163, 74)
        doc.text(`${info.emoji} ${info.label.toUpperCase()}`, m + 6, dy + 7)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(15, 23, 42)
        doc.text(recipe.name, m + 6, dy + 15)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(100, 116, 139)
        doc.text(`${recipe.calories} kcal  •  P:${recipe.protein}g  C:${recipe.carbs}g  G:${recipe.fat}g`, m + 6, dy + 23)
        dy += 36
      })

      if (day.detoxJuice) {
        doc.setFillColor(220, 252, 231)
        doc.roundedRect(m, dy, cW, 20, 2, 2, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(22, 163, 74)
        doc.text(`🥬 SUCO DETOX: ${day.detoxJuice.name}`, m + 4, dy + 13)
        dy += 24
      }

      doc.setFillColor(22, 163, 74)
      doc.roundedRect(m, dy, cW, 12, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(255, 255, 255)
      doc.text(`Total do dia: ${day.totalCalories} kcal`, pageW / 2, dy + 8, { align: 'center' })
    })

    const name = (userData.name || 'plano').toLowerCase().replace(/\s+/g, '-')
    doc.save(`emagrece-brasil-${name}.pdf`)
  }

  // ── WhatsApp ──────────────────────────────────────────────
  function handleWhatsApp() {
    if (!plan.length || !userData || !nutrition) return
    const text = buildWhatsAppText(plan, userData, nutrition)
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  // ── RENDER ────────────────────────────────────────────────
  const day = plan[currentDay]

  return (
    <div id="app">

      {/* ══ SPLASH ══ */}
      <section id="screen-splash" className={`screen ${screen === 'splash' ? 'active' : ''}`}>
        <div style={{ textAlign: 'center', padding: '60px 32px' }}>
          <Image src="/logo.png" alt="Emagrece Brasil" width={120} height={120} className="splash-logo" priority />
          <h1 className="splash-title">Emagrece Brasil</h1>
          <p className="splash-subtitle">Seu plano alimentar personalizado<br/>com receitas fit e sucos detox 🌿</p>
          <div className="splash-badge">🇧🇷 100% brasileiro • Feito para você</div>
          <div className="splash-dots">
            <div className="splash-dot" />
            <div className="splash-dot" />
            <div className="splash-dot" />
          </div>
        </div>
      </section>

      {/* ══ FORMULÁRIO ══ */}
      <section id="screen-form" className={`screen ${screen === 'form' ? 'active' : ''}`}>

        <div className="form-header">
          <div className="brand-row">
            <Image src="/logo.png" alt="Logo" width={36} height={36} className="brand-logo" />
            <span className="brand-name">Emagrece Brasil</span>
          </div>
        </div>

        <div className="form-hero">
          <h2 className="form-hero-title">Vamos criar seu plano! 💪</h2>
          <p className="form-hero-sub">Preencha seus dados para um plano 100% personalizado</p>
        </div>

        <div className="form-body">

          {/* Card: Dados Pessoais */}
          <div className="form-card">
            <div className="card-title">👤 Seus Dados</div>

            <div className="field">
              <label className="field-label" htmlFor="nomeCompleto">Nome completo</label>
              <div className="input-wrap">
                <input
                  id="nomeCompleto"
                  type="text"
                  placeholder="Seu nome completo"
                  value={form.nomeCompleto}
                  onChange={e => setForm(f => ({ ...f, nomeCompleto: e.target.value }))}
                  autoComplete="name"
                  maxLength={60}
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="idade">Idade</label>
                <div className="input-wrap">
                  <input
                    id="idade"
                    type="number"
                    placeholder="30"
                    inputMode="numeric"
                    min={10} max={100}
                    value={form.idade}
                    onChange={e => setForm(f => ({ ...f, idade: e.target.value }))}
                    style={{ paddingRight: 40 }}
                  />
                  <span className="input-unit">anos</span>
                </div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="altura">Altura</label>
                <div className="input-wrap">
                  <input
                    id="altura"
                    type="number"
                    placeholder="165"
                    inputMode="numeric"
                    min={100} max={250}
                    value={form.altura}
                    onChange={e => setForm(f => ({ ...f, altura: e.target.value }))}
                    style={{ paddingRight: 36 }}
                  />
                  <span className="input-unit">cm</span>
                </div>
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="peso">Peso atual</label>
              <div className="input-wrap">
                <input
                  id="peso"
                  type="number"
                  placeholder="75"
                  inputMode="decimal"
                  step="0.1"
                  min={30} max={300}
                  value={form.peso}
                  onChange={e => setForm(f => ({ ...f, peso: e.target.value }))}
                  style={{ paddingRight: 36 }}
                />
                <span className="input-unit">kg</span>
              </div>
            </div>
          </div>

          {/* Card: Quantos kg quer perder */}
          <div className="form-card">
            <div className="card-title">🎯 Quantos quilos quer perder?</div>
            <div className="slider-wrap">
              <input
                ref={sliderRef}
                type="range"
                className="slider"
                min={1} max={50}
                value={form.kgPerder}
                onChange={e => setForm(f => ({ ...f, kgPerder: parseInt(e.target.value) }))}
              />
              <div className="slider-labels">
                <span>1 kg</span>
                <span>50 kg</span>
              </div>
            </div>
            <div className="slider-value">
              {form.kgPerder} <span>quilos</span>
            </div>
          </div>

          {/* Card: O que incomoda */}
          <div className="form-card">
            <div className="card-title">😣 O que mais te incomoda?</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Pode marcar mais de um 👇
            </p>
            <div className="bothers-grid">
              {INCOMODA_OPTIONS.map(opt => {
                const sel = form.incomoda.includes(opt.id)
                return (
                  <label
                    key={opt.id}
                    className={`bother-chip ${sel ? 'selected' : ''}`}
                    onClick={() => toggleBother(opt.id)}
                  >
                    <span className="bother-icon">{opt.icon}</span>
                    <span className="bother-label">{opt.label}</span>
                    <div className="bother-check">{sel ? '✓' : ''}</div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Card: Duração */}
          <div className="form-card">
            <div className="card-title">📅 Duração do Plano</div>
            <div className="duration-grid">
              {([5, 10, 20] as const).map(d => (
                <button
                  key={d}
                  className={`dur-btn ${form.dias === d ? 'selected' : ''}`}
                  onClick={() => setForm(f => ({ ...f, dias: d }))}
                  type="button"
                >
                  <span className="dur-num">{d}</span>
                  <span className="dur-text">dias</span>
                  {d === 10 && <span className="dur-badge">⭐ Popular</span>}
                  {d === 20 && <span className="dur-badge">🏆 Completo</span>}
                </button>
              ))}
            </div>
          </div>

        </div>

        <div className="btn-gerar-wrap">
          <button
            className="btn-gerar"
            onClick={handleSubmit}
            disabled={!isValid}
            type="button"
          >
            ⚡ GERAR MEU PLANO GRATUITO
          </button>
        </div>
      </section>

      {/* ══ LOADING ══ */}
      <section id="screen-loading" className={`screen ${screen === 'loading' ? 'active' : ''}`}>
        <div style={{ textAlign: 'center', padding: '60px 24px', width: '100%' }}>
          <div className="loading-ring-wrap">
            <div className="loading-ring loading-ring-1" />
            <div className="loading-ring loading-ring-2" />
            <div className="loading-icon-center">🥗</div>
          </div>
          <h2 className="loading-title">Criando seu plano...</h2>
          <p className="loading-sub">Personalizado para você</p>
          <p id="loading-msg" aria-live="polite">{loadMsg}</p>
          <div className="progress-track">
            <div className="progress-bar" style={{ width: `${loadPct}%` }} />
          </div>
          <p className="progress-pct">{loadPct}%</p>
        </div>
      </section>

      {/* ══ PLANO ══ */}
      <section id="screen-plan" className={`screen ${screen === 'plan' ? 'active' : ''}`}>

        {/* Nav */}
        <nav className="plan-nav">
          <div className="plan-nav-inner">
            <div className="nav-brand">
              <Image src="/logo.png" alt="Logo" width={28} height={28} className="nav-logo" />
              <span className="nav-name">Emagrece Brasil</span>
            </div>
            <button
              className="btn-novo-plano"
              onClick={() => { if (confirm('Criar novo plano?')) { setPlan([]); setScreen('form') } }}
            >
              🔄 Novo plano
            </button>
          </div>
        </nav>

        {/* Hero */}
        {userData && nutrition && (
          <div className="plan-hero">
            <div className="plan-hero-name">{userData.name}</div>
            <div className="plan-hero-goal">
              🎯 Meta: perder {form.kgPerder} kg
              {form.incomoda.length > 0 && ` • foco em: ${form.incomoda.slice(0, 2).join(', ')}`}
            </div>
            <div className="plan-hero-stats">
              <div className="hero-stat">
                <span className="hero-stat-val">{nutrition.targetCalories}</span>
                <span className="hero-stat-lbl">kcal/dia</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-val">{plan.length}</span>
                <span className="hero-stat-lbl">dias</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-val">{nutrition.bmi.value}</span>
                <span className="hero-stat-lbl">IMC</span>
              </div>
            </div>
          </div>
        )}

        {/* Macros */}
        {nutrition && (
          <div className="macros-strip">
            <div className="macro-item">
              <span className="macro-val">{nutrition.macros.protein}g</span>
              <span className="macro-lbl">🥩 Proteína</span>
            </div>
            <div className="macro-item">
              <span className="macro-val">{nutrition.macros.carbs}g</span>
              <span className="macro-lbl">🍚 Carboidrato</span>
            </div>
            <div className="macro-item">
              <span className="macro-val">{nutrition.macros.fat}g</span>
              <span className="macro-lbl">🥑 Gordura</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="day-tabs-bar">
          <div className="day-tabs" role="tablist">
            {plan.map((d, i) => (
              <button
                key={i}
                className={`day-tab ${i === currentDay ? 'active' : ''}`}
                onClick={() => selectDay(i)}
                role="tab"
                aria-selected={i === currentDay}
              >
                <span className="day-tab-day">Dia {d.day}</span>
                <span className="day-tab-name">{d.dayName.substring(0, 3)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Nav setas */}
        <div className="day-nav">
          <button className="btn-nav-day" onClick={() => currentDay > 0 && selectDay(currentDay - 1)}>‹</button>
          <span className="day-nav-label">Toque para navegar</span>
          <button className="btn-nav-day" onClick={() => currentDay < plan.length - 1 && selectDay(currentDay + 1)}>›</button>
        </div>

        {/* Conteúdo do dia */}
        <main id="day-content">
          {day && (
            <>
              {/* Header do dia */}
              <div className="day-card-header">
                <div className="day-info">
                  <div className="day-num">Dia {day.day}</div>
                  <div className="day-weekday">{day.dayName}</div>
                  <div className="day-date">{day.date}</div>
                </div>
                <div className="day-kcal">
                  <span className="kcal-val">{day.totalCalories}</span>
                  <span className="kcal-lbl">kcal</span>
                </div>
              </div>

              {/* Suco detox */}
              {day.detoxJuice && (
                <div className="juice-card">
                  <div className="juice-top">
                    <span className="juice-ico">🥬</span>
                    <div>
                      <div className="juice-tag">Suco Detox do Dia</div>
                      <div className="juice-name">{day.detoxJuice.name}</div>
                    </div>
                    <div className="juice-kcal">{day.detoxJuice.calories} kcal</div>
                  </div>
                  {day.detoxJuice.benefits && (
                    <div className="juice-benefit">✨ {day.detoxJuice.benefits}</div>
                  )}
                  <button className="btn-expandir" onClick={() => toggleExpand(`j-${day.detoxJuice!.id}`)}>
                    <span>Ver ingredientes</span>
                    <span className="expand-icon">{expanded[`j-${day.detoxJuice.id}`] ? '▲' : '▼'}</span>
                  </button>
                  {expanded[`j-${day.detoxJuice.id}`] && (
                    <div className="recipe-detail">
                      <div className="recipe-sec">📋 Ingredientes</div>
                      <div className="ing-list">
                        {day.detoxJuice.ingredients.map((ing, i) => (
                          <div key={i} className="ing-item">• {ing}</div>
                        ))}
                      </div>
                      {day.detoxJuice.prep && (
                        <>
                          <div className="recipe-sec">👨‍🍳 Preparo</div>
                          <div className="prep-txt">{day.detoxJuice.prep}</div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Refeições */}
              {Object.entries(day.meals).map(([type, recipe]) => {
                if (!recipe) return null
                const info = MEAL_LABELS[type as keyof typeof MEAL_LABELS]
                const key = `m-${recipe.id}-${day.day}`
                return (
                  <div key={key} className="meal-card">
                    <div className="meal-head">
                      <div className="meal-type">
                        <span className="meal-type-emoji">{info.emoji}</span>
                        <div>
                          <div className="meal-type-label">{info.label}</div>
                          <div className="meal-type-time">{info.time}</div>
                        </div>
                      </div>
                      <div className="meal-kcal">
                        <span className="meal-kcal-val">{recipe.calories}</span>
                        <span className="meal-kcal-unit">kcal</span>
                      </div>
                    </div>
                    <div className="meal-name">{recipe.name}</div>
                    <div className="meal-macros">
                      <span className="m-macro">🥩 {recipe.protein || 0}g</span>
                      <span className="m-macro">🍚 {recipe.carbs || 0}g</span>
                      <span className="m-macro">🥑 {recipe.fat || 0}g</span>
                    </div>
                    <button className="btn-expandir" onClick={() => toggleExpand(key)}>
                      <span>Ver receita completa</span>
                      <span className="expand-icon">{expanded[key] ? '▲' : '▼'}</span>
                    </button>
                    {expanded[key] && (
                      <div className="recipe-detail">
                        <div className="recipe-sec">📋 Ingredientes</div>
                        <div className="ing-list">
                          {recipe.ingredients.map((ing, i) => (
                            <div key={i} className="ing-item">• {ing}</div>
                          ))}
                        </div>
                        {recipe.prep && (
                          <>
                            <div className="recipe-sec">👨‍🍳 Modo de Preparo</div>
                            <div className="prep-txt">{recipe.prep}</div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </main>

        {/* Barra de ações */}
        <div className="action-bar">
          <div className="action-btns">
            <button className="btn-action btn-pdf" onClick={handlePDF} disabled={pdfLoading}>
              {pdfLoading ? <span className="spinner" /> : '📥'} Baixar PDF
            </button>
            <button className="btn-action btn-wpp" onClick={handleWhatsApp}>
              💬 WhatsApp
            </button>
            <button
              className="btn-action btn-regen"
              onClick={() => { if (userData && nutrition && recipes) { const p = generatePlan(userData, nutrition, recipes, form.dias); setPlan(p); setCurrentDay(0) } }}
              title="Gerar novo plano"
            >
              🔄
            </button>
          </div>
        </div>
      </section>

      {/* Toast */}
      {toast && (
        <div className={`toast show ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  )
}

// Fallback de receitas padrão (quando banco não está configurado)
function getDefaultRecipes(): RecipesByCategory {
  return {
    breakfast: [
      { id:'b1', name:'Panqueca de Banana e Aveia', category:'breakfast', calories:280, protein:12, carbs:38, fat:8, ingredients:['1 banana amassada','2 ovos','3 col. aveia','canela','mel'], prep:'Misture tudo e frite em frigideira antiaderente.' },
      { id:'b2', name:'Iogurte Grego com Granola e Frutas', category:'breakfast', calories:240, protein:18, carbs:28, fat:5, ingredients:['200g iogurte grego','3 col. granola','frutas vermelhas','mel','chia'], prep:'Monte em camadas e sirva.' },
      { id:'b3', name:'Ovos Mexidos com Espinafre', category:'breakfast', calories:260, protein:22, carbs:6, fat:15, ingredients:['3 ovos','1 xíc. espinafre','queijo cottage','alho','azeite'], prep:'Refogue o espinafre e misture os ovos.' },
      { id:'b4', name:'Tapioca com Frango e Queijo', category:'breakfast', calories:290, protein:24, carbs:32, fat:6, ingredients:['4 col. goma de tapioca','100g frango desfiado','cream cheese light','rúcula'], prep:'Aqueça a tapioca e recheie.' },
      { id:'b5', name:'Mingau de Aveia com Maçã', category:'breakfast', calories:220, protein:9, carbs:40, fat:4, ingredients:['5 col. aveia','250ml leite','1 maçã','canela','mel'], prep:'Cozinhe a aveia no leite e adicione a maçã.' },
    ],
    morningSnack: [
      { id:'ms1', name:'Mix de Castanhas', category:'morningSnack', calories:180, protein:5, carbs:18, fat:11, ingredients:['10 amêndoas','5 castanhas-do-pará','nozes','1 damasco'], prep:'Misture e sirva.' },
      { id:'ms2', name:'Maçã com Pasta de Amendoim', category:'morningSnack', calories:200, protein:6, carbs:24, fat:9, ingredients:['1 maçã','1 col. pasta de amendoim natural','canela'], prep:'Fatie a maçã e sirva com pasta.' },
      { id:'ms3', name:'Iogurte com Kiwi', category:'morningSnack', calories:130, protein:10, carbs:18, fat:2, ingredients:['150g iogurte natural','1 kiwi','mel','hortelã'], prep:'Monte e sirva gelado.' },
    ],
    lunch: [
      { id:'l1', name:'Frango Grelhado com Batata-Doce', category:'lunch', calories:420, protein:38, carbs:40, fat:9, ingredients:['150g filé de frango','1 batata-doce','brócolis','alho','limão','azeite'], prep:'Grelhe o frango e cozinhe os legumes.' },
      { id:'l2', name:'Bowl de Quinoa com Salmão', category:'lunch', calories:460, protein:35, carbs:42, fat:14, ingredients:['150g salmão','½ xíc. quinoa','abacate','tomate cereja','rúcula','limão'], prep:'Cozinhe a quinoa, grelhe o salmão e monte o bowl.' },
      { id:'l3', name:'Salada de Grão-de-Bico com Atum', category:'lunch', calories:350, protein:30, carbs:36, fat:8, ingredients:['1 lata atum','1 xíc. grão-de-bico','tomate','pepino','azeitona','azeite'], prep:'Misture tudo e tempere.' },
      { id:'l4', name:'Tilápia Assada com Aspargos', category:'lunch', calories:390, protein:36, carbs:38, fat:8, ingredients:['150g tilápia','aspargos','arroz integral','limão siciliano','ervas'], prep:'Tempere o peixe e asse a 200°C por 20 min.' },
      { id:'l5', name:'Wrap de Frango com Guacamole', category:'lunch', calories:400, protein:32, carbs:36, fat:14, ingredients:['1 wrap integral','120g frango','½ abacate','tomate','coentro','alface'], prep:'Faça o guacamole, aqueça o wrap e recheie.' },
    ],
    afternoonSnack: [
      { id:'as1', name:'Ovo Cozido com Cenoura', category:'afternoonSnack', calories:140, protein:13, carbs:8, fat:7, ingredients:['2 ovos cozidos','1 cenoura','sal','pimenta'], prep:'Cozinhe os ovos e sirva com cenoura.' },
      { id:'as2', name:'Vitamina de Abacate com Cacau', category:'afternoonSnack', calories:220, protein:7, carbs:22, fat:12, ingredients:['¼ abacate','1 col. cacau 100%','200ml leite','mel','gelo'], prep:'Bata tudo no liquidificador.' },
      { id:'as3', name:'Chips de Grão-de-Bico', category:'afternoonSnack', calories:160, protein:8, carbs:22, fat:5, ingredients:['1 lata grão-de-bico','azeite','páprica','sal','cominho'], prep:'Seque, tempere e asse a 200°C por 35 min.' },
    ],
    dinner: [
      { id:'d1', name:'Sopa de Legumes com Frango', category:'dinner', calories:280, protein:28, carbs:24, fat:6, ingredients:['100g frango','abobrinha','cenoura','batata-doce','caldo de legumes','salsinha'], prep:'Cozinhe tudo junto por 20 minutos.' },
      { id:'d2', name:'Peixe no Papelote com Ervas', category:'dinner', calories:250, protein:34, carbs:4, fat:10, ingredients:['150g peixe','limão siciliano','alecrim','tomilho','azeite'], prep:'Embrulhe no papel alumínio e asse a 200°C por 20 min.' },
      { id:'d3', name:'Creme de Abóbora com Cúrcuma', category:'dinner', calories:200, protein:6, carbs:30, fat:6, ingredients:['300g abóbora','leite de coco light','cúrcuma','gengibre','sementes de abóbora'], prep:'Cozinhe a abóbora e bata com o leite de coco.' },
      { id:'d4', name:'Omelete Fit com Queijo e Tomate', category:'dinner', calories:230, protein:20, carbs:6, fat:14, ingredients:['3 ovos','queijo minas','1 tomate','manjericão','azeite'], prep:'Faça a omelete e recheie.' },
      { id:'d5', name:'Stir-Fry de Tofu com Legumes', category:'dinner', calories:260, protein:18, carbs:20, fat:12, ingredients:['200g tofu firme','brócolis','pimentão','cenoura','shoyu','gergelim'], prep:'Frite o tofu e salteie os legumes em fogo alto.' },
    ],
    detoxJuice: [
      { id:'j1', name:'Suco Verde Detox Clássico', category:'detoxJuice', calories:80, protein:2, carbs:18, fat:0, ingredients:['1 folha de couve','1 pepino','1 limão','gengibre','200ml água de coco','hortelã'], prep:'Bata tudo e coe. Beba em jejum.', benefits:'Desintoxicante, anti-inflamatório, rico em clorofila' },
      { id:'j2', name:'Suco de Abacaxi com Cúrcuma', category:'detoxJuice', calories:90, protein:1, carbs:22, fat:0, ingredients:['2 rodelas de abacaxi','½ limão','1 col. cúrcuma','gengibre','hortelã','200ml água'], prep:'Bata e beba sem coar.', benefits:'Diurético, anti-inflamatório, auxilia na digestão' },
      { id:'j3', name:'Suco de Beterraba com Cenoura', category:'detoxJuice', calories:95, protein:2, carbs:22, fat:0, ingredients:['½ beterraba','1 cenoura','1 laranja','½ limão','gengibre','150ml água'], prep:'Extraia na centrífuga ou bata e coe.', benefits:'Rico em antioxidantes, melhora a circulação' },
      { id:'j4', name:'Água Detox de Limão e Gengibre', category:'detoxJuice', calories:25, protein:0, carbs:6, fat:0, ingredients:['1 limão fatiado','3 fatias gengibre','500ml água','folhas de hortelã','pepino'], prep:'Misture na água e deixe na geladeira por 2h.', benefits:'Alcalinizante, acelera o metabolismo' },
      { id:'j5', name:'Vitamina Detox de Maçã Verde', category:'detoxJuice', calories:85, protein:2, carbs:20, fat:0, ingredients:['1 maçã verde','espinafre','½ pepino','½ limão','200ml água de coco','gengibre'], prep:'Bata tudo e beba imediatamente.', benefits:'Rico em ferro, vitamina C, antioxidante natural' },
      { id:'j6', name:'Golden Milk Detox', category:'detoxJuice', calories:110, protein:5, carbs:12, fat:5, ingredients:['250ml leite vegetal','1 col. cúrcuma','canela','gengibre em pó','mel','pimenta preta'], prep:'Aqueça o leite e misture os temperos.', benefits:'Anti-inflamatório, melhora imunidade' },
    ],
  }
}
