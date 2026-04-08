/* ============================================================
 * Taxonomia de Grupos — Compras Coletivas Vida Forte
 * --------------------------------------------------------------
 * Cada grupo é resolvido a partir do NOME do produto (palavras
 * chave). Isso é robusto a renomeações de categorias na planilha
 * mensal — basta o nome do produto continuar similar.
 *
 * A ordem importa: o primeiro grupo cuja regra casar vence.
 * Por isso colocamos primeiro os grupos mais específicos
 * (ex.: "isofort plant" antes de "whey").
 * ============================================================ */

const PRODUCT_GROUPS = [
  {
    id: "colageno",
    nome: "Colágenos",
    descricao: "Beleza, articulação e cabelo",
    icon: "sparkles",
    keywords: ["colagen", "hyaluronic"],
  },
  {
    id: "omega",
    nome: "Ômega 3",
    descricao: "EPA, DHA, krill e linha vegana",
    icon: "fish",
    keywords: ["omega", "ômega", "omegafor", "krill", "mega dha"],
  },
  {
    id: "creatina_amino",
    nome: "Creatina & Aminos",
    descricao: "Creatina, BCAA, glutamina, aminoácidos",
    icon: "bolt",
    keywords: [
      "creatin",
      "creafort",
      "bcaa",
      "aminovita",
      "amino",
      "glutam",
      "arginina",
      "arginofor",
      "beta alanina",
      "beta-alanina",
      "taurin",
      "carnitin",
    ],
  },
  {
    id: "pre_treino",
    nome: "Pré-treino & Energia",
    descricao: "Pré-treino, termogênicos, endurance",
    icon: "flame",
    keywords: [
      "pre treino",
      "pré treino",
      "pré-treino",
      "v-fort",
      "v fort",
      "v-coffee",
      "v coffee",
      "endurance",
      "termoplus",
      "termo plus",
      "lipix",
      "d-ribose",
      "ribose",
    ],
  },
  {
    id: "carbo",
    nome: "Carboidratos & MCT",
    descricao: "Energia rápida e sustentada",
    icon: "wheat",
    keywords: ["carbofor", "palatinose", "mct ", "maltodextrin", "carboidrato"],
  },
  {
    id: "snacks",
    nome: "Snacks & Doces",
    descricao: "Barrinhas, snacks e adoçantes",
    icon: "cookie",
    keywords: ["barrinh", "fitzei", "snack", "choco family", "xilitol"],
  },
  {
    id: "digestivos",
    nome: "Digestivos & Probióticos",
    descricao: "Probióticos, enzimas, fibras e colostro",
    icon: "leaf",
    keywords: [
      "simfort",
      "simcaps",
      "enzyfor",
      "enzima",
      "laczyme",
      "prebiótic",
      "prebiotic",
      "fiberfor",
      "espefor",
      "colosfort",
      "colostr",
      "lactoferrin",
      "hepatofor",
      "nac",
      "curcuma",
      "fosvita",
      "fos ",
    ],
  },
  {
    id: "vitaminas_minerais",
    nome: "Vitaminas & Minerais",
    descricao: "Vita D, C, B12, multivitamínicos e minerais",
    icon: "pill",
    keywords: [
      "vita d3",
      "vita c",
      "vitamina b12",
      "vitamina c",
      "multivitam",
      "imunomult",
      "ferro plus",
      "magnés",
      "magnes",
      "cálcio",
      "calcio plus",
      "coq",
      "co-q",
      "sustevit",
      "glp-1",
      "glp 1",
    ],
  },
  {
    id: "saude_feminina",
    nome: "Saúde & Bem-estar",
    descricao: "Sono, beleza, feminino, antioxidantes",
    icon: "heart",
    keywords: [
      "profem",
      "boraprim",
      "sleepfor",
      "melatonina",
      "resveratrol",
      "própolis",
      "propolis",
      "vitatea",
    ],
  },
  {
    id: "nutricao_clinica",
    nome: "Nutrição Clínica",
    descricao: "Suporte enteral e nutrição infantil",
    icon: "stethoscope",
    keywords: ["enteral", "nutrição infantil", "nutricao infantil"],
  },
  {
    id: "fitoterapicos",
    nome: "Fitoterápicos",
    descricao: "Linha chinesa e adaptógenos",
    icon: "sprout",
    keywords: [
      "acanthopanax",
      "bupleurum",
      "cinnamon",
      "cordyceps",
      "echinacea",
      "hypericum",
      "rehmannia",
      "rhodiola",
      "six flavor",
    ],
  },
  // Whey vai por último porque "isofort" e "linha integral/gourmet"
  // também são whey, mas precisam ser pegos pelas palavras genéricas.
  {
    id: "whey",
    nome: "Whey Protein",
    descricao: "Concentrado, isolado, vegetal e blends",
    icon: "dumbbell",
    keywords: [
      "whey",
      "isofort",
      "isocrisp",
      "isolate",
      "linha integral",
      "linha gourmet",
      "linha exclusiva air",
      "air com whey",
      "vegano - proteína",
      "vegano-proteína",
    ],
  },
];

function _norm(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Resolve o grupo de um produto pelo nome (e fallback para categoriaNome).
function getProductGroup(produto) {
  const haystack = _norm(produto.nome + " " + (produto.categoriaNome || ""));
  for (const g of PRODUCT_GROUPS) {
    for (const kw of g.keywords) {
      if (haystack.includes(_norm(kw))) return g.id;
    }
  }
  return "outros";
}

function getGroupsWithCounts(produtos) {
  const counts = {};
  produtos.forEach((p) => {
    const g = getProductGroup(p);
    counts[g] = (counts[g] || 0) + 1;
  });
  const ordered = PRODUCT_GROUPS.filter((g) => counts[g.id] > 0).map((g) => ({
    ...g,
    count: counts[g.id],
  }));
  if (counts["outros"]) {
    ordered.push({
      id: "outros",
      nome: "Outros",
      descricao: "Demais itens do catálogo",
      icon: "package",
      count: counts["outros"],
    });
  }
  // Ordenar por contagem decrescente para melhor UX
  return ordered.sort((a, b) => b.count - a.count);
}
