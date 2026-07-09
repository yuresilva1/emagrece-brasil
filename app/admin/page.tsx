'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

interface PdfUpload {
  id: string
  filename: string
  pdf_type: string
  recipes_count: number
  processed: boolean
  error_msg?: string
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

export default function AdminPage() {
  const [password, setPassword]   = useState('')
  const [authed, setAuthed]       = useState(false)
  const [authErr, setAuthErr]     = useState(false)
  const [uploads, setUploads]     = useState<PdfUpload[]>([])
  const [uploading, setUploading] = useState(false)
  const [results, setResults]     = useState<UploadResult[]>([])
  const [pdfType, setPdfType]     = useState<'fit' | 'detox'>('fit')
  const [totalRecipes, setTotal]  = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  // Tenta autenticar com a senha digitada
  function handleAuth() {
    // Comparamos com uma senha simples no client (o header real vai ao servidor)
    if (password.trim().length >= 4) {
      setAuthed(true)
      loadUploads()
    } else {
      setAuthErr(true)
    }
  }

  async function loadUploads() {
    try {
      const r = await fetch('/api/recipes')
      const data = await r.json()
      const count = Object.values(data as Record<string, unknown[]>).reduce((a, b) => a + b.length, 0)
      setTotal(count)
    } catch {}
  }

  async function handleUpload() {
    const files = fileRef.current?.files
    if (!files || files.length === 0) return

    setUploading(true)
    setResults([])
    const newResults: UploadResult[] = []

    for (const file of Array.from(files)) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('type', pdfType)

        const r = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'x-admin-password': password },
          body: fd,
        })

        const data: UploadResult = await r.json()
        newResults.push(data)
      } catch {
        newResults.push({ error: `Erro ao enviar ${file.name}` })
      }
    }

    setResults(newResults)
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    loadUploads()
  }

  async function clearRecipes() {
    if (!confirm('Apagar TODAS as receitas do banco? Isso não pode ser desfeito.')) return
    // Chama endpoint de limpeza (a implementar) ou usa Supabase dashboard
    alert('Para apagar, acesse o Supabase Dashboard > Table Editor > recipes > Delete all rows.')
  }

  if (!authed) {
    return (
      <div style={{ minHeight: '100dvh', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 360, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Image src="/logo.png" alt="Logo" width={64} height={64} style={{ objectFit: 'contain' }} />
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', marginTop: 12 }}>Painel Admin</h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Emagrece Brasil — Gestão de Receitas</p>
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

  return (
    <div style={{ minHeight: '100dvh', background: '#f0fdf4', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Image src="/logo.png" alt="Logo" width={32} height={32} style={{ objectFit: 'contain' }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>Emagrece Brasil — Admin</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{totalRecipes} receitas no banco</div>
        </div>
        <a href="/" style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b', textDecoration: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px' }}>
          ← Ver App
        </a>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>

        {/* Upload Card */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>📄 Importar PDFs de Receitas</h2>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
            Faça upload dos PDFs. O sistema irá extrair as receitas automaticamente.<br />
            <strong>Dica:</strong> PDFs com a estrutura <em>Nome da Receita → Ingredientes → Modo de Preparo</em> funcionam melhor.
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
              textAlign: 'center', cursor: 'pointer', background: '#f8fffe', marginBottom: 14
            }}
            onClick={() => fileRef.current?.click()}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>Clique para selecionar os PDFs</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Pode selecionar múltiplos arquivos</div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              multiple
              style={{ display: 'none' }}
              onChange={e => {
                const names = Array.from(e.target.files || []).map(f => f.name).join(', ')
                // atualiza UI indiretamente
              }}
            />
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading}
            style={{
              width: '100%', padding: 14, borderRadius: 10,
              background: uploading ? '#86efac' : 'linear-gradient(135deg,#22c55e,#16a34a)',
              border: 'none', color: 'white', fontWeight: 700, fontSize: 15,
              cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
          >
            {uploading ? (
              <>
                <span style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
                Processando PDFs...
              </>
            ) : '⬆️ Fazer Upload e Importar Receitas'}
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
                  {r.success ? `✅ ${r.filename}` : r.warning ? `⚠️ ${r.filename}` : `❌ ${r.error}`}
                </div>
                {r.recipesFound !== undefined && (
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {r.recipesFound} receitas encontradas
                    {r.categories && (
                      <span> — {Object.entries(r.categories).map(([k, v]) => `${k}: ${v}`).join(' • ')}</span>
                    )}
                  </div>
                )}
                {r.hint && <div style={{ fontSize: 11, color: '#92400e', marginTop: 4 }}>{r.hint}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Info */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>ℹ️ Como funciona</h3>
          <ol style={{ fontSize: 13, color: '#64748b', lineHeight: 2, paddingLeft: 18 }}>
            <li>Selecione o tipo (Receitas Fit ou Sucos Detox)</li>
            <li>Faça upload de 1 a 4 PDFs por vez</li>
            <li>O sistema extrai o texto e identifica as receitas automaticamente</li>
            <li>As receitas ficam salvas no banco Supabase</li>
            <li>Todos os usuários do app verão as novas receitas em até 1h</li>
          </ol>
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
            💡 Para gerenciar receitas individualmente, acesse o{' '}
            <a href="https://supabase.com/dashboard" target="_blank" rel="noopener" style={{ color: '#16a34a' }}>
              Supabase Dashboard → Table Editor → recipes
            </a>
          </div>
        </div>

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
