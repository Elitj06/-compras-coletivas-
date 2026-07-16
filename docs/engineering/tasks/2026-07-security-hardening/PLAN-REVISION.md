# Revisão do plano — adjudicação da arquitetura

**Data:** 2026-07-16  
**Baseline:** `c57dbe5`  
**Resultado:** plano revisado e liberado para a cadeia de implementação, condicionado aos preflights definidos.

| Achado | Adjudicação e mudança concreta | Estado |
|---|---|---|
| C-01 | Criada política normativa: `faixas_desconto` excluída; chave `categorias.slug`; específica > global > 0; snapshots imutáveis; advisory lock idêntico em pedido/desconto; preflight e índice único parcial. | Resolvido |
| H-01 | Inserida matriz completa de mutações, escopo, CSRF, Origin e cookies. Recuperação pública não cria sessão; troca emite uma; logout limpa mesmo expirado. | Resolvido |
| H-02 | Migração agora exige preflight bloqueante de ciclos, pedidos/itens, catálogo, categoria e políticas; só cria índice após dados válidos e não saneia automaticamente. | Resolvido |
| H-03 | Fixadas fonte única de IP Vercel, validação, falha fechada, limites numéricos, transação, bloqueio e `Retry-After`. | Resolvido |
| H-04 | Fixado helper multi-`Set-Cookie`, CORS para CSRF/escopo, política production/preview/dev e teste HTTPS/serializador. | Resolvido |
| M-01 | Substituição recebe `FOR UPDATE` e retorno de conflito concorrente. | Incorporado |
| M-02 | Limites fixos: 64 KiB, 50 itens, quantidade 1–99. | Incorporado |
| M-03 | CSP foi retirada desta release; há tarefa futura explícita, evitando reporte inoperante. | Incorporado |
| M-04 | Upload permanece hotspot, autenticação passa para cookie/CSRF e XLSX não é anunciado se não houver parser testado. | Incorporado |

Não há bloqueador crítico restante no plano. O primeiro gate do Implementer é executar os preflights em banco descartável e em produção de forma somente leitura; qualquer falha é bloqueador real e exige saneamento aprovado, nunca correção automática.
