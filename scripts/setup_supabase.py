#!/usr/bin/env python3
"""
Setup Compras Coletivas - Supabase Schema
Cria schema isolado e popula produtos no banco Supabase do FitFlow
"""

import psycopg2
import json
from urllib.parse import urlparse

# Configuração do Supabase (do projeto FitFlow)
DATABASE_URL = "postgresql://postgres.vpmfuhvgnbqovclwaudz:*Glockblss213@aws-0-us-west-2.pooler.supabase.com:5432/postgres"

def connect_db():
    """Conecta ao Supabase"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        return conn
    except Exception as e:
        print(f"❌ Erro ao conectar: {e}")
        return None

def execute_schema(conn):
    """Cria schema compras_coletivas"""
    try:
        with open('/root/projects/compras-coletivas/sql/01_schema_supabase.sql', 'r') as f:
            sql = f.read()

        cur = conn.cursor()
        cur.execute(sql)
        cur.close()
        print("✅ Schema 'compras_coletivas' criado com sucesso!")
        return True
    except Exception as e:
        print(f"❌ Erro ao criar schema: {e}")
        return False

def load_produtos():
    """Carrega produtos do produtos.js"""
    # Ler arquivo produtos.js e extrair dados
    with open('/root/projects/compras-coletivas/produtos.js', 'r') as f:
        content = f.read()

    # Extrair array de produtos usando regex
    import re
    pattern = r'\{\s*codigo:\s*"([^"]+)",\s*nome:\s*"([^"]+)",\s*preco:\s*([\d.]+),\s*embalagem:\s*(\d+),\s*categoria:\s*"([^"]+)",\s*categoriaNome:\s*"([^"]+)",\s*imagem:\s*"([^"]+)"\s*\}'
    matches = re.findall(pattern, content)

    produtos = []
    categorias = set()

    for match in matches:
        codigo, nome, preco, embalagem, categoria, categoriaNome, imagem = match
        produtos.append({
            'codigo': codigo,
            'nome': nome,
            'preco': float(preco),
            'embalagem': int(embalagem),
            'categoria': categoria,
            'categoriaNome': categoriaNome,
            'imagem': imagem
        })
        categorias.add((categoria, categoriaNome))

    print(f"📦 {len(produtos)} produtos carregados")
    print(f"🏷️  {len(categorias)} categorias únicas")

    return produtos, list(categorias)

def populate_categorias(conn, categorias):
    """Popula tabela de categorias"""
    try:
        cur = conn.cursor()

        # Primeiro, limpar categorias existentes
        cur.execute("DELETE FROM compras_coletivas.categorias")

        # Inserir categorias
        for slug, nome in categorias:
            cur.execute("""
                INSERT INTO compras_coletivas.categorias (slug, nome)
                VALUES (%s, %s)
                ON CONFLICT (slug) DO NOTHING
            """, (slug, nome))

        cur.close()
        print(f"✅ {len(categorias)} categorias inseridas!")
        return True
    except Exception as e:
        print(f"❌ Erro ao inserir categorias: {e}")
        return False

def populate_produtos(conn, produtos):
    """Popula tabela de produtos"""
    try:
        cur = conn.cursor()

        # Buscar IDs das categorias
        cur.execute("SELECT id, slug FROM compras_coletivas.categorias")
        cat_map = {row[1]: row[0] for row in cur.fetchall()}

        # Limpar produtos existentes
        cur.execute("DELETE FROM compras_coletivas.produtos")

        # Inserir produtos
        count = 0
        for p in produtos:
            cat_id = cat_map.get(p['categoria'])
            cur.execute("""
                INSERT INTO compras_coletivas.produtos
                (codigo, nome, preco, embalagem, categoria_id, imagem)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (p['codigo'], p['nome'], p['preco'], p['embalagem'], cat_id, p['imagem']))
            count += 1

        conn.commit()
        cur.close()
        print(f"✅ {count} produtos inseridos!")
        return True
    except Exception as e:
        print(f"❌ Erro ao inserir produtos: {e}")
        return False

def main():
    print("🚀 Setup Compras Coletivas - Supabase\n")

    # Conectar ao banco
    conn = connect_db()
    if not conn:
        return

    # Executar schema
    if not execute_schema(conn):
        conn.close()
        return

    # Carregar produtos
    produtos, categorias = load_produtos()

    # Popula categorias
    if not populate_categorias(conn, categorias):
        conn.close()
        return

    # Popula produtos
    if not populate_produtos(conn, produtos):
        conn.close()
        return

    # Testar
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM compras_coletivas.produtos")
    count = cur.fetchone()[0]
    cur.close()

    print(f"\n✨ Setup finalizado!")
    print(f"📊 {count} produtos no banco")

    conn.close()

if __name__ == '__main__':
    import sys
    sys.path.append('/root/projects/compras-coletivas')
    main()
