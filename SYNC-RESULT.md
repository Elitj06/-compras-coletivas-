# Relatório de Sincronização — Julho/2026

**Data:** 2026-07-10 16:44 UTC  
**Arquivo origem:** `data/produtos.json` (240 produtos)  
**Destino:** Supabase `compras_coletivas.produtos` (244 produtos)

---

## 1. Sincronização de Preços

| Métrica | Valor |
|---|---|
| Produtos no JSON | 240 |
| Produtos no DB | 244 |
| **UPDATEs com sucesso** | **237** |
| UPDATEs sem match (código não existe no DB) | 3 |

### 3 produtos do JSON não encontrados no DB
| Código | Nome |
|---|---|
| B1220ME | VITAMINA B12 GOTAS FRASCO 20ML MENTA |
| VPA280CT | VITAPOWER AIR POTE 280G SABOR SORVETE CHOCOTINE TRUFADA |
| VPA600CT | VITAPOWER AIR POTE 600G SABOR SORVETE CHOCOTINE TRUFADA |

### 7 produtos no DB não presentes no JSON
`CLB30AH`, `DR150`, `EF20`, `ISP240`, `PA600`, `WFT1800BA`, `WFT1800CH`

### Verificação de amostra (5 produtos)
| Código | Preço JSON | Preço DB | Match |
|---|---|---|---|
| AM240LI | 168.00 | 168.00 | ✅ |
| EG12CB | 98.00 | 98.00 | ✅ |
| IFP450CA | 179.00 | 179.00 | ✅ |
| SCP60 | 107.00 | 107.00 | ✅ |
| WP900MO | 236.00 | 236.00 | ✅ |

---

## 2. Imagens de Produtos

### Estado do DB
- **244 de 244 produtos (100%)** já possuem imagem no banco (formato base64)
- **0 produtos sem imagem** no banco de dados

### Produtos sem URL de imagem no JSON (9 produtos)
Todos os 9 produtos sem campo `imagem` no JSON foram verificados e tiveram URLs válidas encontradas em `https://www.vitafor.com.br/<CODIGO>-01.jpg`:

| Código | URL encontrada | Status |
|---|---|---|
| AGF30 | `https://www.vitafor.com.br/AGF30-01.jpg` | ✅ HTTP 200 |
| BF210LI | `https://www.vitafor.com.br/BF210LI-01.jpg` | ✅ HTTP 200 |
| BF210TA | `https://www.vitafor.com.br/BF210TA-01.jpg` | ✅ HTTP 200 |
| VPA600SC | `https://www.vitafor.com.br/VPA600SC-01.jpg` | ✅ HTTP 200 |
| VPA600SM | `https://www.vitafor.com.br/VPA600SM-01.jpg` | ✅ HTTP 200 |
| VPA600CT | `https://www.vitafor.com.br/VPA600CT-01.jpg` | ✅ HTTP 200 |
| VPA280SC | `https://www.vitafor.com.br/VPA280SC-01.jpg` | ✅ HTTP 200 |
| VPA280SM | `https://www.vitafor.com.br/VPA280SM-01.jpg` | ✅ HTTP 200 |
| VPA280CT | `https://www.vitafor.com.br/VPA280CT-01.jpg` | ✅ HTTP 200 |

Todas as 9 URLs foram adicionadas ao `data/produtos.json`.  
No DB não foi necessário atualizar — todos os 244 produtos já têm imagem base64.

### Produtos que continuam sem imagem no DB
**Nenhum.** Todos os 244 produtos no DB possuem imagem.

---

## 3. Integridade de Pedidos e Pagamentos

| Tabela | Antes | Depois |
|---|---|---|
| pedidos | 17 | 17 ✅ |
| pagamentos | 17 | 17 ✅ |
| itens_pedido | 80 | 80 ✅ |

**Nenhum pedido, pagamento ou item foi alterado.** A sincronização só tocou a tabela `produtos` (UPDATE de preco e nome).

---

## 4. Resumo Final

| Critério | Status |
|---|---|
| 1. Preços sincronizados | ✅ 237/240 (3 códigos não existem no DB) |
| 2. Imagens aplicadas | ✅ 0 produtos sem imagem no DB; 9 URLs adicionadas ao JSON |
| 3. Pedidos/pagamentos intactos | ✅ 17 pedidos, 17 pagamentos, 80 itens |
| 4. Commit no git | ✅ `9511973` |

**Observação:** Os 3 produtos do JSON que não existem no DB (`B1220ME`, `VPA280CT`, `VPA600CT`) são possivelmente novos e podem precisar de INSERT manual se devem ser comercializados.
