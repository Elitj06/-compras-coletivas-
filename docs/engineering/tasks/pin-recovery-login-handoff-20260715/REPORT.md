# Relatório de implementação

## Correção aplicada

`public/auth-recovery.js` agora fecha o modal de recuperação antes de abrir o
modal de login. A mesma transição é usada pelo botão **Voltar** e após uma
redefinição de PIN bem-sucedida. A sessão continua revogada e o comprador precisa
entrar explicitamente com o novo PIN.

## Evidência local

- `npm test`: 13 testes aprovados, 0 falhas; 1 suíte de integração existente
  permaneceu pulada sem banco descartável configurado.
- `node --check public/auth-recovery.js`: aprovado.
- `git diff --check` limitado aos arquivos da tarefa: aprovado.
- `npx vercel build --prod`: concluído com sucesso.
- Verifier independente: aprovado; confirmou que não há modal de recuperação
  residual após login e não houve mudança de contrato de API/sessão.

## Pendências de release

- Commit, push, deploy Vercel e smoke de UI em produção.
