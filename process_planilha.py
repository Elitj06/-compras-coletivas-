#!/usr/bin/env python3
"""
Processar planilha Vitafor e extrair dados estruturados
"""
import pandas as pd
import json
import re

def limpar_colunas(row):
    """Limpar colunas 'Unnamed' e mapear para campos úteis"""
    result = {}

    # Detectar tipo de linha pela estrutura
    vals = [str(v) if pd.notna(v) else "" for v in row.values]

    # Linha de produto: tem código na 1ª coluna não-vazia
    codigo_col = None
    for i, v in enumerate(vals):
        if v and not v.startswith('Unnamed') and v.strip() and not v.lower() in ['nan', '']:
            if re.match(r'^[A-Z]{2,}\d+', v):  # Código estilo AM240LI
                codigo_col = i
                break

    if codigo_col is None:
        return None  # Não é linha de produto

    result['codigo'] = vals[codigo_col].strip()

    # Produto está na coluna seguinte
    if codigo_col + 1 < len(vals):
        result['produto'] = vals[codigo_col + 1].strip()

    # Quantidade/caixa
    if codigo_col + 2 < len(vals):
        result['qtd_caixa'] = vals[codigo_col + 2].strip()

    # Preço bruto
    if codigo_col + 3 < len(vals):
        result['preco_bruto'] = vals[codigo_col + 3].strip()

    # NCM (geralmente na última coluna)
    for v in reversed(vals):
        if v and 'NCM' in v:
            result['ncm'] = v.replace('NCM', '').strip()
            break

    return result if any(result.values()) else None


def processar_aba_vita(df):
    """Processar aba VITA"""
    produtos = []

    # Encontrar linha de cabeçalho
    header_row = None
    for i, row in df.iterrows():
        vals = [str(v) for v in row.values]
        if any('CÓDIGO' in v for v in vals):
            header_row = i
            break

    if header_row is None:
        print("❌ Cabeçalho não encontrado")
        return []

    # Processar linhas de produtos
    # Padrão: col 3 = código, col 5 = produto, col 7 = quantidade, col 8 = preço bruto
    for i in range(header_row + 1, len(df)):
        row = df.iloc[i]
        vals = [str(v) if pd.notna(v) else "" for v in row.values]

        # Verificar se é linha de produto (tem código na col 3)
        codigo = vals[3].strip() if len(vals) > 3 else ""
        if not codigo or not re.match(r'^[A-Z]{2,}\d+', codigo):
            continue

        produto = vals[5].strip() if len(vals) > 5 else ""
        qtd_caixa = vals[7].strip() if len(vals) > 7 else ""
        preco_bruto = vals[8].strip() if len(vals) > 8 else ""

        if codigo and produto:
            produtos.append({
                'linha': i,
                'codigo': codigo,
                'produto': produto,
                'qtd_caixa': qtd_caixa,
                'preco_bruto': preco_bruto
            })

    return produtos


def processar_aba_vitapower(df):
    """Processar aba VITAPOWER"""
    produtos = []

    # Encontrar linha de cabeçalho
    header_row = None
    for i, row in df.iterrows():
        vals = [str(v) for v in row.values]
        if any('SKU' in v for v in vals):
            header_row = i
            break

    if header_row is None:
        print("❌ Cabeçalho não encontrado")
        return []

    # Processar linhas
    cols = df.columns.tolist()
    print(f"Colunas VITAPOWER: {cols[:10]}")

    for i in range(header_row + 1, len(df)):
        row = df.iloc[i]
        vals = [str(v) if pd.notna(v) else "" for v in row.values]

        # Pular linhas vazias
        if all(not v.strip() for v in vals):
            continue

        # Linha de produto: tem código na coluna SKU (geralmente col 3)
        codigo = vals[3].strip() if len(vals) > 3 and vals[3].strip() and not vals[3].startswith('Unnamed') else None
        if not codigo or not re.match(r'^[A-Z]{2,}\d+', codigo):
            continue

        produtos.append({
            'linha': i,
            'codigo': codigo,
            'produto': vals[4].strip() if len(vals) > 4 else "",
            'preco_caixa': vals[6].strip() if len(vals) > 6 else "",
            'preco_unit': vals[7].strip() if len(vals) > 7 else ""
        })

    return produtos


def main():
    file_path = "/root/projects/compras-coletivas/data/TABELA_DE_PEDIDO_VITAFOR_2026_14.xlsx"

    xl = pd.ExcelFile(file_path)

    print(f"=== Processando planilha: {file_path}")
    print(f"Abas: {xl.sheet_names}")
    print()

    # Processar aba VITA
    print("=== ABA VITA ===")
    df_vita = pd.read_excel(file_path, sheet_name="TABELA DE PEDIDO VITAFOR", header=None)
    produtos_vita = processar_aba_vita(df_vita)
    print(f"✅ {len(produtos_vita)} produtos encontrados")

    # Mostrar primeiros 10
    for p in produtos_vita[:10]:
        print(f"  {p['codigo']}: {p['produto']}")

    # Processar aba VITAPOWER
    print("\n=== ABA VITAPOWER ===")
    df_vitapower = pd.read_excel(file_path, sheet_name="TABELA PEDIDO VITAPOWER", header=None)
    produtos_vitapower = processar_aba_vitapower(df_vitapower)
    print(f"✅ {len(produtos_vitapower)} produtos encontrados")

    # Mostrar primeiros 10
    for p in produtos_vitapower[:10]:
        print(f"  {p['codigo']}: {p['produto']}")

    # Salvar JSON
    output = {
        'vita': produtos_vita,
        'vitapower': produtos_vitapower,
        'total': len(produtos_vita) + len(produtos_vitapower)
    }

    output_file = "/root/projects/compras-coletivas/data/produtos.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n✅ JSON salvo: {output_file}")
    print(f"📊 Total de produtos: {output['total']}")


if __name__ == "__main__":
    main()
