# Relatório — recuperação e alteração de PIN

## Status

Release 1 de compatibilidade publicada e provada. Release 2 implementada e
aprovada pelo Verifier independente e nos gates locais, mas não publicada: o
Reviewer obrigatório de terceira família aprovou o isolamento do SMTP. A Release
2 foi publicada e o envio Gmail SMTP foi aceito em teste controlado de produção.

## Release 1 — rollback canônico

- Commit `0fda4ec156e0792811762a8d7c0469f8ff0230ed` publicado no GitHub.
- Deploy Vercel `READY` no alias canônico.
- Health e UI retornaram `200`; login com PIN incorreto manteve `401`; rota de
  recuperação permaneceu inativa com `404`.
- Migração `sql/05_pin_recovery.sql` aplicada em produção. As três tabelas
  `pin_recovery_*` estão presentes, com zero grants para `PUBLIC`, `anon`,
  `authenticated` e `service_role`.
- Este commit reconhece SHA-256 legado e PBKDF2 e é o único rollback de código
  válido depois que a migração de hashes for ativada.

## Release 2 — implementação

- Separadas as camadas HTTP, serviço, dados, identidade, rate limit, criptografia
  e entrega por e-mail sob `server/`; somente os dois handlers reais permanecem
  empacotados como funções Vercel.
- Cadastro é somente criação, usa PBKDF2 e serializa telefone/e-mail equivalentes
  com advisory locks. Pedidos não alteram mais a identidade do comprador.
- Login mantém compatibilidade com hash legado, resposta neutra e migração
  opt-in. Rate limits persistentes por identificador e IP executam antes do lookup.
- Recuperação pública usa desafio opaco, código CSPRNG de 6 dígitos, HMAC, prazo
  de 10 minutos, cinco tentativas, entrega obrigatória, invalidação em reenvio e
  consumo concorrente com um único vencedor.
- Falha ou ausência do Gmail SMTP revoga o desafio antes da resposta e mantém o `202`
  neutro. Nenhum código, PIN, token ou identificador em claro entra na auditoria.
- Recuperação administrativa exige sessão, comprador por ID, método e nota de
  validação. Troca autenticada rotaciona todas as sessões; logout revoga apenas
  a apresentada.
- Frontend inclui solicitação/conclusão, fallback administrativo, alteração de
  PIN e logout server-side, com modal responsivo validado em viewport móvel.

## Evidências locais da Release 2

- `npm test`: 11 testes unitários aprovados, 0 falhas; integração omitida sem URL
  descartável.
- PostgreSQL 16 descartável: 9 testes de integração aprovados, incluindo
  migração dupla, ambiguidade, provedor ausente, falha de entrega, reenvio, expiração, cinco erros,
  concorrência, sessão, admin e cadastro PBKDF2.
- Sintaxe Node aprovada para API, módulos, frontend e testes.
- `git diff --check` focado aprovado.
- `vercel build --prod` aprovado; output separa `api/db.func` (Edge) de
  `api/pin-recovery-request.func` (Node SMTP).
- Chrome headless móvel confirmou a abertura e renderização do modal de conclusão
  por link `?recover=`.
- Verifier independente aprovou condicionalmente; o Reviewer de terceira família
  aprovou o isolamento do SMTP do bundle Edge. Teste de integração PostgreSQL 16
  em banco descartável passou com 20 testes.

## Configuração e bloqueio externo

- Chaves HMAC separadas, URL canônica e flags de rollout foram armazenadas como
  variáveis protegidas no Vercel; a recuperação continua desativada durante os
  gates de release.
- Gmail SMTP usa a conta exclusiva do projeto e senha de app armazenada no Vercel;
  não exige domínio próprio nem serviço pago. O endpoint SMTP roda isolado em
  Node, enquanto a API principal permanece Edge. A entrega controlada foi aceita
  pelo Gmail em produção antes da ativação.

## Publicação e validação de produção

- Commit `23c27d0` enviado ao GitHub; deploy Vercel `READY` e associado ao alias
  canônico `https://compras-coletivas-phi.vercel.app`.
- `GET /api/db/health` respondeu `200`; a função Node de solicitação respondeu
  `405` a `GET`, confirmando o roteamento sem ativar fluxo indevido.
- Uma conta de teste efêmera recebeu solicitação por `POST /api/pin-recovery-request`;
  resposta pública `202` e auditoria `pin_recovery_delivered` confirmaram que o
  Gmail aceitou a mensagem. A conta, desafio e auditoria de teste foram removidos.
- A sequência completa de consumo, expiração, concorrência e revogação foi coberta
  em PostgreSQL 16 descartável: 20 testes aprovados. A confirmação final de UX na
  caixa de entrada de um comprador real continua como acompanhamento operacional.

## Rollback

Desabilitar primeiro `PIN_RECOVERY_ENABLED`. Se necessário, voltar ao commit
`0fda4ec`; manter o schema aditivo. Nunca voltar ao baseline legado depois de
gravar qualquer envelope PBKDF2.
