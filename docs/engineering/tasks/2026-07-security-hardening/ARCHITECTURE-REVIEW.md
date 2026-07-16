# Revisão adversarial de arquitetura — security hardening

**Revisor independente:** arquitetura e segurança  
**Escopo revisado:** `PLAN.md`, `ACCEPTANCE.md`, `api/db.js`, `api/upload-planilha.js`, serviços/rotas de autenticação, schemas, SPA e testes existentes.  
**Veredito:** **BLOQUEADO PARA IMPLEMENTAÇÃO** até que os bloqueadores abaixo sejam incorporados ao plano. A direção é correta, mas há lacunas de contrato e de consistência transacional que permitiriam uma implementação aparentemente conforme e ainda insegura ou incompatível.

## Achados críticos

### C-01 — A regra de desconto/snapshot não está definida de forma executável

O plano afirma que o pedido deve usar o desconto ativo e que o snapshot do pedido deve ser consistente, mas não fixa a fonte de verdade nem a precedência quando há desconto `todos` e desconto de categoria. No sistema atual, `aplicar_desconto()` grava em `descontos` e também recalcula itens de pedidos já existentes; já existem ainda `faixas_desconto`, embora a SPA hoje use `descontos`. Não há garantia de unicidade para uma regra ativa por categoria, e `produtos.codigo` tampouco é único no schema.

Sem uma regra única, duas implementações válidas do texto podem cobrar valores diferentes. Pior: o lock sugerido não basta se `POST /descontos` continuar chamando `aplicar_desconto()` fora de uma transação que adquira o mesmo lock; o pedido pode ler uma política e a função alterar snapshots concorrentes.

**Correção exigida antes de implementar:** acrescentar uma seção normativa ao plano e à API que determine, sem alternativas:

1. se `faixas_desconto` participa ou fica explicitamente fora deste fluxo;
2. a chave canônica da categoria (`categorias.slug` ou o campo legado `descontos.categoria`) e uma regra única de precedência, incluindo empate/duplicidade;
3. se uma alteração de desconto pode recalcular pedidos já criados. A recomendação é: **não recalcular snapshots de pedidos**; a alteração vale só para pedidos novos e alterações administrativas explicitamente reprecificadas;
4. que `POST /descontos` execute `BEGIN`, adquira o mesmo `pg_advisory_xact_lock` usado pela criação/edição de pedidos, grave a política e faça `COMMIT`; e
5. a migração/adaptação que impeça mais de uma regra ativa para a mesma categoria (ou a consulta determinística que rejeite ambiguidade), além de a consulta de catálogo rejeitar códigos duplicados ativos.

O teste concorrente deve executar de fato a mutação de desconto e a criação de pedido em duas conexões distintas e provar que o pedido inteiro usou uma única versão da política.

## Achados altos

### H-01 — O plano não cobre integralmente as rotas autenticadas e quebra o contrato da recuperação de PIN

As rotas de recuperação não estão todas no mesmo adaptador: `api/pin-recovery-request.js` é Node e `comprador/pin-recovery/complete` é pública, enquanto a troca autenticada de PIN cria hoje uma sessão nova. O plano exige cookies para “troca/recuperação de PIN”, mas não determina qual resposta emite a sessão/cookies após recuperação nem como são limpos os cookies do navegador que representam sessões já revogadas. Também não enumera todas as mutações: logout, recuperação administrativa, pagamentos, descontos, operações de pedido, upload e os DELETEs precisam de decisão de escopo e CSRF explícita.

**Correção exigida:** incluir uma matriz rota × identidade aceita × mutação × CSRF × Origin/fetch metadata × cookies emitidos/limpos. Ela deve conter todas as rotas POST/PUT/DELETE de `api/db.js`, `api/upload-planilha.js` e `api/pin-recovery-request.js`. Determinar que a conclusão pública da recuperação **não** cria sessão; ela revoga sessões no banco, expira os dois cookies de comprador no cliente quando presentes e exige novo login. Para troca autenticada, revogar todas as sessões, criar uma só e substituir os dois cookies em uma resposta. Logout deve exigir CSRF e expirar ambos os cookies do escopo comprador mesmo se a sessão já expirou.

### H-02 — A migração não resolve as garantias de dados necessárias para o novo contrato

`08_security_hardening.sql` é descrita só como migração de CSRF e revogação de sessão. O novo contrato de pedido, porém, depende de `ciclo_id`, catálogo ativo e política de desconto. No schema base, códigos de produto não são únicos e há bancos que podem ter sido criados a partir de versões anteriores; o plano ainda não prevê preflight para duplicidade de códigos, desconto ativo ambíguo, nulos de categorias ou pedidos sem ciclo.

**Correção exigida:** adicionar consultas de preflight que abortem o rollout antes da mudança se houver: mais de um produto ativo para o mesmo código normalizado; regra ativa ambígua para a mesma chave de categoria; pedido/itens sem integridade esperada; ou mais de um ciclo ativo. A migração deve declarar índices necessários à consulta de precificação e só criar constraint/índice único após um procedimento de saneamento aprovado; não deduplicar catálogo automaticamente em produção. A API deve retornar `409` controlado para qualquer ambiguidade remanescente.

### H-03 — Limite de login administrativo está subespecificado para ambiente distribuído/proxy

O serviço existente possui contador persistente reutilizável, mas o plano não fixa a política de extração do IP nem a semântica exata do limite. Em Vercel, confiar cegamente em um cabeçalho encaminhado permite que o atacante escolha o bucket; usar o primeiro/último valor sem política também pode concentrar usuários legítimos. “Bucket global de contenção” não tem tamanho, janela, bloqueio nem comportamento de falha definido.

**Correção exigida:** definir uma função única de IP confiável para Vercel (com precedência exata de cabeçalhos aceitos e rejeição de valor inválido), os parâmetros completos de cada bucket e o instante em que ocorre o bloqueio. Exigir que contador, resposta `429` e `Retry-After` venham da mesma decisão atômica. Se `RATE_LIMIT_HMAC_KEY` estiver ausente ou inválida, login administrativo deve falhar fechado com `503`, sem tentar autenticar. Cobrir em teste concorrência e cabeçalhos forjados.

### H-04 — Contrato browser/cookie ainda é insuficiente para interoperabilidade e limpeza segura

O plano acerta ao usar `__Host-` e `SameSite=Strict`, mas não especifica o adaptador de resposta multi-cookie, a alteração de CORS para `X-CSRF-Token`, nem o comportamento de preview/local. O código atual constrói um objeto de headers e a SPA sempre envia `Content-Type`, inclusive em GET; uma implementação direta pode perder um dos dois `Set-Cookie` ou produzir preflight sem permitir o novo header.

**Correção exigida:** exigir helper de `Response` que use `Headers.append('Set-Cookie', ...)` uma vez por cookie, e testes que leiam ambas as linhas. Atualizar o contrato CORS com `X-CSRF-Token` e definir que a produção opera same-origin no alias canônico; origens de preview não recebem cookies de produção. Para desenvolvimento, permitir apenas origens explicitamente configuradas e falhar fechado quando a origem não constar. Documentar que `Secure` impede teste HTTP local e prever HTTPS local/teste unitário do serializador, em vez de reduzir o atributo.

## Achados médios

### M-01 — Reposição de pedido tem corrida não tratada

O fluxo atual valida `replace_pedido_id`, apaga o pedido e só depois cria o novo. Sem `FOR UPDATE`/controle de versão, duas requisições de edição podem passar na leitura e produzir resultados inesperados. O novo plano não define idempotência nem bloqueio para esse caminho.

**Ajuste recomendado:** bloquear o pedido-alvo com `FOR UPDATE`, validar dono/ciclo/status após o lock e usar uma chave de idempotência por submissão, ou rejeitar uma segunda substituição concorrente com `409`.

### M-02 — Limites de pedido não possuem valores nem defesa de disponibilidade

O plano pede limites “escolhidos pelo Implementer”. Esses valores são parte do contrato de segurança e não devem ficar a critério da implementação.

**Ajuste recomendado:** definir no plano constantes de máximo de itens, quantidade por item e tamanho de corpo; validar antes de abrir transação. Retornar código estável para cada violação.

### M-03 — CSP Report-Only precisa de destino e critério de promoção

Sem `report-uri`/`report-to` atendido, a telemetria de CSP não será utilizável. Como a SPA contém handlers inline, não há critério verificável para a migração futura para bloqueio.

**Ajuste recomendado:** ou não enviar diretiva de reporte nesta release, ou registrar um endpoint/coletor sanitizado e um conjunto mínimo de diretivas com baseline; definir o trabalho separado que remove inline handlers/nonces antes de ativar enforcement.

### M-04 — Upload é hotspot e a documentação atual é contraditória

A rota anuncia Excel, faz parsing multipart manual e não processa XLSX de fato; a documentação ainda anuncia senha/query/header apesar de o código verificar bearer. O plano corretamente exclui XLSX improvisado, mas precisa definir a resposta de migração para clientes existentes.

**Ajuste recomendado:** nesta release aceitar somente JSON estruturado com limite e validação estrita, ou desabilitar a rota com resposta controlada até haver parser testado. Remover CDN `xlsx` da página e todas as alegações de XLSX somente se a exportação do navegador tiver substituto documentado; a dependência de exportação e a rota de upload são fluxos distintos.

## Pontos aprovados

- Remover bearer persistido, separar sessão administrativa/comprador e armazenar somente hashes de sessão no banco é a direção correta.
- Cookies `__Host-`, `HttpOnly`, `Secure`, `SameSite=Strict` e token CSRF independente por escopo formam um desenho apropriado para a SPA same-origin.
- Recalcular preço a partir de catálogo no servidor, usar `NUMERIC` e transações é indispensável e está corretamente priorizado.
- A migração aditiva com revogação de sessões e rollback de aplicação sem tocar pedidos reduz o risco operacional.
- A cadeia de verificação independente, deploy e smoke autenticado está proporcional ao risco.

## Condição de liberação

Após incorporar C-01 e H-01 a H-04 ao plano e aos critérios de aceite, a implementação pode iniciar. Os testes de contrato devem ser escritos antes do código de migração/rota para fixar esses comportamentos e impedir regressões.
