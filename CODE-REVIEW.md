# Code Review — compras-coletivas

## 1. Sumário executivo

Revisão estática dos arquivos principais do projeto:

- [api/db.js](/root/projects/compras-coletivas/api/db.js:1)
- [public/app.js](/root/projects/compras-coletivas/public/app.js:1)
- [public/index.html](/root/projects/compras-coletivas/public/index.html:1)
- [public/styles.css](/root/projects/compras-coletivas/public/styles.css:1)
- [vercel.json](/root/projects/compras-coletivas/vercel.json:1)
- [sql/01_schema_supabase.sql](/root/projects/compras-coletivas/sql/01_schema_supabase.sql:1)

Diagnóstico geral: o produto está funcional do ponto de vista de fluxo, mas hoje o backend não tem controles mínimos aceitáveis de autorização. O maior risco não é cosmético: qualquer pessoa com acesso à URL da API consegue ler dados de compradores, consultar histórico, alterar descontos, editar pedidos, apagar pedidos e mexer no controle de pagamentos sem autenticação server-side.

Resumo do risco:

- 3 issues `CRÍTICOS`
- 8 issues `IMPORTANTES`
- 2 issues `MENORES`
- 3 `SUGESTÕES`

Se eu tivesse que resumir em uma frase: o principal gargalo do projeto não é layout nem performance; é segurança e integridade de dados.

## 2. Issues por severidade

### Críticos

1. `[CRÍTICO]` Rotas administrativas e relatórios sensíveis estão públicas no backend

Problema: a API não faz nenhuma checagem server-side de admin antes de servir dados sensíveis ou aceitar mutações. O frontend esconde botões, mas o backend aceita chamadas diretas para leitura e escrita. Além disso, o CORS está aberto para qualquer origem.

Impacto esperado: qualquer pessoa pode ler PII de compradores, ver histórico e pagamentos, alterar descontos, editar pedidos, remover itens, apagar todo o histórico e manipular o painel financeiro apenas chamando `/api/db/*`.

Evidências: [api/db.js](/root/projects/compras-coletivas/api/db.js:164), [api/db.js](/root/projects/compras-coletivas/api/db.js:196), [api/db.js](/root/projects/compras-coletivas/api/db.js:208), [api/db.js](/root/projects/compras-coletivas/api/db.js:270), [api/db.js](/root/projects/compras-coletivas/api/db.js:277), [api/db.js](/root/projects/compras-coletivas/api/db.js:327), [api/db.js](/root/projects/compras-coletivas/api/db.js:456), [api/db.js](/root/projects/compras-coletivas/api/db.js:560), [api/db.js](/root/projects/compras-coletivas/api/db.js:588), [api/db.js](/root/projects/compras-coletivas/api/db.js:806), [vercel.json](/root/projects/compras-coletivas/vercel.json:8).

Solução proposta: implementar autenticação server-side real e usar middlewares por papel.

```js
function requireAdmin(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const session = verifyAdminSession(token);
  if (!session) return json({ success: false, error: "Não autorizado" }, 401);
  return session;
}
```

Aplicação prática: exigir `requireAdmin()` em `/pedidos`, `/pedidos/por-usuario`, `/compradores*`, `/pagamentos*`, `/descontos`, `/exportar-csv` e todas as rotas `PUT/DELETE` administrativas. Em paralelo, trocar `Access-Control-Allow-Origin: *` por allowlist do domínio de produção.

2. `[CRÍTICO]` Histórico do comprador e bootstrap de PIN permitem exposição de conta e takeover

Problema: `GET /pedidos/historico` devolve pedidos com base em `usuario` e só exige telefone se ele vier na query. Em paralelo, o login do comprador busca por `nome OR telefone` com `LIMIT 1`; se o registro ainda não tiver `pin_hash`, o próprio login define o PIN na hora. O frontend ainda considera o usuário “registrado” só pelo que existir no `localStorage`.

Impacto esperado: um atacante que conheça nome ou telefone pode:

- consultar histórico alheio;
- assumir uma conta antiga sem PIN;
- cair em um comprador errado por causa do `OR ... LIMIT 1`;
- sincronizar pedidos de terceiros no navegador sem autenticação robusta.

Evidências: [api/db.js](/root/projects/compras-coletivas/api/db.js:290), [api/db.js](/root/projects/compras-coletivas/api/db.js:297), [api/db.js](/root/projects/compras-coletivas/api/db.js:471), [api/db.js](/root/projects/compras-coletivas/api/db.js:519), [public/app.js](/root/projects/compras-coletivas/public/app.js:303), [public/app.js](/root/projects/compras-coletivas/public/app.js:980), [public/app.js](/root/projects/compras-coletivas/public/app.js:1222), [public/app.js](/root/projects/compras-coletivas/public/app.js:2491).

Solução proposta: histórico deve ser servido apenas para o comprador autenticado no backend, usando um identificador estável do comprador. O login deve exigir combinação exata de identidade, e o “primeiro PIN” deve sair do fluxo de login e ir para um fluxo separado de recuperação/ativação.

```js
// Em vez de aceitar usuario/telefone por query:
const buyer = requireBuyer(req);
const rows = await client.query(
  "SELECT ... FROM pedidos WHERE comprador_id = $1 ORDER BY created_at DESC",
  [buyer.id]
);
```

3. `[CRÍTICO]` Senha de administrador em texto puro, com valor default fraco

Problema: a senha admin é buscada como texto em `configuracoes` e comparada por igualdade simples. O schema ainda semeia `admin123` como valor padrão.

Impacto esperado: vazamento de banco ou leitura indevida da tabela de configurações compromete o painel inteiro imediatamente. Também não há proteção real contra brute force, auditoria ou rotação segura.

Evidências: [api/db.js](/root/projects/compras-coletivas/api/db.js:573), [sql/01_schema_supabase.sql](/root/projects/compras-coletivas/sql/01_schema_supabase.sql:121), [sql/01_schema.sql](/root/projects/compras-coletivas/sql/01_schema.sql:128).

Solução proposta: migrar para hash Argon2id ou bcrypt, remover senha default do schema, mover bootstrap inicial para env/secret de deploy e adicionar rate limit no endpoint de login admin.

### Importantes

4. `[IMPORTANTE]` A API roda “migration” destrutiva em tempo de request e pode apagar compradores legítimos

Problema: `ensureMigrations()` é executada no caminho de request, deleta duplicatas agrupando apenas por `nome`, recria índices e engole erro com `console.error` sem falhar o boot.

Impacto esperado: dois membros com mesmo nome podem perder cadastro, PIN, telefone ou e-mail. Em produção, um cold start pode alterar dados sem trilha explícita e sem transação.

Evidências: [api/db.js](/root/projects/compras-coletivas/api/db.js:44).

Solução proposta: remover migrations do runtime da API e substituí-las por migration versionada. Nunca fazer `DELETE` automático por nome para “corrigir” dados em produção.

5. `[IMPORTANTE]` Escritas críticas não usam transação e abrem espaço para corrupção parcial e race conditions

Problema: criação de pedido, merge de pedidos, edição de quantidades, remoção global de produto e reenvio de pedido editado são multi-step e não usam `BEGIN/COMMIT`. A proteção contra duplicados também é `SELECT` antes de `INSERT`, sem constraint transacional.

Impacto esperado: falhas intermediárias deixam pedido sem itens, itens sem total recalculado, duplicação em concorrência e perda de dados quando rede/DB oscila.

Evidências: [api/db.js](/root/projects/compras-coletivas/api/db.js:385), [api/db.js](/root/projects/compras-coletivas/api/db.js:643), [api/db.js](/root/projects/compras-coletivas/api/db.js:683), [api/db.js](/root/projects/compras-coletivas/api/db.js:753), [public/app.js](/root/projects/compras-coletivas/public/app.js:1251), [public/app.js](/root/projects/compras-coletivas/public/app.js:1352).

Solução proposta: encapsular fluxos críticos em transações e adicionar constraints que façam o banco proteger a consistência.

```js
await client.query("BEGIN");
try {
  // insert pedido
  // insert itens
  // update totais
  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
}
```

6. `[IMPORTANTE]` Módulo de pagamentos está em deriva de schema e tende a quebrar em ambiente novo

Problema: a API atualiza `parc4` e `parc5` mesmo após a decisão de limitar a 3 parcelas. Além disso, os arquivos principais de schema não criam a tabela `pagamentos`.

Impacto esperado: editar pagamento pode retornar erro se as colunas já foram removidas. Novo ambiente ou rebuild completo não consegue subir o módulo financeiro só com os SQLs versionados.

Evidências: [api/db.js](/root/projects/compras-coletivas/api/db.js:598), [sql/01_schema_supabase.sql](/root/projects/compras-coletivas/sql/01_schema_supabase.sql:45), [sql/01_schema.sql](/root/projects/compras-coletivas/sql/01_schema.sql:52). Busca textual no diretório `sql/` não encontrou DDL para `pagamentos`.

Solução proposta: criar migration explícita da tabela `pagamentos`, manter apenas `parc1..parc3` no backend e versionar o schema real usado em produção.

7. `[IMPORTANTE]` Falha de API é tratada como “pedido salvo localmente” e o carrinho é limpo

Problema: quando a chamada a `POST /pedidos` falha, o frontend mostra “Pedido salvo localmente”, cria `lastOrder` local e esvazia o carrinho mesmo sem confirmação do servidor.

Impacto esperado: comprador acredita que entrou na compra coletiva, mas o pedido pode nunca ter chegado ao banco. Esse é um bug de negócio, não só de UX.

Evidências: [public/app.js](/root/projects/compras-coletivas/public/app.js:1397), [public/app.js](/root/projects/compras-coletivas/public/app.js:1411).

Solução proposta: só limpar carrinho e gerar comprovante quando houver `res.success === true`. Em falha, manter carrinho intacto e oferecer retry explícito.

8. `[IMPORTANTE]` Erros internos do backend vazam detalhes sensíveis ao cliente

Problema: o `catch` final devolve `error.message` diretamente na resposta JSON.

Impacto esperado: um atacante consegue inferir nome de tabela, coluna ausente, detalhe de migration e outras pistas internas úteis para exploração.

Evidências: [api/db.js](/root/projects/compras-coletivas/api/db.js:879).

Solução proposta: responder com mensagem genérica para o cliente e logar o detalhe apenas no servidor, idealmente com `requestId`.

9. `[IMPORTANTE]` Modelo de identidade usa `nome` como chave operacional e isso é frágil

Problema: o schema tenta tornar `nome` único, `pedidos` guarda `usuario` como texto livre e os joins do relatório usam `c.nome = p.usuario`. Isso mistura identidade com atributo editável e não lida com homônimos.

Impacto esperado: homônimos colidem, alterações de nome quebram vínculo, relatórios puxam telefone/e-mail do comprador errado e correções manuais ficam perigosas.

Evidências: [api/db.js](/root/projects/compras-coletivas/api/db.js:63), [api/db.js](/root/projects/compras-coletivas/api/db.js:231), [api/db.js](/root/projects/compras-coletivas/api/db.js:318), [sql/01_schema_supabase.sql](/root/projects/compras-coletivas/sql/01_schema_supabase.sql:45), [sql/01_schema_supabase.sql](/root/projects/compras-coletivas/sql/01_schema_supabase.sql:71).

Solução proposta: usar `comprador_id` como chave de domínio real em todos os pedidos e relatórios; `nome` deve virar atributo, não identificador.

10. `[IMPORTANTE]` Exportações CSV/Excel carregam PII e aceitam conteúdo perigoso para planilhas

Problema: o backend concatena CSV manualmente e o frontend exporta dados do comprador sem neutralizar células iniciadas por `=`, `+`, `-` ou `@`. Como nome, e-mail e produto entram no arquivo, isso abre vetor clássico de formula injection ao abrir no Excel.

Impacto esperado: macro/fórmula maliciosa em planilhas exportadas, além de vazamento desnecessário de PII em relatórios amplos.

Evidências: [api/db.js](/root/projects/compras-coletivas/api/db.js:352), [public/app.js](/root/projects/compras-coletivas/public/app.js:2216), [public/app.js](/root/projects/compras-coletivas/public/app.js:2261).

Solução proposta: escapar CSV corretamente, prefixar células potencialmente perigosas com `'` e oferecer exportações separadas para fornecedor e para operação interna.

11. `[IMPORTANTE]` Busca por telefone/nome não está bem indexada e degrada com crescimento da base

Problema: login e histórico usam `LOWER(nome)` e `regexp_replace(telefone, ...)`, mas o schema não define índice funcional para telefone normalizado. O relatório por comprador também agrega JSON e arrays sobre joins completos sem paginação.

Impacto esperado: com crescimento de compradores/pedidos, login, histórico e painel admin tendem a virar full scans e agregações pesadas.

Evidências: [api/db.js](/root/projects/compras-coletivas/api/db.js:530), [api/db.js](/root/projects/compras-coletivas/api/db.js:298), [sql/03_pin_comprador.sql](/root/projects/compras-coletivas/sql/03_pin_comprador.sql:8), [api/db.js](/root/projects/compras-coletivas/api/db.js:208).

Solução proposta: armazenar `telefone_normalizado`, indexá-lo, indexar `LOWER(nome)` de forma oficial via migration e paginar relatórios administrativos.

12. `[IMPORTANTE]` Sessão admin depende de `localStorage`, sem expiração nem validação de servidor

Problema: o frontend restaura `isAdminLoggedIn` só lendo um booleano do `localStorage`.

Impacto esperado: qualquer pessoa no mesmo navegador pode “voltar logada” após refresh; também é trivial forçar a abertura da UI admin mesmo sem sessão real. Mesmo depois de corrigir o backend, isso continuaria sendo um estado enganoso.

Evidências: [public/app.js](/root/projects/compras-coletivas/public/app.js:172), [public/app.js](/root/projects/compras-coletivas/public/app.js:2554).

Solução proposta: usar sessão curta emitida pelo backend em cookie `HttpOnly`, e revalidar no carregamento da página.

13. `[IMPORTANTE]` O reenvio de pedido editado apaga o pedido antigo antes de garantir que o novo foi criado

Problema: ao editar, o frontend remove o pedido antigo e só depois chama `finalizeOrder()`. Se a segunda etapa falhar, o comprador perde o pedido.

Impacto esperado: perda total de pedido em cenário real de instabilidade ou timeout.

Evidências: [public/app.js](/root/projects/compras-coletivas/public/app.js:1251).

Solução proposta: trocar para fluxo transacional no backend: “substituir pedido” em uma única operação atômica.

### Menores

14. `[MENOR]` No mobile, a coluna de quantidade da fatura some e o ajuste direto de qty fica escondido

Problema: em telas até `768px`, a segunda coluna da `invoice-table` é ocultada, que é justamente a coluna com controles de quantidade.

Impacto esperado: em celular, o usuário perde a forma mais óbvia de corrigir o pedido dentro da própria fatura.

Evidências: [public/styles.css](/root/projects/compras-coletivas/public/styles.css:904).

Solução proposta: no mobile, transformar a linha da fatura em card empilhado ou manter os controles de qty visíveis.

15. `[MENOR]` “Apagar pedidos” e “Apagar histórico” executam a mesma rota destrutiva

Problema: os dois botões do admin chamam `DELETE /pedidos`, mas os rótulos sugerem operações diferentes.

Impacto esperado: risco operacional de apagar mais do que o admin imaginava.

Evidências: [public/app.js](/root/projects/compras-coletivas/public/app.js:2089), [public/app.js](/root/projects/compras-coletivas/public/app.js:2097).

Solução proposta: diferenciar semanticamente as ações ou remover a duplicidade de CTA.

### Sugestões

16. `[SUGESTÃO]` Quebrar o frontend monolítico antes da próxima rodada grande de features

Problema: `public/app.js` já tem 2584 linhas e mistura autenticação, catálogo, carrinho, histórico, admin e pagamentos no mesmo objeto. `public/styles.css` também já passou de 1300 linhas.

Impacto esperado: qualquer mudança futura fica mais arriscada, mais lenta de revisar e com maior chance de regressão lateral.

Evidências: contagem atual via `wc -l` mostra [public/app.js](/root/projects/compras-coletivas/public/app.js:1) com 2584 linhas e [public/styles.css](/root/projects/compras-coletivas/public/styles.css:1) com 1379 linhas.

Solução proposta: separar ao menos em `api-client.js`, `auth.js`, `cart.js`, `admin.js`, `payments.js`, `history.js` e módulos de render.

17. `[SUGESTÃO]` Versionar grants/policies do banco explicitamente

Problema: os SQLs principais não trazem `GRANT`s explícitos nem policies versionadas.

Impacto esperado: o ambiente fica dependente de configuração manual e foge do padrão esperado para Supabase.

Evidências: busca por `GRANT`, `POLICY` e `RLS` em `sql/` não retornou resultados.

Solução proposta: versionar grants mínimos e documentar claramente que o backend usa credencial privilegiada apenas no servidor.

18. `[SUGESTÃO]` Reduzir dependência de CDN externo para a planilha

Problema: o `xlsx.full.min.js` vem de CDN pública sem `integrity` nem bundle local.

Impacto esperado: dependência externa a cada carga e superfície extra de supply chain.

Evidências: [public/index.html](/root/projects/compras-coletivas/public/index.html:10).

Solução proposta: empacotar a dependência no build ou servir asset versionado localmente com verificação de integridade.

## 3. Plano de ação priorizado

1. Fechar a superfície crítica agora.
   Implementar auth server-side para admin e comprador, exigir sessão em todas as rotas sensíveis e restringir CORS ao domínio oficial.

2. Corrigir exposição e takeover de comprador.
   Reescrever login/histórico para operar por `comprador_id` autenticado, remover bootstrap de PIN dentro do login e revisar o modelo de identidade.

3. Remover segredos frágeis.
   Tirar `admin_senha` em texto puro do banco, migrar para hash forte e adicionar rate limiting.

4. Consertar integridade transacional.
   Colocar transações em criação/edição/merge/substituição de pedido e substituir a trava de duplicado por constraint/lock seguro.

5. Alinhar schema real com o código.
   Versionar a tabela `pagamentos`, remover `parc4/parc5` do backend e abandonar migrations destrutivas em runtime.

6. Corrigir UX de falha operacional.
   Em falha de API, não limpar carrinho nem gerar comprovante local enganoso.

7. Refatorar a base para manutenção.
   Fatiar `app.js` e organizar responsabilidades por domínio.

## 4. Quick wins

- Bloquear imediatamente todas as rotas admin com um guard server-side, mesmo que temporário.
- Rejeitar `GET /pedidos/historico` sem sessão autenticada; como mitigação emergencial, ao menos exigir telefone exato e remover acesso por nome isolado.
- Trocar `return json({ success: false, error: error.message }, 500)` por mensagem genérica.
- Remover `parc4` e `parc5` do `UPDATE pagamentos`.
- Não limpar o carrinho quando `POST /pedidos` falhar.
- Substituir `Access-Control-Allow-Origin: *` por allowlist de produção.

## 5. Veredito

O projeto precisa de hardening antes de ser tratado como seguro em produção. A correção prioritária não é estética nem refactor amplo: é fechar autorização no backend, proteger identidade do comprador e tornar as operações de pedido transacionais.
