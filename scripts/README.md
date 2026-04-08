# Atualizações mensais — Catálogo Vida Forte

Toda planilha nova que a Vitafor enviar pode ser aplicada ao app
com **um único comando**. O script `atualizar_catalogo.py` lê a
planilha (formato padrão Vitafor com abas `TABELA DE PEDIDO VITAFOR`
e `TABELA PEDIDO VITAPOWER`), extrai os produtos, atualiza preços,
embalagens e imagens embutidas, e regenera `public/produtos.js`.

## Como usar

```bash
# 1. Salvar a planilha recebida em data/
cp ~/Downloads/TABELA_VITAFOR_MAIO_2026.xlsx data/

# 2. Rodar o atualizador
python3 scripts/atualizar_catalogo.py data/TABELA_VITAFOR_MAIO_2026.xlsx

# 3. Conferir o resultado
git diff public/produtos.js | head

# 4. Commit + push (Vercel faz deploy automaticamente)
git add public/produtos.js data/TABELA_VITAFOR_MAIO_2026.xlsx
git commit -m "chore: atualiza catálogo para maio/2026"
git push
```

## O que o script faz

1. **Lê** as duas abas da planilha e extrai cada linha de produto
   (código, nome, embalagem, preço, categoria).
2. **Extrai** todas as imagens embutidas e ancora cada uma à linha
   do produto correspondente — imagens pequenas (selos de
   "lançamento") são ignoradas automaticamente.
3. **Mescla** com o `produtos.js` antigo: se um produto continua
   no catálogo mas a planilha nova não trouxer foto, mantém a foto
   antiga. Produtos descontinuados saem do catálogo.
4. **Regrava** `public/produtos.js` no formato consumido pelo
   frontend (mesma assinatura `const PRODUTOS = [...]`).

## Por que não preciso mexer em mais nada

- **Categorias**: o frontend agrupa produtos por **palavras-chave
  do nome** (`public/groups.js`), não pelo slug da categoria. Se
  a Vitafor renomear "WHEY FORT" para "WHEY FORT PREMIUM", o
  produto continua caindo em "Whey Protein" automaticamente.
- **Preços**: lidos diretamente do Excel — sem hardcode.
- **Faixas progressivas de desconto**: vivem no banco
  (`faixas_desconto`), não no código.
- **Cadastro de comprador, carrinho, fatura**: independem do catálogo.

## Checklist quando entrar produto totalmente novo

Se um produto novo não cair em nenhum grupo conhecido, ele aparece
em **"Outros"** no app. Para incluí-lo num grupo existente:

1. Abra `public/groups.js`
2. Procure o grupo correto (`whey`, `colageno`, etc.)
3. Adicione uma palavra-chave do nome do produto ao array
   `keywords` daquele grupo
4. Commit e push

Para criar um grupo totalmente novo, copie um bloco existente em
`PRODUCT_GROUPS` e ajuste id, nome, ícone e keywords. Os ícones
disponíveis estão definidos em `ICONS` dentro de `public/app.js`.
