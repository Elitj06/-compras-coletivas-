# Relatório de release — security hardening

## Estado

**Não publicada.** A implementação `4bffd87` está no GitHub, mas a produção foi
revertida ao deployment anterior após um smoke falho do login administrativo.

## Evidências concluídas

- Revisão independente final: aprovação condicional, sem bloqueador estático novo.
- Testes locais: 21 aprovados; auditoria de dependências sem vulnerabilidades
  altas/críticas; build Vercel aprovado.
- Banco: backup lógico validado antes da alteração; migração `08` aplicada em
  transação. As contagens de entidades de negócio foram preservadas e sessões
  sem hash CSRF foram revogadas.
- Publicação: commit `4bffd87` enviado ao GitHub; deployment
  `dpl_H4W1bTB2ApjqEUcED3RVCzeRSXUZ` chegou a `READY`.

## Falha e recuperação

O smoke HTTPS de `POST /api/db/admin/login` com senha inválida retornou
`503 AUTH_RATE_LIMIT_UNAVAILABLE`; o contrato esperado era `401`. A chave HMAC
foi criada e confirmada no ambiente de produção, portanto a causa restante é a
fonte de IP confiável prevista para o runtime Vercel não estar disponível no
request de produção. A release foi revertida pelo promotion do deployment
`dpl_9fYpfLYhS39xQY6T416bt9EjNGFz`. O smoke pós-rollback confirmou health `200`
e login administrativo inválido `401`.

## Próximo passo

Corrigir a integração de IP confiável com o runtime efetivamente entregue pela
Vercel, revisar a mudança de segurança de forma independente e repetir o deploy
com smoke autenticado buyer/admin. Não reutilizar esta cadeia de reparos além do
limite definido sem uma nova rodada controlada.
