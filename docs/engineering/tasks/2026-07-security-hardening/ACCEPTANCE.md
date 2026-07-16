# Critérios de aceite — security hardening

## Proteção de valores do pedido

- [ ] `POST /api/db/pedidos` aceita somente itens com `codigo` e `quantidade` mais `replace_pedido_id` opcional; identidade vem da sessão.
- [ ] Forjar no request preço, desconto, subtotal, nome ou categoria não altera qualquer valor persistido.
- [ ] Produto ausente/inativo/ambíguo, item duplicado, quantidade inválida e carrinho vazio falham sem criar pedido parcial.
- [ ] Os valores salvos em `itens_pedido` e os totais em `pedidos` batem exatamente com o catálogo/desconto ativos calculados no servidor, inclusive arredondamento de centavos.
- [ ] Criação, alteração de quantidade e adição administrativa de item obedecem a regra de preço documentada e recalculam totais de forma transacional.
- [ ] Tentativa concorrente de alteração de desconto e criação de pedido produz um snapshot consistente, sem totais mistos.
- [ ] `faixas_desconto` não participa do checkout; a precedência normativa é categoria específica ativa → global `todos` → 0%, e preço snapshot de pedido existente nunca é recalculado por mudança de desconto.
- [ ] Preflight bloqueia rollout se catálogo, categoria, desconto ou ciclo forem ambíguos/inconsistentes; não há deduplicação automática. Runtime retorna `409` estável para ambiguidade remanescente.
- [ ] POST/DELETE de desconto e criação/adição de pedido usam o mesmo advisory lock transacional; teste de duas conexões prova uma política única por pedido.
- [ ] Limites contratuais são aplicados antes de transação: body 64 KiB, até 50 itens e quantidade inteira 1–99; cada violação tem código estável.
- [ ] Substituição de pedido usa lock de linha e rejeita corrida com `409 ORDER_REPLACEMENT_CONFLICT` sem apagar pedido válido.

## Sessões e CSRF

- [ ] Login, cadastro, troca de PIN e login admin devolvem cookies `__Host-cc-*` com `Secure`, `HttpOnly` apenas para sessão, `SameSite=Strict`, `Path=/` e TTL compatível com o banco; resposta não contém token.
- [ ] Nenhum token de sessão fica em `localStorage`, `sessionStorage`, estado persistido, body JSON ou log.
- [ ] SPA restaura sessão por endpoint de sessão e envia cookies com `credentials: 'same-origin'`.
- [ ] Toda mutação autenticada exige CSRF de escopo, origem/fetch metadata válidos e retorna `403 CSRF_VALIDATION_FAILED` quando adulterada/ausente.
- [ ] Logout, expiração, recuperação de PIN e troca de PIN removem cookies e revogam exatamente as sessões previstas.
- [ ] Login admin continua permitindo a experiência de comprador vinculada sem compartilhar token ou permitir confusão de escopo.
- [ ] Upload administrativo usa a mesma sessão cookie/CSRF, sem senha em query string ou bearer legado.
- [ ] A matriz de rotas do plano é coberta: recuperação pública não cria sessão e expira cookies buyer; troca autenticada substitui por exatamente uma sessão; logout expira cookies mesmo com sessão já expirada.
- [ ] `DELETE /pedidos/:id` exige `X-Session-Scope` válido, impedindo confusão entre buyer/admin quando ambas as sessões existem.
- [ ] A resposta usa `Headers.append` para cada `Set-Cookie`; teste confirma que nenhum cookie é perdido. CORS permite `X-CSRF-Token`/`X-Session-Scope` somente para origem explicitamente autorizada e com credenciais.

## Erros, limite e headers

- [ ] JSON malformado em POST e PUT responde `400 INVALID_JSON`; não ocorre `500` nem vazamento de detalhe interno.
- [ ] Login admin com senha inválida retorna resposta neutra e, ao exceder o limite configurado, `429 ADMIN_LOGIN_RATE_LIMITED` com `Retry-After`.
- [ ] Em produção, somente `x-vercel-forwarded-for` com um IP válido pode alimentar o limite admin. Cabeçalho forjado/ausente, segredo HMAC ausente ou menor que 32 caracteres causa `503 AUTH_RATE_LIMIT_UNAVAILABLE`.
- [ ] Limites admin são verificáveis e atômicos: IP 5/900 s, bloqueio 1800 s; global 60/60 s, bloqueio 60 s; teste concorrente confirma decisão e `Retry-After` derivados do mesmo estado.
- [ ] Login do comprador preserva os contratos validados: input inválido `400`, credencial inválida `401`, limite `429`.
- [ ] Respostas de autenticação/sessão são `Cache-Control: no-store`; CORS continua restrito às origens permitidas e headers de endurecimento definidos no plano estão presentes.

## Dados, compatibilidade e dependências

- [ ] Migração `08_security_hardening.sql` é idempotente, preserva contagens e valores de compradores/produtos/descontos/ciclos/pedidos/itens/pagamentos e revoga somente sessões antigas.
- [ ] `docs/API.md`, `.env.example`, README e runbook descrevem os contratos novos e a reautenticação esperada.
- [ ] `npm audit --omit=dev` não aponta vulnerabilidade alta/crítica em dependência mantida; `npm ls ws` prova versão corrigida.
- [ ] `nodemailer` atualizado passa teste de transporte fake. `xlsx` vulnerável não permanece instalado; se XLSX não for implementado/testado, a API não anuncia suporte a XLSX.

## Evidência de teste e release

- [ ] Testes unitários: cookie/CSRF, parser JSON, rate limit admin, cálculo/validação de pedido e limpeza de sessão.
- [ ] Integração PostgreSQL descartável: cadastro/login → pedido adulterado → valores canônicos; desconto concorrente; logout; PIN recovery; limite admin.
- [ ] Regressão: `npm test`, lint/sintaxe, build Vercel e testes de upload/e-mail aplicáveis aprovados.
- [ ] Verifier independente reproduz o comportamento a partir do diff imutável sem editar código; Reviewer de terceira família aprova segurança, contratos e rollback.
- [ ] Commit está no GitHub, deploy Vercel está `READY`, `/api/db/health` retorna 200, SPA carrega e smoke real de comprador/admin no alias canônico passa.
- [ ] `REPORT.md`, `TELEMETRY.md` e checklist de entrega registram comandos/resultados, commit/deploy, revisão, riscos residuais e rollback não acionado (ou evidência de rollback).
