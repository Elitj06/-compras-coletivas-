# Recuperação e alteração de PIN — plano executável

## Enquadramento e retorno

- Objetivo: permitir recuperar um PIN esquecido e alterar o PIN autenticado sem revelar o PIN anterior.
- Risco/lane: `high / release`.
- Deep Architecture: ativa; a mudança atravessa autenticação, dados, sessão, e-mail e interface.
- Repositório canônico: `/root/projects/compras-coletivas`.
- Baseline imutável: commit `02b052449375ef6a5ee5bb53cd2ac1c6c25da684`.
- Mudanças preexistentes fora do escopo, que não serão absorvidas: `SYNC-RESULT.md`, `SYNC-TASK.md` e `scripts/sync_july2026.py`.
- Rollback após ativação: commit da release de compatibilidade, com recuperação desativada. O baseline antigo não é rollback válido depois que qualquer hash for migrado.

## Escopo aprovado

### Jornadas

1. Na tela de login, o comprador escolhe **Esqueci meu PIN**, informa telefone ou e-mail e recebe sempre a mesma resposta pública.
2. Quando o identificador resolve exatamente uma conta e o e-mail pode ser entregue, o comprador recebe um código numérico de 6 dígitos, válido por 10 minutos e uso único.
3. Quando o e-mail não puder ser usado, o administrador valida a identidade por WhatsApp, telefone ou presencialmente e gera um código temporário independente.
4. O comprador autenticado altera seu PIN informando o PIN atual.
5. Recuperação revoga todas as sessões. Alteração autenticada revoga todas e cria apenas uma sessão substituta.

### Não objetivos

- Recuperar, exibir ou enviar o PIN antigo.
- Mesclar cadastros duplicados automaticamente.
- Reestruturar todo o backend/frontend legado nesta entrega.
- Alterar senha administrativa ou credenciais não relacionadas.

## Fatos de produção e regras de identidade

- Existem 34 compradores, 4 grupos de telefone normalizado duplicado e 4 grupos de e-mail normalizado duplicado.
- Recuperação pública só envia código quando o identificador resolve exatamente um comprador. Resultado inexistente, ambíguo, limitado ou com falha de entrega envia nada e mantém resposta pública idêntica.
- Cadastro passa a ser create-only e rejeita telefone ou e-mail equivalente já existente; não sobrescreve comprador.
- `POST /pedidos` deixa de atualizar telefone/e-mail.
- Índices únicos só serão adicionados depois de saneamento manual dos duplicados; não fazem parte desta entrega.

## Contratos

### Público

- `POST /api/db/comprador/pin-recovery/request`
  - Entrada: `{ identificador }`.
  - Saída: sempre `202` com mensagem neutra e `challenge_id` opaco aleatório, inclusive em inexistência, ambiguidade, limite ou falha de entrega.
- `POST /api/db/comprador/pin-recovery/complete`
  - Entrada: `{ challenge_id, code, new_pin }`.
  - Saída válida: PIN alterado, desafio consumido, sessões revogadas; exige login normal depois.
  - Erro público único para código inválido, expirado, usado ou bloqueado.

### Autenticado

- `PUT /api/db/comprador/pin`
  - Entrada: `{ current_pin, new_pin }` com sessão de comprador.
  - Saída: novo token; todas as sessões anteriores deixam de funcionar.
- `POST /api/db/comprador/logout`
  - Exclui somente a sessão apresentada.

### Administrativo

- `POST /api/db/admin/compradores/:id/pin-recovery`
  - Exige sessão admin, `verification_method` e `verification_note`.
  - Retorna uma vez `challenge_id`, código temporário de 6 dígitos e expiração; nunca retorna PIN.
- `GET /api/db/compradores/lista` inclui `id` e `has_pin` para seleção inequívoca.

## Segurança e dados

- PIN novo preserva o contrato existente de 4 a 6 dígitos.
- Novo hash de PIN: PBKDF2-SHA256, 210 mil iterações e salt aleatório, no próprio envelope versionado.
- Login aceita hash legado SHA-256 e PBKDF2; migração do legado só é ligada na release de funcionalidade.
- Código: exatamente 6 dígitos gerados com CSPRNG; banco guarda apenas `HMAC-SHA256(RECOVERY_HMAC_KEY, challenge_id || code)`.
- Desafio: ID opaco de alta entropia, expiração de 10 minutos, máximo de 5 tentativas, uso único e consumo com `SELECT ... FOR UPDATE`.
- Rate limits persistidos por IP e identificador usando HMAC com `RATE_LIMIT_HMAC_KEY`.
- Auditoria guarda evento, comprador quando conhecido, canal, ator administrativo, horário e hash de IP; não guarda PIN, código, token ou identificador em claro.
- Tabelas de recuperação, rate limit e auditoria recebem `REVOKE ALL FROM anon, authenticated` e grants explícitos apenas ao papel necessário à conexão backend.

## E-mail e configuração

- Provedor: Resend por HTTP.
- Variáveis obrigatórias para ativar recuperação por e-mail: `RESEND_API_KEY`, `RECOVERY_FROM_EMAIL`, `APP_BASE_URL`, `RECOVERY_HMAC_KEY`, `RATE_LIMIT_HMAC_KEY`.
- Falha ou ausência do provedor revoga o desafio, registra auditoria sanitizada e mantém o `202` neutro.
- Nenhuma credencial será criada ou alterada sem aprovação explícita do proprietário. Código e migração podem ser preparados com a feature desativada.

## Módulos e escritores

- `api/db.js`: somente despacho das novas rotas e remoção da mutação de identidade em pedidos.
- `api/routes/buyer-auth-routes.js`: validação HTTP e respostas.
- `api/services/buyer-auth-service.js`: regras e transações da jornada.
- `api/data/buyer-auth-data.js`: queries e persistência.
- `api/lib/pin-crypto.js`, `api/lib/rate-limit.js`, `api/lib/recovery-email.js`: primitivas isoladas.
- `public/auth-recovery.js` e `public/auth-recovery.css`: interface das três jornadas.
- `public/app.js` e `public/index.html`: apenas hooks/delegação mínimos.
- `sql/05_pin_recovery.sql` e schemas frescos: migração aditiva e idempotente.
- `docs/API.md`: contratos completos.

Hotspots têm um único escritor durante implementação: `api/db.js`, autenticação nova, migração, UI de conta e documentação.

## Rollout em duas releases

### Release 1 — compatibilidade

1. Aplicar migração aditiva e grants.
2. Publicar verificador dual legado/PBKDF2 com feature de recuperação desativada e sem migração automática.
3. Provar login legado, login PBKDF2 de fixture e ausência de regressão.
4. Registrar o commit/deploy como rollback canônico.

### Release 2 — funcionalidade

1. Após aprovação/configuração dos segredos e remetente, ativar migração-on-login, recuperação, alteração e logout.
2. Publicar UI e rotas.
3. Testar e-mail real, código administrativo, expiração, uso único e revogação de sessão.
4. Em falha crítica, desativar recuperação e voltar ao commit de compatibilidade; manter schema aditivo.

## Falhas e concorrência

- Dois consumos do mesmo desafio serializam a linha; só um commit pode vencer.
- Cinco códigos errados bloqueiam o desafio.
- Reenvio invalida desafios anteriores ainda ativos da mesma conta/canal.
- Falha de e-mail revoga o desafio antes da resposta.
- Cadastro concorrente é resolvido por transação/lock e conflito explícito; duplicados existentes continuam bloqueando recuperação automática.

## Gates obrigatórios

1. Testes unitários de hash legado/PBKDF2, HMAC, validação e normalização.
2. Testes de integração: identificador único/inexistente/ambíguo, falha de e-mail, expiração, 5 tentativas, reuse e concorrência.
3. Provar revogação de todas as sessões e rotação de uma sessão no change-PIN.
4. Aplicar a migração duas vezes em banco descartável ou transação controlada.
5. `node --check`, testes focados, inspeção do diff e build Vercel.
6. Verifier independente e reviewer de terceira família.
7. Push GitHub, deploy `READY`, smoke API/UI no alias canônico e rejeição de sessão antiga.

## Sequência

1. Plano corrigido após revisão adversarial — concluído.
2. Implementar e publicar a release de compatibilidade.
3. Obter aprovação e configurar provedor/segredos.
4. Implementar/ativar a release funcional.
5. Executar Verifier, Reviewer, deploy e smoke tests.
6. Atualizar evidências, `STATE.md` e memória durável.
