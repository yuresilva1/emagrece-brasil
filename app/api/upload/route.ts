import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { parseRecipesFromText } from '@/lib/pdf-parser'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>

// POST /api/upload — recebe PDF, parseia e salva receitas no banco
export async function POST(req: NextRequest) {
  try {
    // Verifica senha de admin
    const adminPassword = req.headers.get('x-admin-password')
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const pdfType = (formData.get('type') as string) || 'fit'

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // 1. Faz upload do PDF para o Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const storagePath = `pdfs/${Date.now()}-${file.name}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('recipe-pdfs')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      // Continua mesmo se o storage falhar — o parsing ainda funciona
    }

    // 2. Registra o upload no banco
    const { data: uploadRecord, error: dbError } = await supabaseAdmin
      .from('pdf_uploads')
      .insert({
        filename: file.name,
        pdf_type: pdfType,
        storage_path: storagePath,
        processed: false,
      })
      .select()
      .single()

    if (dbError) console.error('DB insert error:', dbError)

    // 3. Extrai texto do PDF
    let extractedText = ''
    try {
      const pdfData = await pdfParse(fileBuffer)
      extractedText = pdfData.text
    } catch (parseErr) {
      console.error('PDF parse error:', parseErr)
      return NextResponse.json({
        error: 'Não foi possível ler o PDF. Verifique se não está protegido por senha.'
      }, { status: 422 })
    }

    // 4. Parseia receitas do texto
    const recipes = parseRecipesFromText(extractedText, pdfType as 'fit' | 'detox', file.name)

    if (recipes.length === 0) {
      // Atualiza registro com erro
      if (uploadRecord?.id) {
        await supabaseAdmin.from('pdf_uploads').update({
          error_msg: 'Nenhuma receita encontrada no PDF',
          processed: true,
          recipes_count: 0,
        }).eq('id', uploadRecord.id)
      }

      return NextResponse.json({
        warning: 'Nenhuma receita foi identificada automaticamente no PDF.',
        hint: 'Certifique-se que o PDF tem estrutura: Título da Receita → Ingredientes → Modo de Preparo',
        recipesFound: 0,
      })
    }

    // 5. Salva receitas no banco
    const { error: recipeError } = await supabaseAdmin
      .from('recipes')
      .insert(recipes)

    if (recipeError) {
      console.error('Recipe insert error:', recipeError)
      return NextResponse.json({ error: 'Erro ao salvar receitas no banco' }, { status: 500 })
    }

    // 6. Atualiza o registro do PDF
    if (uploadRecord?.id) {
      await supabaseAdmin.from('pdf_uploads').update({
        processed: true,
        recipes_count: recipes.length,
      }).eq('id', uploadRecord.id)
    }

    return NextResponse.json({
      success: true,
      filename: file.name,
      recipesFound: recipes.length,
      categories: recipes.reduce((acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    })

  } catch (err) {
    console.error('POST /api/upload error:', err)
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
  }
}
