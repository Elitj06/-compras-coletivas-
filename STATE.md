# Compras Coletivas Vitafor — STATE

## Atualização 24/07/2026 — remoção de produtos descontinuados

**Status:** publicado e validado em produção.

- Removidos do catálogo do app e desativados no banco: `CCF240` (Choco Family),
  `FBF10`/`FBF400` (Fiberfor) e `OFV60`/`OFV120` (Omegafor Vitamins).
- O gerador mensal passou a bloquear esses cinco códigos para que não voltem em
  uma atualização futura baseada em planilha antiga.
- Cruzamento da planilha `TABELA_NOVA_JULHO_2026.xlsx` com o catálogo frontend:
  240 códigos na planilha e 235 no app; nenhum produto ativo do app ficou fora
  da planilha. Os cinco códigos descontinuados aparecem apenas na planilha-base
  antiga e não no catálogo publicado.
- Existem 7 registros legados ativos somente no banco e não expostos pela UI:
  `CLB30AH`, `DR150`, `EF20`, `ISP240`, `PA600`, `WFT1800BA` e `WFT1800CH`.
  Eles foram preservados para confirmação antes de qualquer nova desativação.
- Havia registros antigos desses produtos em pedidos ativos: `CCF240` (5) e
  `FBF400` (1). A desativação do catálogo não apagou pedidos existentes.
- Commit `b90fa5e` publicado no GitHub; Vercel deployment
  `dpl_eJmhvvLjgF8yfxNcV4CvvH6qE2zw` em `READY` no alias canônico.
- Smoke: home, catálogo publicado e `/api/db/health` retornaram `200`; os cinco
  códigos descontinuados não aparecem no JavaScript servido em produção.

## Atualização 24/07/2026 — barra de progresso restrita ao admin

**Status:** publicado e validado em produção.

- A barra detalhada de progresso do desconto foi removida da área do comprador.
- O componente agora fica dentro da aba administrativa e só renderiza quando a
  sessão administrativa está autenticada.
- O logout administrativo limpa imediatamente o conteúdo da barra.
- O cálculo do desconto e o percentual aplicado ao carrinho continuam iguais;
  somente a visualização da barra foi restringida.
- Testes locais: 124 aprovados, `git diff --check` e `vercel build` aprovados.
- GitHub: commit `3f6293d` publicado em `main`.
- Vercel: deployment `dpl_5fu5JPaogkhFbn436Dtp5uBMuBJZ` em `READY`, alias
  canônico `https://compras-coletivas-phi.vercel.app`.
- Smoke: home, JavaScript e endpoint de progresso retornaram `200`; o HTML em
  produção contém uma única barra dentro da aba admin e o JavaScript publicado
  mantém a guarda de sessão administrativa.

## Atualização 24/07/2026 — cálculo final, quantidades e atualização do admin

**Status:** publicado e validado em produção.

- A troca de faixa usa exclusivamente o total final já com desconto. Quando uma
  faixa é liberada, ela permanece estável até o total recuar abaixo da faixa
  anterior; isso evita alternância entre percentuais após o próprio recálculo.
- A barra pública e o painel administrativo mostram a faixa mais alta alcançada
  pelo total final, inclusive no limite de R$ 8.000 para 48%.
- O admin permite digitar a quantidade diretamente (1–99), mantendo os botões
  de atalho. O recálculo usa preços armazenados no banco e totais arredondados,
  sem alterar produtos, pedidos ou pagamentos registrados.
- O painel administrativo carrega progresso, estatísticas e relatórios em
  paralelo. Refreshes concorrentes são coalescidos e recebem uma renderização
  final adicional quando necessário.
- A leitura do progresso do ciclo ativo faz auto-healing transacional quando
  encontra preços antigos em faixa diferente da alcançada; não altera
  quantidade, produto, pedido ou pagamento.
- Gates: 116 testes aprovados, sintaxe, `git diff --check` e `vercel build`.
- GitHub: commits `e9a7ed2`, `e74bc4b` e `2bfa402` publicados em `main`.
- Vercel: deployment de produção `dpl_FGqaf9JQ9pZPrhTmdcNzQoodM851` em
  `READY`, alias canônico `https://compras-coletivas-phi.vercel.app`.
- Smoke: home e health `200`; progresso `200` sem cache, retornando total final
  de R$ 8.454,60 e 48% ativos em duas leituras consecutivas; JavaScript
  publicado com entrada direta de quantidade e refresh paralelo.

## Atualização 24/07/2026 — progresso baseado no total final

**Status:** publicado e validado em produção.

- A barra de progresso agora usa exclusivamente `SUM(pedidos.total_final)` do
  ciclo ativo, ou seja, o total que já inclui o desconto aplicado.
- O valor bruto não avança a próxima faixa nem altera o percentual exibido.
- A migração aditiva `sql/09_discount_progress_final_total.sql` recalibra dados
  existentes pelo total final; a conferência da produção mostrou R$ 9.079,46
  finais e 48% já aplicados, portanto não houve mutação de dados necessária.
- A API e a interface passaram a expor `total_final`; a regra pura e os testes
  cobrem a transição 40%/44%/48% usando o total pago.
- Os 58 testes locais, sintaxe, `git diff --check` e `vercel build` passaram.
- GitHub: commits `eb27d77`, `e499b09` e `9b49463` publicados em `main`.
- Vercel: deployment de produção `READY` (`dpl_66UxnreJgyEVe3ggth4hxUg5nUms`), alias canônico
  `https://compras-coletivas-phi.vercel.app`.
- Smoke: `GET /api/db/desconto-progresso` retornou `200` com
  `total_final: 9079.46` e 48% ativos; a API respondeu com `Cache-Control:
  no-store` e a home/JavaScript publicados retornaram `200`.

## Atualização 20/07/2026 — desconto progressivo coletivo e hardening

**Status:** publicado e validado em produção.

- Compradores passam a ver, no topo da página, uma barra pública com o total
  coletivo, percentual atual, próxima faixa e valor faltante. O agregado é
  atualizado ao abrir a página e a cada 30 segundos.
- O backend calcula o preço do pedido a partir do catálogo e aplica a faixa
  coletiva vigente a todos os pedidos ativos dentro da mesma transação. Ao
  alcançar uma nova faixa, pedidos existentes também são reprecificados.
- O hardening foi reaplicado com cookies `HttpOnly` de sessão, CSRF por escopo,
  corpo JSON limitado e rate limit administrativo com IP canônico e fallback
  compatível com o proxy da Vercel. Tokens não são mais persistidos no navegador.
- A migração aditiva `sql/08_security_hardening.sql` inclui preflight fail-closed,
  invalidação das sessões antigas sem CSRF e alinhamento imediato dos pedidos
  existentes à faixa vigente.
- Gates locais: 35 testes aprovados, auditoria sem vulnerabilidades de alta
  severidade, `vercel build`, sintaxe e `git diff --check` aprovados.
- GitHub: commit `cb37e9f` publicado em `main`.
- Vercel: deployment de produção `READY`, alias canônico
  `https://compras-coletivas-phi.vercel.app`.
- Smoke: health `200`; progresso coletivo `200` com R$ 8.457,00 e 48% ativos;
  login admin inválido `401` (sem o `503` anterior); login de comprador
  inválido `401`; home publicada com a barra e JavaScript com cookies/CSRF.
- Migração executada sem apagar pedidos ou itens: os 9 pedidos ativos e 40
  itens foram alinhados para 48% (R$ 4.059,36 de economia). As sessões antigas
  foram invalidadas uma única vez para exigir novo login com CSRF; dois desafios
  administrativos efêmeros vinculados a essas sessões também foram removidos.

## Atualização 19/07/2026 20:24 BRT — acesso admin/comprador simplificado

**Status:** correção publicada e validada em produção.

- O painel administrativo agora chama a ação de **Definir acesso** e gera um
  único PIN novo, sem campo opcional nem fluxo de código intermediário.
- A tela final explica exatamente o que enviar ao comprador: telefone/e-mail +
  PIN; o comprador entra pela tela normal **Entrar**. Também há cópia pronta
  para WhatsApp.
- A sessão administrativa renovará automaticamente a sessão limitada do
  comprador vinculado ao reabrir o app. A senha de admin passa a restaurar os
  dois acessos sem pedir um segundo login; o painel mostra o botão para abrir o
  próprio histórico.
- Nenhum pedido, item, pagamento ou cadastro foi apagado ou alterado.
- Gates locais: 31 testes aprovados, sintaxe validada, `git diff --check` e
  `vercel build` aprovados.
- Commit: `52c5050` no GitHub; deployment Vercel `dpl_9NECNWNtR1F1ASrHW9S4QQ17mtfQ`
  em `READY`, alias canônico `https://compras-coletivas-phi.vercel.app`.
- Smoke em produção: login admin `200` retornando Eliandro como comprador
  vinculado; `GET admin/session` `200` renovando o acesso de comprador;
  sessão de comprador `200`; histórico próprio `200` com 1 pedido; reset sem
  autenticação `401`; home e scripts atualizados `200`.
- Conferência de preservação: banco permaneceu com 26 pedidos, 119 itens e 17
  pagamentos após a publicação e os testes de acesso.

## Atualização 19/07/2026 19:59 BRT — recuperação e login simplificados

**Status:** correção implementada, publicada e validada em produção.

- O painel admin agora usa **Redefinir acesso**: escolhe o comprador, aceita um
  PIN definido pelo admin ou gera um PIN novo automaticamente, e o PIN passa a
  funcionar imediatamente. Não há mais desafio, expiração, nota ou código que
  o usuário precise converter em outro fluxo.
- O comprador pode clicar em **Esqueci meu PIN**, informar telefone/e-mail e
  escolher o novo PIN diretamente. O fluxo não depende de SMTP, e-mail ou
  variáveis de recuperação.
- Login continua aceitando telefone ou e-mail, com ou sem variações brasileiras
  de DDI; quando há cadastros legados duplicados, o PIN informado seleciona a
  conta correta e prioriza a conta com histórico.
- Todo reset invalida as sessões antigas e exige novo login.
- Commits publicados: `e66ebe1` e `b124655`.
- GitHub: `main` sincronizada.
- Vercel: deployment `dpl_9Ls2LeJ4MB5yhdhcLZdrDbkzJRx1`, `READY`, alias
  canônico `https://compras-coletivas-phi.vercel.app`.
- Gates locais: 29 testes aprovados, 1 suíte PostgreSQL opcional pulada por
  ausência de `TEST_DATABASE_URL`, sintaxe validada, `vercel build` aprovado.
- Smoke em produção: health `200`; login inválido `401`; recuperação simples
  para cadastro inexistente `404`; reset admin sem sessão `401`; JS publicado
  contém os novos fluxos de recuperação e reset.
- Trade-off explícito: a recuperação simples permite redefinir o PIN conhecendo
  telefone/e-mail. Isso foi adotado conforme o escopo de grupo pequeno e baixa
  exigência de segurança solicitado pelo Eliandro.

**Projeto iniciado:** 2026-04-06
**Responsável:** TJ (agente guia-compras)
**Grupo WhatsApp:** 120363405060387448@g.us (23 participantes) — agente: guia-compras

---

## Atualização 16/07/2026 10:27 BRT — acesso e recuperação do comprador

**Status:** correção publicada e validada em produção.

- A correção anterior estava incompleta: o segredo criptográfico da recuperação
  existia no ambiente sem valor efetivo, e o caso reportado possuía dois cadastros
  semanticamente equivalentes. O original tinha pedido no ciclo de Abril/2026;
  o posterior não tinha histórico.
- Foi configurada uma chave CSPRNG exclusiva no ambiente protegido, sem expor ou
  persistir seu valor fora do gerenciador de segredos.
- Login e recuperação agora compartilham um resolvedor conservador: somente nome e
  e-mail equivalentes, com exatamente um cadastro contendo pedidos, permitem usar
  o registro histórico como canônico. Ambiguidades reais continuam fechadas.
- Nenhum comprador, pedido ou credencial foi mesclado, transferido ou excluído.
- O login foi serializado com a redefinição de PIN para impedir que uma sessão criada
  com o PIN antigo sobreviva ao reset. A entrega de e-mail saiu do caminho síncrono,
  preservando a resposta pública neutra e sem cache.
- A UX de login, cadastro e recuperação ganhou loading, bloqueio de clique duplicado,
  restauração após erro e direcionamento acionável de conta existente para login ou
  recuperação.
- Dependências vulneráveis foram atualizadas/removidas; SheetJS `0.20.3` passou a ser
  servido localmente com SHA-384/SRI.
- Gates: 26/26 testes sem banco, 40/40 em PostgreSQL 16 descartável, auditoria de
  dependências zerada, sintaxe, build e duas revisões independentes aprovadas.
- GitHub: commit `c340b2e`. Produção: deployment
  `dpl_CN8XK1AUbCTthbBVntme3fVMXHuA`, `READY`, no alias canônico.
- Smoke no ar: health `200`; login inválido `401`; cadastro existente `409`;
  recuperação `202`/`no-store`; sessão e histórico autenticados `200`.
- Recuperação ponta a ponta em caixa controlada comprovou entrega real, consumo
  único, replay rejeitado, PIN antigo rejeitado e PIN novo aceito. Resíduos de dados
  sintéticos após a limpeza: zero.
- O caso com pedido de Abril foi resolvido por leitura para o cadastro histórico.
  Nenhum e-mail foi enviado ao endereço pessoal durante a homologação; o comprador
  já pode solicitar um novo código pelo app.
- Backup lógico pré-release validado. Rollback disponível: desativar
  `PIN_RECOVERY_ENABLED` e promover novamente o baseline `6298c50`.

## Atualização 15/07/2026 12:10 BRT

## Atualização 16/07/2026 — status de erro do login do comprador

**Status:** correção publicada e validada em produção.

- Causa raiz: o despachante das rotas de autenticação retornava promessas sem
  aguardá-las dentro do `try`; falhas esperadas de validação e PIN escapavam do
  tratamento controlado e apareciam como erro interno `500`.
- Correção: as rotas assíncronas de autenticação agora são aguardadas dentro do
  `try`, preservando os contratos `400`, `401` e `429`.
- Commit: `0cdaa90` (`fix: preserve buyer login error statuses`), enviado ao
  GitHub e publicado pela integração Vercel.
- Evidência no alias canônico: health `200`; entrada inválida no login retorna
  `400 INVALID_LOGIN_INPUT`; PIN de credencial inexistente retorna
  `401 INVALID_CREDENTIALS` — sem `500`.
- Gates locais: 15 testes aprovados; uma suíte de integração PostgreSQL foi
  pulada por ausência de banco de teste descartável. Revisão independente
  aprovou a correção; o comportamento de rate limit `429` foi também conferido
  localmente.

## Atualização 16/07/2026 — hardening de segurança

**Status:** release de hardening implementada, enviada ao GitHub e retirada de produção após smoke de autenticação administrativa.

- Pedidos passam a usar preço, desconto, categoria e totais calculados no servidor;
  o navegador envia apenas código e quantidade.
- Sessões foram migradas para cookies `HttpOnly` com CSRF por escopo, logout
  administrativo real, rate limit administrativo e respostas sem cache.
- A migração é aditiva e, em simulação transacional, preservou pedidos, itens,
  pagamentos e sessões novas após reaplicação.
- Gates: 21 testes aprovados, auditoria de dependências limpa, build Vercel local e
  revisão independente dos reparos aprovada.
- Backup lógico validado e migração aditiva aplicada, preservando as entidades de negócio e revogando apenas sessões incompatíveis com CSRF.
- A chave de rate limit foi configurada no ambiente de produção e o deploy chegou a `READY`, mas o smoke de login administrativo retornou `503 AUTH_RATE_LIMIT_UNAVAILABLE` em vez de `401` para senha inválida.
- Para não manter o painel administrativo indisponível, a produção foi revertida ao deployment anterior. O smoke pós-rollback confirmou health `200` e login administrativo inválido `401`.
- Pendente: corrigir a obtenção confiável do IP no runtime Vercel (o header previsto não está disponível no smoke), passar por uma nova cadeia de revisão e publicar novamente. A migração é aditiva e permanece aplicada; usuários precisarão se autenticar novamente na próxima release.
## Atualização 15/07/2026 — histórico e login unificado

**Status:** implementação em validação.

- Migração aditiva vinculou pedidos legados que tinham correspondência única com o cadastro do comprador; não removeu pedidos, itens ou pagamentos.
- O histórico individual passou a identificar o ciclo de cada pedido e o painel administrativo ganhou consulta por ciclo.
- A conta administrativa foi vinculada explicitamente ao cadastro do responsável para abrir Admin e painel de comprador no mesmo login, com sessões separadas e permissões preservadas.

## Atualização 15/07/2026 — ciclos de compra

**Status:** implementação e migração concluídas localmente; publicação em andamento.

- Criada estrutura aditiva de ciclos: Abril/2026 (encerrado) e Julho/2026 (ativo).
- Migração preservou 19 pedidos, 84 itens e 17 pagamentos: 17 pedidos foram associados a Abril e 2 a Julho; nenhum pedido ficou sem ciclo.
- Painel, consolidado, exportações e pagamentos passaram a usar somente o ciclo ativo. Novos pedidos recebem obrigatoriamente o ciclo ativo.
- O painel identifica explicitamente o ciclo em exibição e a API administrativa expõe os ciclos.

**Status:** correção de UX da recuperação de PIN publicada em produção.

- Causa raiz: o modal de recuperação permanecia no DOM após a redefinição do PIN;
  depois do login ele voltava a bloquear a tela, dando a impressão de que era
  necessário sair e abrir o app novamente.
- Correção: o fluxo fecha explicitamente o modal de recuperação antes de abrir o
  login, inclusive no botão **Voltar**. A recuperação continua a revogar sessões
  e exige login manual com o novo PIN.
- Commit funcional: `2b7343c`; commit adicional de teste: `8467807`; ambos no
  GitHub.
- Deploy Vercel de produção: `dpl_3yQiPFhqAKNES1BetLTocEjUUomG`, `READY`, no
  alias canônico. A home, o script atualizado e a API health responderam `200`.
- Gates: teste de ciclo de modal, suíte completa (13 testes aprovados), sintaxe,
  build Vercel e verificação independente aprovados.
- A automação visual do navegador local estava indisponível; o fluxo pós-sucesso
  foi exercitado em teste de DOM isolado e o arquivo publicado foi conferido no
  alias de produção.

---

## Atualização 15/07/2026 09:50 BRT

**Status:** recuperação de PIN publicada e ativa em produção.

- Rollback canônico `0fda4ec` publicado e testado no alias de produção.
- Migração aditiva aplicada; tabelas de desafio, rate limit e auditoria fechadas
  aos papéis expostos.
- Release 2 inclui recuperação pública neutra, fallback administrativo auditado,
  PBKDF2, troca autenticada, rotação de sessões e logout server-side.
- Gates locais: 11 testes unitários e 9 integrações em PostgreSQL 16, sintaxe,
  build Vercel e UI móvel aprovados.
- Verifier GLM aprovou o diff final sem bloqueadores.
- Bloqueio de release: o Reviewer obrigatório não produziu veredito em duas
  tentativas; o circuit breaker impediu commit/deploy da Release 2.
- Release 2 publicada no commit `23c27d0`; deploy Vercel `READY` no alias canônico.
- Endpoint SMTP isolado em Node retornou `202` e o Gmail aceitou o envio controlado.
- Banco de teste temporário foi removido após a validação; smoke local cobriu
  conclusão, rotação e revogação de sessão em PostgreSQL 16 descartável.
- Pendente: executar uma recuperação completa por um comprador real para confirmar
  a experiência final na caixa de entrada e na interface.

---

## 🔄 Atualização 2026-07-06 02:10 UTC

**Status:** ✅ LOGIN DO COMPRADOR CORRIGIDO EM PRODUÇÃO

## 🔄 Atualização 2026-07-06 02:45 UTC

**Status:** ✅ LOGIN DO COMPRADOR ACEITA VARIAÇÕES DO NOME NO MESMO TELEFONE

### O que foi feito

#### 1. ✅ Backend agora tolera variações razoáveis do nome no login/cadastro
- Comparação do nome passou a ignorar acentos, maiúsculas/minúsculas, espaços extras e conectores como `de`, `do`, `dos`, `da`
- Se o telefone já corresponde ao cadastro, o backend também aceita variações com nomes do meio ausentes ou extras, preservando o nome canônico salvo no banco
- Isso corrige casos como `Eliandro Tjader` no cadastro e `Eliandro Dos Reis Tjader` digitado no login

#### 2. ✅ Mesma equivalência aplicada à sessão de envio do pedido
- `POST /api/db/pedidos` passou a validar a sessão com a mesma regra de equivalência de nome
- Isso evita erro de sessão após login bem-sucedido com variação do nome

#### 3. ✅ Próxima validação esperada em produção
- Para o cadastro `Eliandro Tjader` com telefone `21986053944`, o login com nome `Eliandro Dos Reis Tjader` deve deixar de cair em `Comprador não encontrado`
- Após o deploy, a resposta esperada com PIN fictício passa a ser `PIN incorreto`, provando que o cadastro foi localizado

### O que foi feito

#### 1. ✅ Login/cadastro agora aceitam telefone com ou sem código do país
- Backend passou a tratar como equivalentes variações como `219...`, `55219...` e versões com `0` à esquerda
- A correção foi aplicada em:
  - `POST /api/db/comprador/login`
  - `POST /api/db/comprador/registro`
  - validação de sessão em `POST /api/db/pedidos`

#### 2. ✅ Causa raiz validada com dado real de produção
- Havia compradores com telefone salvo com `55` no banco e outros sem `55`
- Antes da correção, o backend exigia match literal do telefone normalizado
- Isso fazia o comprador existente cair em `404 Comprador não encontrado` antes mesmo da checagem do PIN

#### 3. ✅ Entrega validada
- Commit: `6ccbe69` — `fix: accept buyer login phones with optional country code`
- Push GitHub: ✅
- Deploy Vercel produção: ✅
- URL ativa: `https://compras-coletivas-phi.vercel.app`
- Verificações no ar:
  - `POST /api/db/comprador/login` com comprador salvo como `55219...` e login digitado como `219...` agora retorna `401 PIN incorreto` em vez de `404 Comprador não encontrado`
  - validação local do mesmo fluxo para `Eliandro Tjader` com `5521986053944` também passou a encontrar o cadastro e seguir para a checagem do PIN

## 🔄 Atualização 2026-07-02 19:16 UTC

**Status:** ✅ HARDENING + PERFORMANCE EM PRODUÇÃO

### O que foi feito

#### 1. ✅ Sessões reais para comprador e admin
- Backend agora emite e valida tokens assinados para comprador e administrador
- Histórico do comprador passou a exigir sessão válida; acesso anônimo agora retorna `401`
- Rotas sensíveis do admin (`stats`, relatórios, pagamentos, mutações) foram protegidas no servidor

#### 2. ✅ Fluxo do comprador corrigido e mais seguro
- Login continua aceitando acesso por telefone, mas agora sem takeover automático de cadastro sem PIN
- Envio de pedido exige sessão do comprador correspondente
- Falha no envio não apaga mais o carrinho nem cria “pedido salvo localmente” falso
- Cancelamento de pedido pelo comprador só funciona para pedido que pertence à própria sessão

#### 3. ✅ Performance e fluidez
- Frontend passou a reutilizar índice em memória por código de produto, eliminando buscas lineares repetidas
- Sessões restauradas no bootstrap com validação no backend, reduzindo estado inconsistente
- Histórico e recuperação do pedido passaram a usar sessão autenticada, com menos parâmetros e menos fragilidade

#### 4. ✅ Schema alinhado com o código
- `sql/01_schema.sql` e `sql/01_schema_supabase.sql` atualizados com `pin_hash`, índice de telefone normalizado e tabela `pagamentos`

#### 5. ✅ Entrega validada
- Commit: `df4ce36` — `fix: harden sessions and speed up buyer flows`
- Push GitHub: ✅
- Deploy Vercel produção: ✅
- URL ativa: `https://compras-coletivas-phi.vercel.app`
- Verificações no ar:
  - `GET /api/db/health` → `200`
  - `GET /api/db/pedidos/por-usuario` sem sessão → `401`
  - fluxo real comprador temporário: cadastro → pedido → histórico → cancelamento ✅

## 🔄 Atualização 2026-04-08 00:32 UTC

**Status:** ✅ CORREÇÕES CONCLUÍDAS

### O que foi feito (CORREÇÕES PENDENTES)

#### 1. ✅ Senha admin hardcoded removida (ISSUE ALTA)
- **Problema:** Fallback hardcoded `admin123` no `/api/db.js` na rota `admin/login`
- **Solução:** Removido o fallback. Agora retorna erro 500 se senha de admin não estiver configurada no banco
- **Impacto de segurança:** Elimina credencial padrão em produção
- **Arquivo modificado:** `api/db.js`

#### 2. ✅ Estrutura de arquivos limpa
- Removida pasta `APP COMPRAS COLETIVAS/` (cópias obsoletas de app.js, index.html, produtos.js)
- `index.html` atualizado (v5.1 com toggle de password) copiado para `public/`
- Estrutura final: `public/` → arquivos estáticos (Vercel), `api/` → serverless, `data/` → planilhas

#### 3. ✅ Deploy em produção
- Commit: `64c85b9` — "fix: remove admin password fallback and clean up file structure"
- Push para GitHub: ✅
- Deploy Vercel: automático via git integration
- URL: `https://compras-coletivas-git-main-eliandro-tjader.vercel.app`

### Issues resolvidas:
- [x] Senha admin hardcoded (Alta)
- [x] Arquivos duplicados (Baixa)

### Issues pendentes:
- [ ] GitHub Actions Neon — workflow obsoleto (não encontrado, pode já ter sido deletado)
- [ ] Excel no Edge Runtime — `upload-planilha.js` não processa .xlsx de fato (Média)
- [ ] Faixas progressivas — Frontend não aplica faixas do banco (Média)

---

## 🔄 Atualização 2026-04-07 21:37 UTC

**Status:** ✅ CONCLUÍDA

### O que foi feito

#### 1. Agrupamento de Categorias no Banco ✅
- Criadas 5 novas categorias agrupadas:
  - **COLÁGENOS** (id 208): unifica COLAGENTEK, PROTEIN, II, BEAUTY, HYALURONIC HAIR
  - **WHEY PROTEIN** (id 209): unifica WHEY FORT, WPC POUCH, ISOCRISP WHEY, ISOLATE, AIR COM WHEY
  - **VITAMINAS E MINERAIS** (id 210): unifica VITA D3, C3, FERRO/MAGNÉSIO/CÁLCIO PLUS, COQ-10
  - **AMINOÁCIDOS, CREATINA E GLUTAMINA** (id 211): unifica AMINOVITA, BCAAFORT, GLUTAMAX, CREATINE, CREAFORT, BETA ALANINA
  - **ÔMEGA 3** (id 212): unifica OMEGAFOR PLUS/FAMILY/VITAMINS, MEGA DHA, KRILL VIT
- 31 categorias antigas excluídas após migração dos produtos

#### 2. Fluxo de Cadastro Obrigatório ✅
- Adicionado `isRegistered: false` no objeto `app`
- Modal de cadastro aparece na primeira interação com o carrinho
- Validação: nome completo (deve ter sobrenome) + telefone
- Dados salvos no localStorage (`userRegistered`, `registeredName`, `registeredPhone`)
- Bloqueio de adição ao carrinho e finalização sem cadastro
- Aba "Meu Pedido" mostra card com dados do cadastro confirmado
- CSS do modal e card de registro adicionados ao index.html

#### 3. Produtos com Imagens Corrigidas ✅
- Removidas imagens incorretas dos produtos COQ10 (CQ30, CQ60, CQ120, COQ60)
  - Esses tinham badges de dosagem ("100mg/200mg por cápsula") em vez de fotos
  - Imagens limpas → produtos agora aparecem sem foto (placeholder)
- Produtos VPA600CCT e VPA280CCT (LANÇAMENTO) mantidos com imagem real (~4KB)
  - Têm foto real de produto, não o selo dourado

### Arquivos Modificados
- `/root/projects/compras-coletivas/public/app.js` — cadastro obrigatório + toggle de visualização de senha
- `/root/projects/compras-coletivas/index.html` — estilos do modal de registro + toggle de senha
- `/root/projects/compras-coletivas/public/produtos.js` — imagens COQ10 removidas
- Banco de dados Supabase — categorias agrupadas

---

## 🔄 Migração Neon → Supabase (2026-04-07)

**Status:** ✅ CONCLUÍDA

### O que foi feito
- Schema isolado `compras_coletivas` criado no Supabase (projeto fitflow-ia)
- 244 produtos + 103 categorias populados
- Coluna `imagem` corrigida: `VARCHAR(500)` → `TEXT`
- Tabela `faixas_desconto` criada (40/44/48%)
- API `db.js` e `upload-planilha.js`: search_path via connection string
- Env var `DATABASE_URL` atualizada no Vercel
- `.env.local` removido do git (estava exposto com senha)

### Credenciais
- **Supabase:** `postgresql://postgres.vpmfuhvgnbqovclwaudz:*Glockblss213@aws-0-us-west-2.pooler.supabase.com:5432/postgres`
- Schema: `compras_coletivas`

### Deploy
- URL: compras-coletivas-ct345rzrw-eliandro-tjader.vercel.app
- Status: READY

---

## Contexto

App de compras coletivas para produtos Vitafor. O grupo já está formado com 23 participantes.

---

## Estado Atual (2026-04-07 12:50 UTC)

### ✅ Planilha Processada e Analisada

**Arquivo:** `/root/projects/compras-coletivas/data/TABELA_DE_PEDIDO_VITAFOR_2026_14.xlsx`

**Conteúdo Extraído:**
- **Aba VITA:** 220 produtos (ex: AM240LI, AGF30, BF210LI)
- **Aba VITAPOWER:** 24 produtos (ex: VPI1005TR, VPP1005BB)
- **Total:** 244 produtos

**Estrutura da planilha:**
- Códigos de produto (ex: AM240LI, AGF30, BF210LI)
- Nomes dos produtos com sabor
- Preços brutos por unidade/caixa
- Tabela de descontos por volume:
  - R$1.000-R$2.999,99 = 40%
  - R$3.000-R$7.999,99 = 44%
  - Acima de R$8.000 = 48%
- Quantidade por caixa (embalagem fechada)
- NCM para cada produto

**Dados Processados:**
- **Arquivo JSON:** `/root/projects/compras-coletivas/data/produtos.json` (244 produtos)
- **Script Python:** `/root/projects/compras-coletivas/process_planilha.py`
- **Banco Supabase:** 244 produtos importados na tabela `produtos` (schema `compras_coletivas`)

### ✅ Banco de Dados Configurado

**Schema isolado:** `compras_coletivas` no Supabase (projeto fitflow-ia)

**Tabelas:**
- `categorias` — 103 categorias de produtos
- `produtos` — 244 produtos com códigos, nomes, preços, categorias
- `descontos` — 103 registros de descontos por categoria
- `faixas_desconto` — 3 faixas progressivas (40/44/48%)
- `compradores` — cadastro de compradores (nome, telefone, email)
- `pedidos` — pedidos consolidados
- `itens_pedido` — itens de cada pedido

**Views:**
- `vw_dashboard_stats` — estatísticas gerais (total pedidos, descontos, etc.)
- `vw_relatorio_produtos` — relatório de produtos vendidos
- `vw_relatorio_compradores` — relatório por comprador

### ✅ API Vercel Edge Functions

**Endpoints implementados:**
- `GET /api/db` — health check
- `GET /api/db/produtos` — listar produtos
- `GET /api/db/pedidos` — listar pedidos
- `GET /api/db/pedidos/consolidado` — relatório consolidado
- `GET /api/db/descontos` — listar descontos
- `GET /api/db/faixas-desconto` — listar faixas progressivas
- `GET /api/db/categorias` — listar categorias
- `GET /api/db/compradores` — listar compradores
- `POST /api/db/pedidos` — criar pedido
- `POST /api/db/descontos` — aplicar desconto
- `DELETE /api/db/pedidos` — apagar todos os pedidos
- `DELETE /api/db/descontos` — limpar descontos

### ✅ Frontend (v5.1)

**Arquivos:**
- `public/index.html` — interface principal
- `public/app.js` — lógica da aplicação (736 linhas)
- `public/produtos.js` — catálogo de produtos (gerado da planilha)

**Funcionalidades:**
- Busca de produtos por código ou nome
- Filtro por categorias (pills + grid selector)
- Carrinho de compras com cálculo automático
- Aplicação de descontos por categoria
- Aplicação de faixas progressivas de desconto
- Finalização de pedido
- Login admin (senha configurada no banco)
- Painel admin (relatórios, gerenciar pedidos, descontos)

---

## Pendências

### Segurança — 2026-07-02
- [x] Admin agora autentica no servidor com senha PBKDF2 e sessão em `admin_sessions` expirada em 8h.
- [x] Comprador agora recebe sessão em `buyer_sessions` expirada em 24h; histórico e criação de pedidos exigem Bearer token.
- [x] `POST /api/db/pedidos` grava `comprador_id` e substitui pedido em edição dentro da mesma transação.
- [x] Escritas críticas de pedidos/itens/merge/remoções foram protegidas com `BEGIN/COMMIT/ROLLBACK`.
- [x] CORS deixou de usar wildcard nas APIs e `vercel.json`; allowlist: produção e `localhost:3000`.
- [x] Runtime não executa mais `ensureMigrations()`; nova migration manual: `sql/04_security_sessions.sql`.
- [x] Frontend persiste tokens admin/comprador em `localStorage` + `sessionStorage`, evita pedir novo cadastro a cada reabertura e libera atalho direto para login admin no modal inicial.
- [ ] Executar `sql/04_security_sessions.sql` no Supabase antes do próximo deploy.

### Backend
- [ ] Implementar rota `POST /api/db/upload-planilha` para processar .xlsx
- [ ] Testar integração com Evolution API para envio de pedido

### Frontend
- [ ] Implementar faixas progressivas de desconto no carrinho
- [ ] Adicionar modal de confirmação antes de finalizar pedido

### Infraestrutura
- [ ] Configurar domínio personalizado no Vercel
- [ ] Otimizar imagens (WebP)

---

## Decisões

### Faixas de Desconto
- **R$1.000-R$2.999,99** → 40%
- **R$3.000-R$7.999,99** → 44%
- **Acima de R$8.000** → 48%

### Categorias Agrupadas
Para melhorar UX, categorias semelhantes foram agrupadas:
- COLÁGENOS: COLAGENTEK, PROTEIN, II, BEAUTY, HYALURONIC HAIR
- WHEY PROTEIN: WHEY FORT, WPC POUCH, ISOCRISP WHEY, ISOLATE, AIR COM WHEY
- VITAMINAS E MINERAIS: VITA D3, C3, FERRO/MAGNÉSIO/CÁLCIO PLUS, COQ-10
- AMINOÁCIDOS, CREATINA E GLUTAMINA: AMINOVITA, BCAAFORT, GLUTAMAX, CREATINE, CREAFORT, BETA ALANINA
- ÔMEGA 3: OMEGAFOR PLUS/FAMILY/VITAMINS, MEGA DHA, KRILL VIT

---

## Próximos Passos

1. Testar aplicação completa no grupo WhatsApp
2. Configurar agente `guia-compras` (binding pendente)
3. Implementar upload de planilha no backend
4. Integrar com Evolution API para notificações

## Atualização — 2026-07-24 — barra de progresso do desconto

- Corrigida a separação entre posição visual da barra (`selectDiscountTier`, baseada no `total_final`) e desconto efetivamente aplicado (`resolveDiscountTier`, com retenção).
- A barra agora mantém a próxima meta e o progresso coerentes quando o pricing retém uma faixa superior; abaixo de R$ 8.000 líquidos, `maximo_alcancado` permanece falso.
- O retorno de criação de pedido passou a informar o percentual efetivamente aplicado, evitando divergência no pedido salvo localmente.
- Testes: 121 aprovados; build/deploy de produção validado e endpoint público respondendo com o novo contrato.

## Atualização 06/09/2026 — revisão de performance e diagnóstico de região

**Status:** publicado e validado em produção.

- Diagnóstico confirmado: banco do app em Supabase `aws-0-us-west-2` (Oregon,
  EUA) — projeto `vpmfuhvgnbqovclwaudz`, pooler `aws-0-us-west-2.pooler.supabase.com`.
  `/api/db/health` em produção levando ~2,2s (função Vercel nos EUA + DB nos EUA,
  duplo travessia). Causa raiz da lentidão de abas/carregamento, mesmo padrão do
  fitflow antes da migração para sa-east-1.
- Banco contém 247 produtos e 31 pedidos; nenhum dado foi alterado.
- Melhoria publicada (segura): stale-while-revalidate no histórico — ao trocar de
  aba, a última visão renderizada aparece instantaneamente e os dados frescos
  substituem ao concluir. Testes locais 124 aprovados, `vercel build` OK.
- Commit `c8fe8a2` publicado; deployment `dpl_4fgSo6MUJAu4FMvJPez14Pb3agGs` READY.
- Pendente aprovação do Eliandro: migrar banco Supabase us-west-2 → sa-east-1
  (com dump/restore e validação) e fixar região das funções Vercel em gru1.

## Atualização 06/09/2026 — checkpoint e migração aditiva para sa-east-1

**Status:** cutover concluído e validado em produção.

- Checkpoint Git local: tag `rollback/2026-09-06-before-sa-east-1` apontando para `c8fe8a2`.
- Backup lógico da origem criado e validado com `pg_restore --list`.
- Origem preservada em Supabase `us-west-2`; nenhum registro alterado ou removido.
- Como o projeto FitFlow já possui Supabase em `sa-east-1`, foi criado de forma aditiva o schema isolado `compras_coletivas_20260906`, sem tocar no schema existente `compras_coletivas`.
- Validação origem → destino: categorias 76/76, produtos 247/247, compradores 39/39, ciclos 2/2, configurações 4/4, descontos 1/1, faixas 3/3, pedidos 31/31, itens 143/143, pagamentos 31/31, sessões/auditoria preservadas com contagens idênticas.
- Rollback do banco: manter a origem ativa ou remover apenas o schema novo `compras_coletivas_20260906`; o dump permanece em `backups/2026-09-06-c8fe8a2/`.
- `POSTGRES_URL` e `POSTGRES_CONNECTION_STRING` de produção atualizados para o pooler `sa-east-1`, com `POSTGRES_SCHEMA=compras_coletivas_20260906`.
- `api/db.js` e `api/pin-recovery-request.js` passaram a selecionar o schema por variável validada, mantendo o fallback local `compras_coletivas`.
- Commit `085048f` publicado no GitHub; deployment de produção `READY` no alias canônico.
- Validação pós-cutover: schema destino retornando `31` pedidos, `143` itens, `31` pagamentos e `247` produtos; origem preservada com as mesmas contagens.
- Smoke no ar: health `200`; progresso público para o ciclo ativo retornando `total_final=8148.66` e `48%`; ciclo histórico também conferido.
- Funções Node sensíveis publicadas em `gru1`; `api/db` permanece Edge global, executando próximo do usuário, enquanto o banco está em São Paulo.

## Atualização 06/09/2026 — auditoria de performance e segurança (rodada 1)

**Status:** implementada, publicada e validada em produção.

- Auditoria independente identificou que o polling público de `desconto-progresso` podia executar auto-healing com transação, lock global e reprecificação de todo o ciclo.
- O GET agora é estritamente somente leitura; reprecificação continua restrita às mutações transacionais.
- Consultas de ciclo histórico exigem sessão administrativa; o ciclo ativo continua público e agregado.
- Health e listagem de tabelas passaram a respeitar `POSTGRES_SCHEMA` configurado.
- Gates: 124 testes aprovados, `git diff --check` e sintaxe validados.
- Produção: health `200`, progresso ativo `200`, ciclo histórico sem sessão `401`, deployment `READY`.
- Commit: `d435ac0`.

### Backlog priorizado da auditoria

- **P0:** validar preço/código no endpoint admin de inclusão de item; hoje o navegador ainda envia valores de preço que devem ser recalculados pelo catálogo.
- **P1:** corrigir preços exibidos no `lastOrder` imediatamente após finalizar pedido.
- **P1:** isolar chaves de `localStorage` por comprador/sessão.
- **P1:** medir `EXPLAIN ANALYZE` e criar índices compostos conforme plano real antes de otimizar queries.

## Atualização 06/09/2026 — auditoria de performance e segurança (rodada 2)

**Status:** implementada, publicada e validada em produção.

- Inclusão de item pelo admin agora aceita somente código e quantidade; preço, nome e categoria são buscados e validados no catálogo server-side.
- Quantidades inválidas ou acima de 99 são rejeitadas também quando somadas a um item existente.
- `lastOrder` agora recebe o preço canônico do catálogo, evitando valores zerados logo após o envio.
- Carrinho, desconto e último pedido foram isolados por comprador no `localStorage`; logout limpa os dados locais do comprador atual.
- Gates: 125 testes aprovados, sintaxe e `git diff --check` validados.
- Smoke no ar: health `200`, progresso ativo `200`, histórico sem sessão `401`, deployment `READY`.
- Commit: `d815a9d`.

## Atualização 06/09/2026 — índices e benchmark SQL

**Status:** migração aplicada e validada nos bancos ativo e de rollback.

- `EXPLAIN (ANALYZE, BUFFERS)` medido no schema brasileiro para painel, consolidação e progresso.
- Com 31 pedidos, o PostgreSQL escolhe corretamente `Seq Scan`: leituras de aproximadamente `0,07–0,64 ms`; forçar índice seria pior neste volume.
- Criados índices parciais para ciclo ativo e para histórico por comprador/data, preparados para crescimento sem alterar dados.
- A mesma migração foi aplicada na origem preservada para manter o rollback equivalente.
- SQL versionado em `sql/10_performance_indexes.sql`.
