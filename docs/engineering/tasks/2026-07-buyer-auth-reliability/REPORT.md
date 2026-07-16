# Relatório — confiabilidade do acesso do comprador

## Estado

Publicada e validada em produção em 16/07/2026. O commit funcional `c340b2e`
está em `main`; o deployment `dpl_CN8XK1AUbCTthbBVntme3fVMXHuA` chegou a
`READY` e atende o alias canônico.

## Causa e correção

- O segredo de HMAC da recuperação não possuía valor efetivo no ambiente de produção.
  Uma nova chave CSPRNG exclusiva foi configurada e validada sem registrar seu valor.
- Uma identidade real tinha dois cadastros semanticamente equivalentes e somente um deles
  possuía pedidos vinculados. A implementação anterior recusava qualquer duplicidade.
- A camada de dados agora retorna internamente a contagem de pedidos vinculados. Um serviço
  separado resolve o cadastro canônico somente quando nomes e e-mail são equivalentes e
  exatamente um candidato possui histórico.
- Login e recuperação usam o mesmo resolvedor. Se a identidade for realmente ambígua, o
  comportamento continua fechado: credencial inválida no login e resposta neutra na recuperação.
- Nenhum cadastro, pedido ou credencial foi mesclado, excluído ou transferido.

## UX

- Botões de login, cadastro e recuperação exibem loading, bloqueiam repetição e são sempre restaurados.
- Exceções de rede recebem mensagem acionável.
- Conflito de cadastro direciona o comprador para login ou recuperação, com o identificador já preenchido.
- A tela posterior à solicitação preserva a proteção contra enumeração e não promete entrega.

## Evidências locais

- Suíte sem banco: 26 testes aprovados, 0 falhas; integração explicitamente pulada.
- PostgreSQL 16 descartável: 40 testes aprovados, 0 falhas e 0 pulados.
- A integração cobriu seleção do cadastro histórico, entrega aceita por stub controlado,
  consumo único, redefinição do PIN, login subsequente no cadastro canônico e preservação do duplicado.
- Casos com nomes distintos e com mais de um cadastro contendo pedidos não enviaram código.
- Sintaxe dos módulos e frontend, `git diff --check` escopado e build Vercel de produção: aprovados.

## Evidências de produção

- Backup lógico pré-release validado: 414.980 bytes e 172 entradas legíveis pelo
  `pg_restore`; nenhuma restauração foi necessária.
- Health `200`; login inválido `401`; cadastro existente `409`; solicitação de
  recuperação `202` com `Cache-Control: no-store`.
- Uma recuperação ponta a ponta em caixa controlada comprovou entrega real pelo
  provedor, consumo único do código, rejeição do replay, rejeição do PIN antigo e
  login com o PIN novo.
- Sessão autenticada e histórico do comprador responderam `200` no alias canônico.
- O asset SheetJS local respondeu `200` e seu SHA-384 corresponde ao artefato
  aprovado no build.
- A resolução somente leitura do caso reportado selecionou o cadastro original
  vinculado ao pedido de Abril; o duplicado sem histórico foi preservado.
- O conflito de cadastro existente reproduzido em produção retornou `409`, e a UI
  publicada agora direciona para login ou recuperação em vez de deixar a ação inerte.
- Compradores sintéticos usados nos smokes e seus registros auxiliares foram
  removidos ao final; a verificação de resíduos retornou zero.
- Nenhum e-mail foi enviado ao endereço pessoal do comprador durante a homologação.
  O próximo código será enviado quando o próprio comprador solicitar a recuperação.

## Ciclo de reparo 1

- No conflito de cadastro, o login agora reaproveita somente o telefone digitado; o e-mail
  submetido não é tratado como identidade confirmada.
- A solicitação pública normaliza o identificador e consome os limites persistentes antes
  de auditar indisponibilidade. Sem configuração do rate limit, falha fechada sem amplificar
  gravações de auditoria; a resposta pública permanece neutra.
- Nodemailer foi atualizado para `9.0.3`; o `ws` transitivo foi fixado em `8.21.0` por override.
- O pacote Node `xlsx`, não importado pelo backend, foi removido. A exportação no navegador
  permanece ativa com SheetJS `0.20.3` servido pela distribuição oficial.
- `npm audit --audit-level=low`: zero vulnerabilidades.
- O Verifier reprovou o primeiro diff, confirmou os reparos no ciclo 1 e aprovou o
  digest final para seguir ao Reviewer.

## Ciclo de reparo 2

- O Reviewer rejeitou o digest por uma corrida entre login e recuperação, diferença temporal
  causada pelo SMTP síncrono e dependência remota do SheetJS.
- Seleção canônica, lock/releitura `FOR UPDATE`, verificação do PIN, migração de hash e criação
  de sessão agora ocorrem na mesma transação. Teste concorrente determinístico confirmou que
  a recuperação remove a sessão criada com o PIN antigo e que o PIN antigo falha após o reset.
- A recuperação pública foi separada em preparação e entrega. A resposta `202` não aguarda SMTP;
  `waitUntil` de `@vercel/functions` mantém entrega, auditoria/revogação e fechamento do banco
  no background. Elegível e ausente compartilham envelope e piso uniforme de 450 ms, reduzindo
  o canal residual sem prejudicar a jornada de recuperação.
- SheetJS `0.20.3` foi versionado em `public/vendor`, com SHA-384 validado e SRI no HTML.
  O teste executa o asset, confirma `XLSX.version` e produz um workbook XLSX.
- O build contém `@vercel/functions` na função Node e o asset local com o mesmo SHA-384.
- Verifier e Reviewer final aprovaram o manifesto reparado para rollout controlado.

## Rollback

Desativar primeiro `PIN_RECOVERY_ENABLED` e promover novamente o commit `6298c50`.
A chave nova pode permanecer protegida; sua rotação invalida desafios anteriores. Esta correção
não exige rollback de dados porque não altera vínculos nem remove cadastros.
