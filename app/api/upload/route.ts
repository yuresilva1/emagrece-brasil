import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { parseRecipesFromText } from '@/lib/pdf-parser'

export const maxDuration = 60

// POST /api/upload — recebe o TEXTO extraído do PDF (evita limites de upload de arquivos grandes)
export async function POST(req: NextRequest) {
  try {
    // Verifica senha de admin
    const adminPassword = req.headers.get('x-admin-password')
    if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Senha incorreta. Verifique ADMIN_PASSWORD no .env.local' }, { status: 401 })
    }

    const { text, type, filename } = await req.json() as { text: string; type: string; filename: string }

    if (!text || !filename) {
      return NextResponse.json({ error: 'Conteúdo do texto ou nome do arquivo inválido' }, { status: 400 })
    }

    console.log(`📄 Processando texto de: ${filename} (${(text.length / 1024).toFixed(2)} KB) — tipo: ${type}`)

    const supabaseAdmin = createAdminClient()

    // 1. Registra o upload no banco
    const { data: uploadRecord } = await supabaseAdmin
      .from('pdf_uploads')
      .insert({
        filename,
        pdf_type: type,
        processed: false
      })
      .select()
      .single()

    // 2. Parseia receitas do texto
    const recipes = parseRecipesFromText(text, type as 'fit' | 'detox', filename)
    console.log(`🍽️ Receitas identificadas: ${recipes.length}`)

    // 3. Se não achou receitas, retorna aviso
    if (recipes.length === 0) {
      if (uploadRecord?.id) {
        await supabaseAdmin.from('pdf_uploads')
          .update({ error_msg: 'Nenhuma receita encontrada', processed: true, recipes_count: 0 })
          .eq('id', uploadRecord.id)
      }
      return NextResponse.json({
        warning: 'Nenhuma receita foi identificada automaticamente.',
        hint: 'O PDF precisa ter estrutura: Nome da Receita → Ingredientes → Modo de Preparo',
        recipesFound: 0,
        textPreview: text.substring(0, 300)
      })
    }

    // 4. Salva as receitas no banco em lotes de 50
    const BATCH = 50
    let saved = 0
    for (let i = 0; i < recipes.length; i += BATCH) {
      const batch = recipes.slice(i, i + BATCH)
      const { error: insertErr } = await supabaseAdmin.from('recipes').insert(batch)
      if (insertErr) {
        console.error('Erro ao salvar lote:', insertErr)
        return NextResponse.json({
          error: `Erro ao salvar no banco: ${insertErr.message}`,
          savedSoFar: saved,
        }, { status: 500 })
      }
      saved += batch.length
    }

    // 5. Atualiza registro do PDF
    if (uploadRecord?.id) {
      await supabaseAdmin.from('pdf_uploads')
        .update({ processed: true, recipes_count: recipes.length })
        .eq('id', uploadRecord.id)
    }

    const categories = recipes.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      success: true,
      filename,
      recipesFound: recipes.length,
      categories,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/upload error:', msg)
    return NextResponse.json({ error: `Erro interno: ${msg}` }, { status: 500 })
  }
}
