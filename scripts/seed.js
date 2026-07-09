// ============================================================
// SEED SCRIPT — Popula o Supabase com Receitas Fit e Detox
// ============================================================
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Chaves do Supabase não encontradas no .env.local!');
  process.exit(1);
}

const ws = require('ws');
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws }
});

const recipes = [
  // ── CAFÉ DA MANHÃ (breakfast) ──────────────────────────────
  {
    name: "Crepioca de Frango com Queijo Cottage",
    category: "breakfast",
    calories: 270, protein: 24, carbs: 18, fat: 8,
    ingredients: ["1 ovo inteiro", "2 colheres de sopa de goma de tapioca", "2 colheres de sopa de frango desfiado temperado", "1 colher de sopa de queijo cottage", "Orégano e sal a gosto"],
    prep: "Bata o ovo com a goma de tapioca e uma pitada de sal. Despeje em uma frigideira antiaderente quente. Quando firmar, vire, adicione o recheio de frango e cottage, dobre ao meio e abafe por 1 minuto.",
    emoji: "☀️"
  },
  {
    name: "Panqueca de Banana Fit com Canela",
    category: "breakfast",
    calories: 250, protein: 12, carbs: 32, fat: 6,
    ingredients: ["1 banana média amassada", "1 ovo inteiro + 1 clara", "2 colheres de sopa de farelo de aveia", "1 colher de café de canela em pó", "Mel para finalizar (opcional)"],
    prep: "Misture a banana amassada, os ovos e o farelo de aveia até homogeneizar. Despeje pequenas porções em uma frigideira antiaderente untada com gotas de óleo de coco. Doure dos dois lados e salpique canela.",
    emoji: "☀️"
  },
  {
    name: "Ovos Mexidos Cremosos com Espinafre",
    category: "breakfast",
    calories: 220, protein: 18, carbs: 4, fat: 14,
    ingredients: ["3 ovos inteiros", "1 xícara de folhas de espinafre fresco", "1 colher de sopa de creme de ricota light", "1 dente de alho picado", "1 colher de chá de azeite de oliva"],
    prep: "Refogue o alho e o espinafre no azeite até murchar. Bata os ovos com o creme de ricota e adicione à frigideira. Mexa em fogo baixo até atingir a consistência cremosa.",
    emoji: "☀️"
  },
  {
    name: "Mingau Protetor de Aveia e Whey de Baunilha",
    category: "breakfast",
    calories: 290, protein: 25, carbs: 30, fat: 5,
    ingredients: ["4 colheres de sopa de aveia em flocos", "200ml de leite de amêndoas sem açúcar", "1 scoop (30g) de whey protein de baunilha", "1 colher de chá de sementes de chia"],
    prep: "Cozinhe a aveia no leite de amêndoas em fogo baixo até engrossar. Desligue o fogo, adicione o whey protein e a chia, mexendo vigorosamente para não empedrar. Sirva quente.",
    emoji: "☀️"
  },
  {
    name: "Waffle de Batata-Doce Fit",
    category: "breakfast",
    calories: 260, protein: 10, carbs: 38, fat: 6,
    ingredients: ["100g de batata-doce cozida e amassada", "1 ovo", "1 colher de sopa de polvilho doce", "1 colher de sopa de água", "Sal a gosto"],
    prep: "Misture todos os ingredientes até formar uma massa homogênea. Coloque na máquina de waffle untada e asse até dourar por fora.",
    emoji: "☀️"
  },

  // ── LANCHE DA MANHÃ (morningSnack) ─────────────────────────
  {
    name: "Mix de Castanhas com Damasco",
    category: "morningSnack",
    calories: 160, protein: 4, carbs: 12, fat: 11,
    ingredients: ["5 amêndoas cruas", "3 castanhas-do-pará", "2 nozes", "2 damascos secos picados"],
    prep: "Misture todos os ingredientes em um pote. Excelente opção prática para levar no trabalho.",
    emoji: "🍎"
  },
  {
    name: "Iogurte Natural com Kiwi e Sementes de Abóbora",
    category: "morningSnack",
    calories: 140, protein: 9, carbs: 15, fat: 4,
    ingredients: ["1 pote (170g) de iogurte desnatado natural", "1 kiwi fatiado", "1 colher de sopa de sementes de abóbora tostadas sem sal"],
    prep: "Adicione o kiwi fatiado e as sementes de abóbora sobre o iogurte. Consuma em seguida.",
    emoji: "🍎"
  },
  {
    name: "Espetinho de Tomate Cereja com Queijo Minas",
    category: "morningSnack",
    calories: 120, protein: 8, carbs: 3, fat: 7,
    ingredients: ["8 tomates cereja", "8 cubos pequenos de queijo minas frescal light", "Folhas de manjericão fresco", "1 colher de chá de azeite e orégano"],
    prep: "Monte os espetinhos alternando tomate, queijo e manjericão. Tempere com gotas de azeite e orégano.",
    emoji: "🍎"
  },
  {
    name: "Muffin de Omelete com Legumes",
    category: "morningSnack",
    calories: 150, protein: 12, carbs: 4, fat: 9,
    ingredients: ["2 ovos batidos", "2 colheres de sopa de brócolis picado", "1 colher de sopa de cenoura ralada", "Sal e pimenta a gosto"],
    prep: "Misture os ovos batidos com os legumes e temperos. Distribua em forminhas de silicone e asse no forno a 180°C por 15 minutos.",
    emoji: "🍎"
  },

  // ── ALMOÇO (lunch) ──────────────────────────────────────────
  {
    name: "Frango Grelhado com Arroz Integral e Brócolis",
    category: "lunch",
    calories: 410, protein: 38, carbs: 36, fat: 8,
    ingredients: ["150g de peito de frango limpo em bifes", "3 colheres de sopa de arroz integral cozido", "1 xícara de brócolis cozido no vapor", "1 colher de chá de azeite", "Limão, alho e sal"],
    prep: "Tempere o frango com alho, sal e limão. Grelhe no azeite até dourar bem. Sirva acompanhado do arroz integral e do brócolis cozido.",
    emoji: "🍽️"
  },
  {
    name: "Tilápia Assada com Purê de Mandioquinha",
    category: "lunch",
    calories: 390, protein: 34, carbs: 38, fat: 7,
    ingredients: ["150g de filé de tilápia", "120g de mandioquinha cozida", "1 colher de sopa de leite desnatado", "Sal, pimenta do reino e ervas finas"],
    prep: "Asse o peixe temperado com limão e ervas finas no forno por 15 minutos. Amasse a mandioquinha com o leite e uma pitada de sal para fazer o purê.",
    emoji: "🍽️"
  },
  {
    name: "Patinho Moído com Espaguete de Abobrinha",
    category: "lunch",
    calories: 360, protein: 35, carbs: 14, fat: 12,
    ingredients: ["150g de patinho moído cozido com molho de tomate caseiro", "1 abobrinha grande cortada em tiras finas (tipo espaguete)", "1 colher de chá de azeite de oliva", "Alho e sal a gosto"],
    prep: "Refogue a abobrinha rapidamente no azeite e alho por 2 minutos (para ficar al dente). Cubra com o patinho moído ao molho quente e sirva.",
    emoji: "🍽️"
  },
  {
    name: "Salmão Grelhado com Salada de Quinoa",
    category: "lunch",
    calories: 450, protein: 32, carbs: 30, fat: 16,
    ingredients: ["120g de lombo de salmão", "4 colheres de sopa de quinoa cozida", "Tomate cereja, pepino e cebola roxa picados", "Limão e azeite"],
    prep: "Grelhe o salmão na frigideira bem quente (deixe a pele crocante). Misture a quinoa com os vegetais picados, tempere com limão e azeite, e sirva junto.",
    emoji: "🍽️"
  },
  {
    name: "Picadinho de Carne com Legumes Assados",
    category: "lunch",
    calories: 420, protein: 36, carbs: 22, fat: 14,
    ingredients: ["150g de alcatra em cubos", "1/2 cenoura fatiada", "1/2 abobrinha em cubos", "Azeite de oliva, alho, cebola, sal e páprica"],
    prep: "Refogue a carne com alho e cebola até dourar. Asse os legumes temperados com azeite, sal e páprica a 200°C por 20 minutos e misture.",
    emoji: "🍽️"
  },

  // ── LANCHE DA TARDE & DOCES FIT (afternoonSnack) ─────────────
  {
    name: "Brigadeiro Fit de Colher (Doce Fit)",
    category: "afternoonSnack",
    calories: 160, protein: 8, carbs: 18, fat: 4,
    ingredients: ["1 banana madura", "2 colheres de sopa de leite em pó desnatado", "1 colher de sobremesa de cacau em pó 100%", "Cacau em pó para polvilhar"],
    prep: "Amasse a banana e leve ao micro-ondas por 1 minuto. Misture o leite em pó e o cacau vigorosamente até ficar brilhoso e homogêneo. Deixe esfriar na geladeira e sirva com cacau por cima.",
    emoji: "🥤"
  },
  {
    name: "Mousse de Cacau Cremoso com Abacate (Doce Fit)",
    category: "afternoonSnack",
    calories: 190, protein: 4, carbs: 12, fat: 13,
    ingredients: ["1/2 abacate maduro pequeno", "2 colheres de sobremesa de cacau em pó 70%", "1 colher de sopa de mel ou adoçante natural", "Gotas de essência de baunilha"],
    prep: "Bata todos os ingredientes no liquidificador ou mixer até virar um creme liso e brilhante. Deixe gelar por pelo menos 30 minutos.",
    emoji: "🥤"
  },
  {
    name: "Bolinho de Caneca Fit de Coco e Chocolate",
    category: "afternoonSnack",
    calories: 180, protein: 10, carbs: 14, fat: 8,
    ingredients: ["1 ovo", "1 colher de sopa de farinha de coco", "1 colher de sopa de cacau em pó", "1 colher de chá de fermento em pó", "Adoçante a gosto"],
    prep: "Misture tudo em uma caneca de porcelana. Leve ao micro-ondas em potência alta por 1 minuto e 30 segundos. Espere esfriar um pouco e sirva.",
    emoji: "🥤"
  },
  {
    name: "Shake Proteico de Morango e Chia",
    category: "afternoonSnack",
    calories: 195, protein: 22, carbs: 15, fat: 4,
    ingredients: ["200ml de leite de coco light", "1 xícara de morangos congelados", "1 scoop (30g) de whey de morango ou baunilha", "1 colher de sobremesa de chia"],
    prep: "Bata todos os ingredientes no liquidificador com gelo até virar um shake consistente. Consuma imediatamente.",
    emoji: "🥤"
  },

  // ── JANTAR (dinner) ─────────────────────────────────────────
  {
    name: "Sopa Cremosa de Abóbora com Frango",
    category: "dinner",
    calories: 260, protein: 28, carbs: 22, fat: 5,
    ingredients: ["200g de abóbora cabotiá cozida", "100g de peito de frango desfiado", "1 dente de alho e cebola picada", "Cheiro verde e gengibre ralado a gosto"],
    prep: "Bata a abóbora cozida no liquidificador com a própria água do cozimento e o gengibre. Refogue o alho e cebola, adicione o frango desfiado e o creme de abóbora. Deixe ferver por 5 minutos.",
    emoji: "🌙"
  },
  {
    name: "Omelete de Forno com Legumes e Atum",
    category: "dinner",
    calories: 290, protein: 26, carbs: 6, fat: 16,
    ingredients: ["3 ovos", "1/2 lata de atum em água", "Tomate picado, cebola e salsinha", "1 colher de sopa de queijo parmesão ralado (para gratinar)"],
    prep: "Bata os ovos, adicione o atum e os vegetais picados. Coloque em um refratário pequeno, salpique parmesão e asse no forno a 200°C por 18 minutos.",
    emoji: "🌙"
  },
  {
    name: "Filé de Peixe ao Molho de Ervas com Salada Verde",
    category: "dinner",
    calories: 240, protein: 32, carbs: 4, fat: 10,
    ingredients: ["150g de filé de pescada ou tilápia", "1 colher de chá de azeite", "Sal, limão, alecrim, salsinha e manjericão", "Mix de folhas verdes à vontade"],
    prep: "Grelhe o peixe temperado com limão e sal no azeite. Pique bem as ervas frescas, misture com gotas de azeite e jogue por cima do peixe. Sirva com a salada verde.",
    emoji: "🌙"
  },
  {
    name: "Frango Xadrez Fit com Pimentões e Tofu",
    category: "dinner",
    calories: 280, protein: 34, carbs: 12, fat: 8,
    ingredients: ["150g de peito de frango em cubos", "50g de tofu firme em cubos", "Pimentão vermelho e amarelo picados", "2 colheres de sopa de molho shoyu de coco (ou shoyu light)"],
    prep: "Grelhe o frango com alho. Adicione os pimentões e refogue até ficarem macios. Coloque o tofu e o shoyu, misture bem e deixe apurar por 3 minutos.",
    emoji: "🌙"
  },

  // ── SUCOS DETOX (detoxJuice) ────────────────────────────────
  {
    name: "Suco Verde Seca Barriga Clássico",
    category: "detoxJuice",
    calories: 75, protein: 2, carbs: 16, fat: 0,
    ingredients: ["1 folha de couve manteiga (sem o talo)", "Suco de 1 limão espremido", "1 rodela pequena de gengibre", "1/2 pepino japonês", "200ml de água filtrada bem gelada"],
    prep: "Bata todos os ingredientes no liquidificador. Beba imediatamente sem coar para aproveitar todas as fibras.",
    emoji: "🥬",
    benefits: "Desintoxicante, acelera o metabolismo e auxilia na redução do inchaço abdominal."
  },
  {
    name: "Suco de Abacaxi com Hortelã e Cúrcuma",
    category: "detoxJuice",
    calories: 85, protein: 1, carbs: 20, fat: 0,
    ingredients: ["2 rodelas de abacaxi maduro", "6 folhas de hortelã fresca", "1 colher de café de cúrcuma em pó (açafrão)", "150ml de água de coco gelada"],
    prep: "Bata tudo no liquidificador até ficar bem homogêneo. Sirva com pedras de gelo.",
    emoji: "🥬",
    benefits: "Excelente diurético natural, anti-inflamatório potente e ajuda na digestão."
  },
  {
    name: "Shot Termogênico de Limão e Gengibre",
    category: "detoxJuice",
    calories: 30, protein: 0, carbs: 7, fat: 0,
    ingredients: ["Suco de 1 limão", "1 colher de café de gengibre em pó", "1/2 colher de café de pimenta caiena", "1 colher de sopa de água morna"],
    prep: "Misture tudo em um copo pequeno e consuma logo pela manhã em jejum de uma vez só.",
    emoji: "🥬",
    benefits: "Fortalece o sistema imunológico e ativa a queima de gordura logo no início do dia."
  },
  {
    name: "Suco Vermelho Antioxidante de Beterraba",
    category: "detoxJuice",
    calories: 90, protein: 2, carbs: 20, fat: 0,
    ingredients: ["1/2 beterraba pequena crua", "1/2 cenoura média", "Suco de 1 laranja espremida", "150ml de água gelada"],
    prep: "Bata a beterraba, cenoura e água no liquidificador. Coe se preferir (ou consuma com a polpa para mais fibras) e adicione o suco de laranja.",
    emoji: "🥬",
    benefits: "Melhora a oxigenação muscular, rico em ferro e combate o envelhecimento celular."
  }
];

async function seed() {
  console.log('🌱 Iniciando limpeza e semente de receitas no Supabase...');

  try {
    // 1. Limpa receitas antigas
    const { error: deleteError } = await supabase
      .from('recipes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Deleta todas as linhas

    if (deleteError) {
      throw new Error(`Falha ao limpar banco: ${deleteError.message}`);
    }
    console.log('🧹 Banco de dados limpo com sucesso.');

    // 2. Insere a nova lista rica de receitas
    const { data, error: insertError } = await supabase
      .from('recipes')
      .insert(recipes)
      .select();

    if (insertError) {
      throw new Error(`Erro ao inserir receitas: ${insertError.message}`);
    }

    console.log(`✅ Semente concluída! ${data.length} receitas inseridas com sucesso.`);
    process.exit(0);

  } catch (err) {
    console.error('❌ Ocorreu um erro no seed:', err.message);
    process.exit(1);
  }
}

seed();
