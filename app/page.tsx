'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { processAll } from '@/lib/calculator'
import { generatePlan, buildWhatsAppText, MEAL_LABELS } from '@/lib/planner'
import type { UserData, NutritionData } from '@/lib/calculator'
import type { RecipesByCategory } from '@/lib/supabase'
import type { MealPlanDay } from '@/lib/planner'

interface FormData {
  nomeCompleto: string
  idade: string
  peso: string
  altura: string
  kgPerder: number
  incomoda: string[]
  dias: 5 | 10 | 20
}

interface CustomUser {
  id: string
  username: string
  name?: string
  has_plan_10: boolean
  has_plan_20: boolean
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

type Screen = 'splash' | 'login' | 'form' | 'loading' | 'plan'

export default function Home() {
  const [screen, setScreen]           = useState<Screen>('splash')
  const [user, setUser]               = useState<CustomUser | null>(null)
  
  // Auth Form State
  const [username, setUsername]       = useState('')
  const [password, setPassword]       = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Plan Form State
  const [form, setForm]               = useState<FormData>({ nomeCompleto: '', idade: '', peso: '', altura: '', kgPerder: 10, incomoda: [], dias: 5 })
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

  // Paywall Modal State
  const [showPaywall, setShowPaywall] = useState(false)
  const [paywallDays, setPaywallDays] = useState<10 | 20>(10)
  const [paying, setPaying]           = useState(false)
  const [pixCopied, setPixCopied]     = useState(false)

  // ── Carrega Sessão Local do Navegador ──────────────────────
  useEffect(() => {
    const savedUser = localStorage.getItem('emagrece_brasil_user')
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser)
        setUser(parsed)
        // Recarrega dados atualizados do banco para garantir que pegamos compras recentes
        refreshUserData(parsed.id)
      } catch {
        localStorage.removeItem('emagrece_brasil_user')
      }
    }
  }, [])

  // ── Redirecionamento Inicial ─────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      if (localStorage.getItem('emagrece_brasil_user')) {
        setScreen('form')
      } else {
        setScreen('login')
      }
    }, 2400)
    return () => clearTimeout(t)
  }, [])

  // ── Recarrega dados do usuário ───────────────────────────
  async function refreshUserData(userId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      if (data) {
        setUser(data)
        localStorage.setItem('emagrece_brasil_user', JSON.stringify(data))
      }
    } catch (e) {
      console.warn('Erro ao atualizar usuário do banco:', e)
    }
  }

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

  // ── Login Customizado por Usuário/Senha ─────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password) {
      showToast('Preencha o usuário e a senha.', 'err')
      return
    }

    setAuthLoading(true)
    try {
      const cleanedUsername = username.trim().toLowerCase()
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', cleanedUsername)
        .eq('password', password)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        showToast('Usuário ou senha inválidos. Solicite seu acesso.', 'err')
        return
      }

      setUser(data)
      localStorage.setItem('emagrece_brasil_user', JSON.stringify(data))
      showToast('Acesso autorizado! Bem-vindo(a).')
      setScreen('form')
    } catch (err: any) {
      showToast(err.message || 'Erro ao realizar login', 'err')
    } finally {
      setAuthLoading(false)
    }
  }

  // ── Validação do Formulário ──────────────────────────────
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

  // ── Seleciona Duração (com validação de compra) ──────────
  function selectDuration(days: 5 | 10 | 20) {
    if (days === 5) {
      setForm(f => ({ ...f, dias: 5 }))
      return
    }

    // Plano de 10 dias
    if (days === 10) {
      if (user?.has_plan_10 || user?.has_plan_20) {
        setForm(f => ({ ...f, dias: 10 }))
      } else {
        setPaywallDays(10)
        setShowPaywall(true)
      }
    }

    // Plano de 20 dias
    if (days === 20) {
      if (user?.has_plan_20) {
        setForm(f => ({ ...f, dias: 20 }))
      } else {
        setPaywallDays(20)
        setShowPaywall(true)
      }
    }
  }

  // ── Simula Compra com Pix ────────────────────────────────
  async function simulatePayment() {
    if (!user) return
    setPaying(true)
    
    setTimeout(async () => {
      try {
        const updateData = paywallDays === 10 
          ? { has_plan_10: true } 
          : { has_plan_20: true }

        const { error } = await (supabase as any)
          .from('users')
          .update(updateData)
          .eq('id', user.id)

        if (error) throw error

        const updatedUser = { ...user, ...updateData }
        setUser(updatedUser)
        localStorage.setItem('emagrece_brasil_user', JSON.stringify(updatedUser))
        
        setForm(f => ({ ...f, dias: paywallDays }))
        showToast(`🎉 Plano de ${paywallDays} dias liberado!`)
        setShowPaywall(false)
      } catch (err: any) {
        showToast('Erro ao liberar plano. Tente novamente.', 'err')
      } finally {
        setPaying(false)
        setPixCopied(false)
      }
    }, 3000)
  }

  // ── Gerador de Código Pix Estático (BR Code) ──────────────
  function generatePixPayload(key: string, name: string, city: string, amount: number, reference: string = 'FITPLANNER'): string {
    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    
    // Constrói tags EMV
    const buildTag = (id: string, value: string) => {
      const len = value.length.toString().padStart(2, '0')
      return id + len + value
    }

    const payloadParts = [
      '000201', // Payload Format Indicator
      buildTag('26', 
        buildTag('00', 'br.gov.bcb.pix') + 
        buildTag('01', key.trim())
      ),
      buildTag('52', '0000'), // Merchant Category Code
      buildTag('53', '986'),  // Currency (BRL)
      buildTag('54', amount.toFixed(2)), // Amount (9.00 ou 12.00)
      buildTag('58', 'BR'),  // Country Code
      buildTag('59', norm(name).substring(0, 25)), // Beneficiário
      buildTag('60', norm(city).substring(0, 15)), // Cidade
      buildTag('62', buildTag('05', norm(reference).substring(0, 25))) // Referência
    ]

    const incompletePayload = payloadParts.join('') + '6304'

    // Cálculo do CRC16 CCITT
    let crc = 0xFFFF
    for (let i = 0; i < incompletePayload.length; i++) {
      const charCode = incompletePayload.charCodeAt(i)
      for (let j = 0; j < 8; j++) {
        const bit = ((charCode >> (7 - j) & 1) === 1)
        const c15 = ((crc >> 15 & 1) === 1)
        crc <<= 1
        if (c15 !== bit) crc ^= 0x1021
      }
    }
    crc &= 0xFFFF
    const crcHex = crc.toString(16).toUpperCase().padStart(4, '0')

    return incompletePayload + crcHex
  }

  // ── Copiar Chave Pix Dinâmica ────────────────────────────
  function copyPixKey() {
    const pixKey  = process.env.NEXT_PUBLIC_PIX_KEY || '12345678000199'
    const pixName = process.env.NEXT_PUBLIC_PIX_NAME || 'EMAGRECE BRASIL'
    const pixCity = process.env.NEXT_PUBLIC_PIX_CITY || 'SAO PAULO'
    const value   = paywallDays === 10 ? 9.00 : 12.00

    try {
      const pixCode = generatePixPayload(pixKey, pixName, pixCity, value)
      navigator.clipboard.writeText(pixCode)
      setPixCopied(true)
      showToast('Pix Copia e Cola copiado com sucesso! Abra seu banco.')
      setTimeout(() => setPixCopied(false), 2000)
    } catch {
      showToast('Erro ao gerar código Pix. Copie o CNPJ direto.', 'err')
    }
  }

  // ── Submissão do Formulário ───────────────────────────────
  async function handleSubmit() {
    if (!isValid) return

    const ud: UserData = {
      name:          form.nomeCompleto.trim(),
      weight:        parseFloat(form.peso),
      height:        parseFloat(form.altura),
      age:           parseInt(form.idade),
      sex:           'female',
      goal:          'lose',
      activityLevel: 'light',
      days:          form.dias,
      kgPerder:      form.kgPerder,
      incomoda:      form.incomoda,
    }

    setUserData(ud)
    setScreen('loading')

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

            const dbCount = recipes ? Object.values(recipes).reduce((a, b) => a + b.length, 0) : 0
            const recipeData = dbCount > 0 ? recipes! : getDefaultRecipes()
            const p = generatePlan(ud, nd, recipeData, form.dias)
            setPlan(p)
            setCurrentDay(0)
            setScreen('plan')
          } catch {
            showToast('Erro ao gerar o plano.', 'err')
            setScreen('form')
          }
        }, 400)
      }
    }, 420)
  }

  function selectDay(i: number) {
    setCurrentDay(i)
    setExpanded({})
  }

  function toggleExpand(id: string) {
    setExpanded(e => ({ ...e, [id]: !e[id] }))
  }

  async function handlePDF() {
    if (!plan.length || !userData || !nutrition) return
    setPdfLoading(true)
    try {
      const { jsPDF } = (await import('jspdf')).default ? await import('jspdf') : { jsPDF: (window as any).jspdf?.jsPDF }
      generatePDF(new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }))
      showToast('✅ PDF baixado!')
    } catch {
      showToast('Erro ao gerar PDF.', 'err')
    } finally {
      setPdfLoading(false)
    }
  }

  function cleanTextForPDF(str: string): string {
    if (!str) return ''
    return str.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF])/g, '').trim()
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
    doc.text(cleanTextForPDF(userData.name), pageW / 2, 76, { align: 'center' })

    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)
    const info = [
      ['Objetivo', `Perder ${form.kgPerder} kg`],
      ['Meta calórica', `${nutrition.targetCalories} kcal/dia`],
      ['Duração', `${plan.length} dias`],
      ['IMC', `${nutrition.bmi.value} — ${nutrition.bmi.classification}`],
    ]
    let y = 90
    info.forEach(([l, v]) => {
      doc.setFillColor(248, 250, 252)
      doc.roundedRect(m, y - 5, cW, 11, 1, 1, 'F')
      doc.setFont('helvetica', 'bold')
      doc.text(cleanTextForPDF(l), m + 3, y + 2)
      doc.setFont('helvetica', 'normal')
      doc.text(cleanTextForPDF(v), pageW - m - 3, y + 2, { align: 'right' })
      y += 14
    })

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
        doc.text(cleanTextForPDF(info.label.toUpperCase()), m + 6, dy + 7)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(15, 23, 42)
        doc.text(cleanTextForPDF(recipe.name), m + 6, dy + 15)
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
        doc.text(`SUCO DETOX: ${cleanTextForPDF(day.detoxJuice.name)}`, m + 4, dy + 13)
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

  function handleLogout() {
    if (confirm('Deseja realmente sair da sua conta?')) {
      localStorage.removeItem('emagrece_brasil_user')
      setUser(null)
      setScreen('login')
    }
  }

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

      {/* ══ LOGIN ══ */}
      <section id="screen-login" className={`screen ${screen === 'login' ? 'active' : ''}`} style={{ justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '24px 20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <Image src="/logo.png" alt="Logo" width={56} height={56} style={{ objectFit: 'contain', margin: '0 auto' }} />
            <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--green-dark)', marginTop: 8 }}>Acesse sua Conta</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Digite seu usuário e senha fornecidos para entrar</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field">
              <label className="field-label" htmlFor="username">Usuário</label>
              <div className="input-wrap">
                <input 
                  id="username"
                  type="text" 
                  placeholder="Nome de usuário" 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="password">Senha</label>
              <div className="input-wrap">
                <input 
                  id="password"
                  type="password" 
                  placeholder="Digite sua senha" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              style={{
                width: '100%', padding: '14px', background: 'linear-gradient(135deg, var(--green), var(--green-dark))',
                border: 'none', borderRadius: 10, color: 'white', fontWeight: 800, fontSize: 15,
                cursor: authLoading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
                boxShadow: 'var(--shadow-green)', marginTop: 8
              }}
            >
              {authLoading ? 'Verificando...' : 'ENTRAR'}
            </button>
          </form>
        </div>
      </section>

      {/* ══ FORMULÁRIO ══ */}
      <section id="screen-form" className={`screen ${screen === 'form' ? 'active' : ''}`}>

        <div className="form-header">
          <div className="brand-row">
            <Image src="/logo.png" alt="Logo" width={36} height={36} className="brand-logo" />
            <span className="brand-name">Emagrece Brasil</span>
            <button 
              onClick={handleLogout}
              style={{
                marginLeft: 'auto', background: 'none', border: 'none', 
                color: 'var(--error)', fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}
            >
              Sair🚪
            </button>
          </div>
        </div>

        <div className="form-hero">
          <h2 className="form-hero-title">Vamos criar seu plano! 💪</h2>
          <p style={{ fontSize: 12, color: 'var(--green-dark)', fontWeight: 'bold' }}>👤 Logado como: @{user?.username}</p>
        </div>

        <div className="form-body">

          {/* Card: Dados Pessoais */}
          <div className="form-card">
            <div className="card-title">Seus Dados</div>

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
            <div className="card-title">Quantos quilos quer perder?</div>
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
            <div className="card-title">O que mais te incomoda?</div>
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
            <div className="card-title">Duração do Plano</div>
            <div className="duration-grid">
              <button
                className={`dur-btn ${form.dias === 5 ? 'selected' : ''}`}
                onClick={() => selectDuration(5)}
                type="button"
              >
                <span className="dur-num">5</span>
                <span className="dur-text">dias</span>
                <span className="dur-badge" style={{ background: '#e2e8f0', color: '#475569' }}>Grátis</span>
              </button>

              <button
                className={`dur-btn ${form.dias === 10 ? 'selected' : ''}`}
                onClick={() => selectDuration(10)}
                type="button"
              >
                <span className="dur-num">10</span>
                <span className="dur-text">dias</span>
                {user?.has_plan_10 || user?.has_plan_20 ? (
                  <span className="dur-badge" style={{ background: 'var(--green-light)', color: 'var(--green-dark)' }}>Liberado</span>
                ) : (
                  <span className="dur-badge">R$ 9,00/mês</span>
                )}
              </button>

              <button
                className={`dur-btn ${form.dias === 20 ? 'selected' : ''}`}
                onClick={() => selectDuration(20)}
                type="button"
              >
                <span className="dur-num">20</span>
                <span className="dur-text">dias</span>
                {user?.has_plan_20 ? (
                  <span className="dur-badge" style={{ background: 'var(--green-light)', color: 'var(--green-dark)' }}>Liberado</span>
                ) : (
                  <span className="dur-badge">R$ 9,00/mês</span>
                )}
              </button>
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
            ⚡ GERAR MEU PLANO PERSONALIZADO
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
            <button className="btn-action btn-pdf" onClick={handlePDF} disabled={pdfLoading} style={{ flex: 1 }}>
              {pdfLoading ? <span className="spinner" /> : '📥'} BAIXAR MEU PLANO EM PDF
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

      {/* ══ OVERLAY: MODAL PIX DE COBRANÇA ══ */}
      {showPaywall && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,.75)', 
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', 
          justifyContent: 'center', zIndex: 999
        }}>
          <div style={{
            background: '#fff', width: '100%', maxWidth: 430,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: '24px 20px 36px', boxShadow: '0 -10px 40px rgba(0,0,0,.2)',
            animation: 'slideUp .3s cubic-bezier(.34,1.56,.64,1) both'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--green-dark)' }}>🔐 Desbloquear Plano Completo</span>
              <button 
                onClick={() => setShowPaywall(false)}
                style={{ background: '#f1f5f9', border: 'none', width: 28, height: 28, borderRadius: '50%', fontSize: 14, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
                O plano de 5 dias é grátis. Para acessar o plano de <strong>{paywallDays} dias</strong> você precisa assinar o nosso plano mensal:
              </p>
              <div style={{ background: 'var(--green-light)', display: 'inline-block', padding: '12px 24px', borderRadius: 16 }}>
                <span style={{ fontSize: 13, color: 'var(--green-dark)', fontWeight: 600 }}>Assinatura Mensal</span>
                <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--green-dark)', marginTop: 2 }}>
                  R$ {paywallDays === 10 ? '9,00' : '12,00'} / mês
                </div>
              </div>
            </div>

            {/* Link de Pagamento do InfinitePay */}
            <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 16, textAlign: 'center', marginBottom: 20, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
              <p style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--text-2)', marginBottom: 10 }}>
                Toque no botão abaixo para abrir a página de pagamento seguro no InfinitePay.
              </p>
              
              <a
                href="https://invoice.infinitepay.io/plans/comfortclean-pvai/CTO0eeKjET"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block', padding: '14px 16px', background: '#fff',
                  border: '2px solid #5b21b6', textDecoration: 'none',
                  borderRadius: 10, color: '#5b21b6',
                  fontSize: 14, fontWeight: 800, textAlign: 'center'
                }}
              >
                💳 IR PARA O INFINITEPAY
              </a>
            </div>

            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12 }}>
              Depois de confirmar o pagamento no InfinitePay, toque no botão abaixo para liberar seu acesso.
            </p>

            <button
              onClick={simulatePayment}
              disabled={paying}
              style={{
                width: '100%', padding: '15px', background: paying ? '#86efac' : 'linear-gradient(135deg, var(--green), var(--green-dark))',
                border: 'none', borderRadius: 12, color: 'white', fontWeight: 800, fontSize: 15,
                cursor: paying ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}
            >
              {paying ? (
                <>
                  <span className="spinner" />
                  Liberando acesso...
                </>
              ) : '✅ JÁ ASSINEI, LIBERAR MEU PLANO'}
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast show ${toast.type}`}>{toast.msg}</div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

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
