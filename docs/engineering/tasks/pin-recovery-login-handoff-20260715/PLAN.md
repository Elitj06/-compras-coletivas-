# Correção: retorno ao login após recuperação de PIN

## Enquadramento

- Risco/lane: `medium / commit` — correção pontual de UX em jornada de autenticação, sem alteração de contrato, dados ou segredos.
- Repositório canônico: `/root/projects/compras-coletivas`.
- Baseline/retorno: `eaa45c15e11e60a45db913772e06f1f5e88f4627`.
- Limite de escrita: `public/auth-recovery.js`, testes de regressão e estes artefatos.
- Mudanças preexistentes excluídas: `SYNC-RESULT.md`, `SYNC-TASK.md`, `scripts/sync_july2026.py`.

## Diagnóstico

Após concluir a recuperação, o fluxo abre o modal de login sem remover o modal de
recuperação. Depois que o login é bem-sucedido, a rotina normal remove somente o
modal de login; o modal antigo volta a bloquear a tela. Um reload recria o DOM e
mascara o defeito.

## Mudança

Centralizar a transição de recuperação para login em um helper que fecha o modal
de recuperação antes de abrir o modal de login. Aplicar tanto ao botão **Voltar**
quanto ao sucesso da redefinição. A recuperação continua revogando sessões e
exige login explícito com o novo PIN.

## Verificação

1. Teste de regressão do ciclo de modais e da mensagem de retorno ao login.
2. Testes existentes e verificação de sintaxe.
3. Build e deploy Vercel.
4. Smoke no ar: recuperação → novo PIN → login imediato, sem recarregar a página.
