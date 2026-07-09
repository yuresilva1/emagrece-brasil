'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

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
  const [password, setPassword]       = useState('')
  const [authed, setAuthed]           = useState(false)
  const [authErr, setAuthErr]         = useState(false)
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
      script.onerror = () => {
        console.error('Erro ao carregar PDF.js')
      }
      document.head.appendChild(script)
    } else {
      setPdfjsLoaded(true)
    }
  }, [])

  // Tenta autenticar com a senha digitada
  function handleAuth() {
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

  // Função para extrair texto do PDF no navegador (evita limites de upload de arquivos grandes)
  async function extractTextFromPdf(file: File, onProgress: (msg: string) => void): Promise<string> {
    const pdfjsLib = (window as any)['pdfjs-dist/build/pdf']
    if (!pdfjsLib) {
      throw new Error('Biblioteca PDF.js não carregada. Tente recarregar a página.')
    }

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

  async function handleUpload() {
    const files = fileRef.current?.files
    if (!files || files.length === 0) return

    setUploading(true)
    setResults([])
    const newResults: UploadResult[] = []

    for (const file of Array.from(files)) {
      try {
        setStatusMsg(`Lendo: ${file.name}...`)
        
        // 1. Extrai o texto do PDF localmente
        const text = await extractTextFromPdf(file, (msg) => {
          setStatusMsg(`[${file.name}] ${msg}`)
        })

        setStatusMsg(`Enviando dados para o servidor...`)

        // 2. Envia o texto extraído por JSON
        const r = await fetch('/api/upload', {
          method: 'POST',
          headers: { 
            'x-admin-password': password,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text,
            type: pdfType,
            filename: file.name
          }),
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
                  {r.success ? `✅ ${r.filename}` : r.warning ? `⚠️ Sem receitas identificadas` : `❌ Erro`}
                </div>
                {r.success && r.recipesFound !== undefined && (
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {r.recipesFound} receitas encontradas e inseridas no banco!
                    {r.categories && (
                      <div style={{ marginTop: 4, fontStyle: 'italic' }}>
                        {Object.entries(r.categories).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                      </div>
                    )}
                  </div>
                )}
                {r.warning && <div style={{ fontSize: 12, color: '#64748b' }}>{r.warning}. {r.hint}</div>}
                {r.error && <div style={{ fontSize: 12, color: '#dc2626' }}>{r.error}</div>}
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
        </div>

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
