'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

interface CustomUser {
  id: string
  username: string
  password?: string
  name?: string
  has_plan_10: boolean
  has_plan_20: boolean
  created_at: string
}

interface UploadResult {
  success?: boolean
  warning?: string
  hint?: string
  filename?: string
  recipesFound?: number
  categories?: Record<string, number>
  error?: string
}

type AdminTab = 'users' | 'pdfs'

export default function AdminPage() {
  const [password, setPassword]       = useState('')
  const [authed, setAuthed]           = useState(false)
  const [authErr, setAuthErr]         = useState(false)
  
  // Tabs
  const [activeTab, setActiveTab]     = useState<AdminTab>('users')

  // Users CRM State
  const [users, setUsers]             = useState<CustomUser[]>([])
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName]         = useState('')
  const [newPlan, setNewPlan]         = useState<'free' | '10' | '20'>('free')
  const [userLoading, setUserLoading] = useState(false)

  // PDFs State
  const [uploading, setUploading]     = useState(false)
  const [statusMsg, setStatusMsg]     = useState('')
  const [results, setResults]         = useState<UploadResult[]>([])
  const [pdfType, setPdfType]         = useState<'fit' | 'detox'>('fit')
  const [totalRecipes, setTotal]      = useState(0)
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false)
  
  const fileRef = useRef<HTMLInputElement>(null)

  // Tenta carregar o PDF.js do CDN no mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any)['pdfjs-dist/build/pdf']) {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      script.onload = () => {
        const pdfjsLib = (window as any)['pdfjs-dist/build/pdf']
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        setPdfjsLoaded(true)
      }
      script.onerror = () => console.error('Erro ao carregar PDF.js')
      document.head.appendChild(script)
    } else {
      setPdfjsLoaded(true)
    }
  }, [])

  // Tenta autenticar com a senha digitada
  function handleAuth() {
    if (password.trim().length >= 4) {
      setAuthed(true)
      loadAllData()
    } else {
      setAuthErr(true)
    }
  }

  function loadAllData() {
    loadUploads()
    loadUsers()
  }

  async function loadUploads() {
    try {
      const r = await fetch('/api/recipes')
      const data = await r.json()
      const count = Object.values(data as Record<string, unknown[]>).reduce((a, b) => a + b.length, 0)
      setTotal(count)
    } catch {}
  }

  // ── CRM: Carrega lista de usuários ─────────────────────────
  async function loadUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (e) {
      console.error('Erro ao carregar usuários:', e)
    }
  }

  // ── CRM: Cadastra Novo Usuário ────────────────────────────
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    if (!newUsername || !newPassword) {
      alert('Usuário e senha são obrigatórios.')
      return
    }

    setUserLoading(true)
    try {
      const cleanUsername = newUsername.trim().toLowerCase()
      const { error } = await (supabase as any)
        .from('users')
        .insert({
          username: cleanUsername,
          password: newPassword,
          name: newName.trim() || null,
          has_plan_10: newPlan === '10' || newPlan === '20',
          has_plan_20: newPlan === '20'
        })

      if (error) throw error

      alert('Usuário criado com sucesso!')
      setNewUsername('')
      setNewPassword('')
      setNewName('')
      setNewPlan('free')
      loadUsers()
    } catch (err: any) {
      alert(`Erro: ${err.message || 'Nome de usuário já existe.'}`)
    } finally {
      setUserLoading(false)
    }
  }

  // ── CRM: Alterna status de plano ──────────────────────────
  async function toggleUserPlan(userId: string, plan: '10' | '20', currentStatus: boolean) {
    try {
      const updateData = plan === '10'
        ? { has_plan_10: !currentStatus }
        : { has_plan_20: !currentStatus }

      const { error } = await (supabase as any)
        .from('users')
        .update(updateData)
        .eq('id', userId)

      if (error) throw error
      loadUsers()
    } catch (err: any) {
      alert('Erro ao atualizar plano.')
    }
  }

  // ── CRM: Deleta Usuário ───────────────────────────────────
  async function handleDeleteUser(userId: string, username: string) {
    if (!confirm(`Tem certeza que deseja remover o usuário @${username}? Acesso dele será cortado.`)) return

    try {
      const { error } = await (supabase as any)
        .from('users')
        .delete()
        .eq('id', userId)

      if (error) throw error
      loadUsers()
    } catch (err: any) {
      alert('Erro ao deletar usuário.')
    }
  }

  // ── PDF: Leitura e extração do texto no navegador ──────────
  async function extractTextFromPdf(file: File, onProgress: (msg: string) => void): Promise<string> {
    const pdfjsLib = (window as any)['pdfjs-dist/build/pdf']
    if (!pdfjsLib) throw new Error('Biblioteca PDF.js não carregada.')

    onProgress('Carregando arquivo...')
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    let fullText = ''

    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress(`Extraindo página ${i} de ${pdf.numPages}...`)
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map((item: any) => item.str).join(' ')
      fullText += pageText + '\n\n'
    }

    return fullText
  }

  // ── PDF: Processa Upload dos arquivos ─────────────────────
  async function handleUpload() {
    const files = fileRef.current?.files
    if (!files || files.length === 0) return

    setUploading(true)
    setResults([])
    const newResults: UploadResult[] = []

    for (const file of Array.from(files)) {
      try {
        setStatusMsg(`Lendo: ${file.name}...`)
        const text = await extractTextFromPdf(file, (msg) => {
          setStatusMsg(`[${file.name}] ${msg}`)
        })

        setStatusMsg(`Enviando dados...`)
        const r = await fetch('/api/upload', {
          method: 'POST',
          headers: { 
            'x-admin-password': password,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text, type: pdfType, filename: file.name }),
        })

        const data: UploadResult = await r.json()
        newResults.push(data)
      } catch (err: any) {
        newResults.push({ error: `Erro em ${file.name}: ${err.message || 'Falha ao processar'}` })
      }
    }

    setResults(newResults)
    setUploading(false)
    setStatusMsg('')
    if (fileRef.current) fileRef.current.value = ''
    loadUploads()
  }

  // ── RENDERIZAÇÃO TELA DE LOGIN ADMIN ─────────────────────────
  if (!authed) {
    return (
      <div style={{ minHeight: '100dvh', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 360, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Image src="/logo.png" alt="Logo" width={64} height={64} style={{ objectFit: 'contain' }} />
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', marginTop: 12 }}>Painel Admin</h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Emagrece Brasil — Gestão Geral</p>
          </div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Senha de acesso</label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setAuthErr(false) }}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            placeholder="Digite a senha..."
            style={{
              display: 'block', width: '100%', marginTop: 6, marginBottom: 12,
              padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${authErr ? '#ef4444' : '#e2e8f0'}`,
              fontSize: 15, fontFamily: 'Inter, sans-serif', outline: 'none'
            }}
            autoFocus
          />
          {authErr && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>Senha incorreta. Verifique o .env.local</p>}
          <button
            onClick={handleAuth}
            style={{
              width: '100%', padding: '13px', background: 'linear-gradient(135deg,#22c55e,#16a34a)',
              border: 'none', borderRadius: 10, color: 'white', fontWeight: 700, fontSize: 15,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif'
            }}
          >
            Entrar
          </button>
        </div>
      </div>
    )
  }

  // ── RENDERIZAÇÃO PAINEL PRINCIPAL ADMIN ───────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: '#f0fdf4', fontFamily: 'Inter, sans-serif', paddingBottom: 40 }}>
      
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Image src="/logo.png" alt="Logo" width={32} height={32} style={{ objectFit: 'contain' }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>Emagrece Brasil — Admin</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Gestão de clientes & banco de receitas ({totalRecipes} cadastradas)</div>
        </div>
        <a href="/" style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b', textDecoration: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px' }}>
          ← Ver App
        </a>
      </header>

      {/* Tabs Selector */}
      <div style={{ maxWidth: 750, margin: '20px auto 0', padding: '0 16px', display: 'flex', gap: 8 }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            flex: 1, padding: 12, border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14,
            background: activeTab === 'users' ? '#22c55e' : '#fff',
            color: activeTab === 'users' ? '#fff' : '#64748b',
            boxShadow: activeTab === 'users' ? '0 4px 12px rgba(34,197,94,.2)' : 'none'
          }}
        >
          👥 Clientes ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('pdfs')}
          style={{
            flex: 1, padding: 12, border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14,
            background: activeTab === 'pdfs' ? '#22c55e' : '#fff',
            color: activeTab === 'pdfs' ? '#fff' : '#64748b',
            boxShadow: activeTab === 'pdfs' ? '0 4px 12px rgba(34,197,94,.2)' : 'none'
          }}
        >
          📄 Importar Receitas (PDF)
        </button>
      </div>

      <div style={{ maxWidth: 750, margin: '0 auto', padding: '20px 16px' }}>

        {/* ══ TAB 1: GESTÃO DE CLIENTES ══ */}
        {activeTab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Criar Novo Usuário */}
            <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>👤 Cadastrar Novo Cliente</h3>
              <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Nome de Usuário (login)*</label>
                  <input
                    type="text"
                    placeholder="Ex: joaosilva"
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Senha de Acesso*</label>
                  <input
                    type="text"
                    placeholder="Ex: 123456"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, outline: 'none' }}
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Nome Completo do Cliente (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: João da Silva"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, outline: 'none' }}
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Duração do Plano Inicial Liberado</label>
                  <select
                    value={newPlan}
                    onChange={e => setNewPlan(e.target.value as any)}
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, outline: 'none', background: '#fff' }}
                  >
                    <option value="free">Apenas 5 Dias (Grátis)</option>
                    <option value="10">Até 10 Dias Liberados (Assinatura Ativa)</option>
                    <option value="20">Até 20 Dias Liberados (Assinatura Ativa)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={userLoading}
                  style={{
                    gridColumn: 'span 2', padding: 12, border: 'none', borderRadius: 8,
                    background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: 'white',
                    fontWeight: 700, cursor: userLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {userLoading ? 'Cadastrando...' : '➕ CADASTRAR CLIENTE'}
                </button>
              </form>
            </div>

            {/* Listagem de Usuários */}
            <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>📋 Lista de Clientes</h3>
              {users.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: 13, padding: '20px 0' }}>Nenhum cliente cadastrado no banco.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {users.map(u => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                          {u.name || 'Sem Nome Cadastrado'}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          usuário: <strong style={{ color: '#16a34a' }}>@{u.username}</strong> | senha: <code>{u.password}</code>
                        </div>
                      </div>

                      {/* Botões de Acesso do Plano */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => toggleUserPlan(u.id, '10', u.has_plan_10)}
                          style={{
                            padding: '6px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            background: u.has_plan_10 ? '#dcfce7' : '#f1f5f9',
                            color: u.has_plan_10 ? '#16a34a' : '#475569',
                          }}
                        >
                          {u.has_plan_10 ? 'Plano 10d ✓' : 'Plan 10d 🔐'}
                        </button>
                        <button
                          onClick={() => toggleUserPlan(u.id, '20', u.has_plan_20)}
                          style={{
                            padding: '6px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            background: u.has_plan_20 ? '#dcfce7' : '#f1f5f9',
                            color: u.has_plan_20 ? '#16a34a' : '#475569',
                          }}
                        >
                          {u.has_plan_20 ? 'Plano 20d ✓' : 'Plan 20d 🔐'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.username)}
                          style={{
                            padding: '6px 8px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            background: '#fee2e2', color: '#ef4444'
                          }}
                          title="Remover Cliente"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ══ TAB 2: IMPORTADOR DE PDFs ══ */}
        {activeTab === 'pdfs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>📄 Importar PDFs de Receitas</h2>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
                Extraímos o texto do PDF no seu próprio navegador e enviamos de forma segura ao banco. 
                Isso permite ler arquivos grandes sem dar erro!
              </p>

              {/* Tipo do PDF */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>Tipo do PDF</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(['fit', 'detox'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setPdfType(t)}
                      style={{
                        padding: '10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                        fontWeight: 600, fontSize: 13,
                        border: `1.5px solid ${pdfType === t ? '#22c55e' : '#e2e8f0'}`,
                        background: pdfType === t ? '#f0fdf4' : '#f8fafc',
                        color: pdfType === t ? '#16a34a' : '#64748b',
                      }}
                    >
                      {t === 'fit' ? '🥗 Receitas Fit' : '🥬 Sucos Detox'}
                    </button>
                  ))}
                </div>
              </div>

              {/* File input */}
              <div
                style={{
                  border: '2px dashed #bbf7d0', borderRadius: 10, padding: '24px 16px',
                  textAlign: 'center', cursor: pdfjsLoaded ? 'pointer' : 'not-allowed', background: '#f8fffe', marginBottom: 14,
                  opacity: pdfjsLoaded ? 1 : 0.6
                }}
                onClick={() => pdfjsLoaded && fileRef.current?.click()}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>
                  {pdfjsLoaded ? 'Clique para selecionar os PDFs' : 'Carregando biblioteca do leitor...'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Pode selecionar múltiplos arquivos</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  style={{ display: 'none' }}
                  disabled={!pdfjsLoaded}
                />
              </div>

              {statusMsg && (
                <div style={{ padding: '10px 12px', background: '#e0f2fe', color: '#0369a1', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                  🔄 {statusMsg}
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={uploading || !pdfjsLoaded}
                style={{
                  width: '100%', padding: 14, borderRadius: 10,
                  background: (uploading || !pdfjsLoaded) ? '#86efac' : 'linear-gradient(135deg,#22c55e,#16a34a)',
                  border: 'none', color: 'white', fontWeight: 700, fontSize: 15,
                  cursor: (uploading || !pdfjsLoaded) ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                {uploading ? (
                  <>
                    <span style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
                    Processando...
                  </>
                ) : '⬆️ Extrair e Importar Receitas'}
              </button>
            </div>

            {/* Resultados */}
            {results.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>📊 Resultados da Importação</h3>
                {results.map((r, i) => (
                  <div key={i} style={{
                    padding: '12px 14px', borderRadius: 10, marginBottom: 8,
                    background: r.success ? '#f0fdf4' : r.warning ? '#fffbeb' : '#fef2f2',
                    border: `1px solid ${r.success ? '#bbf7d0' : r.warning ? '#fde68a' : '#fecaca'}`
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: r.success ? '#16a34a' : r.warning ? '#92400e' : '#dc2626', marginBottom: 4 }}>
                      {r.success ? `✅ ${r.filename}` : r.warning ? `⚠️ Sem receitas` : `❌ Erro`}
                    </div>
                    {r.success && r.recipesFound !== undefined && (
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {r.recipesFound} receitas encontradas!
                      </div>
                    )}
                    {r.error && <div style={{ fontSize: 12, color: '#dc2626' }}>{r.error}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
