# Relatório — recuperação e login simplificados

## Resultado

Fluxos de acesso do comprador e reset administrativo foram reduzidos a um
único caminho direto, sem dependência do e-mail transacional.

## Entrega

- `POST /api/db/comprador/pin-recovery/simple`: redefine o PIN por telefone ou
  e-mail e revoga sessões antigas.
- `POST /api/db/admin/compradores/:id/pin-reset`: admin define ou gera um PIN,
  com efeito imediato.
- Login por identificador agora usa o PIN para resolver cadastros legados
  duplicados.
- Modal público e painel admin atualizados com instruções acionáveis.
- Fluxos antigos de e-mail/código permanecem para compatibilidade com links já
  enviados.

## Evidência

- `npm test`: 29 aprovados; integração PostgreSQL opcional pulada sem banco de
  teste.
- `node --check` dos módulos alterados: aprovado.
- `vercel build`: aprovado.
- GitHub: commits `e66ebe1` e `b124655` na branch `main`.
- Vercel: deployment `dpl_9Ls2LeJ4MB5yhdhcLZdrDbkzJRx1` em estado `READY`.
- Produção: health `200`, login inválido `401`, recuperação ausente `404` e
  reset admin sem autenticação `401`.

## Risco aceito

A recuperação direta não exige e-mail ou código intermediário. Quem souber o
telefone/e-mail pode trocar o PIN; essa redução foi intencional para o grupo
pequeno do aplicativo.
