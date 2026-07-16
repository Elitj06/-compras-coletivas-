# Critérios de aceitação — confiabilidade do acesso

## Identidade e segurança

- [x] Duplicatas só resolvem quando nome e e-mail normalizados são equivalentes e exatamente um cadastro possui pedidos vinculados.
- [x] O cadastro com histórico é usado para desafio, novo PIN, sessão e histórico; nenhum cadastro é mesclado ou excluído.
- [x] Nomes divergentes, e-mail vazio/divergente ou múltiplos cadastros com histórico permanecem ambíguos e não recebem código.
- [x] Login e recuperação compartilham o mesmo resolvedor conservador.
- [x] Cadastro continua somente criação e mantém conflito `409`.
- [x] Respostas públicas de recuperação continuam neutras e não expõem contagem de pedidos, existência de conta ou falha de entrega.
- [x] Login e redefinição de PIN são serializados pelo lock do comprador; nenhuma sessão baseada no PIN antigo sobrevive ao reset.
- [x] A resposta pública não aguarda SMTP; entrega, revogação e fechamento do banco executam via `waitUntil` oficial.
- [x] Ausência de segredo ou provedor fica auditável sem PII.
- [x] Segredo CSPRNG exclusivo foi configurado e teve presença/comprimento mínimo validados sem exposição do valor.

## UX

- [x] Login, cadastro e solicitação de recuperação exibem estado de processamento e impedem clique duplicado.
- [x] Falha de rede exibe mensagem acionável e restaura o botão.
- [x] Cadastro existente direciona para login/recuperação com identificador preenchido.
- [x] O conflito `409` preserva o telefone informado e não sugere o e-mail submetido como identidade confirmada.
- [x] Resposta neutra de recuperação explica os próximos passos sem afirmar que houve entrega.

## Gates

- [x] Testes unitários aprovados.
- [x] Integração PostgreSQL descartável aprovada, inclusive recuperação, novo PIN e login no cadastro canônico.
- [x] Auditoria de dependências sem vulnerabilidades conhecidas; Nodemailer e `ws` em versões corrigidas.
- [x] SheetJS oficial `0.20.3` está self-hosted com SHA-384/SRI; versão global e exportação Excel foram exercitadas.
- [x] Sintaxe, diff-check escopado e build Vercel de produção aprovados.
- [x] Verifier independente aprovou o diff após o ciclo de reparo 1.
- [x] Revalidação independente aprovou o digest após o Reviewer `REJECT` e ciclo de reparo 2.
- [x] Reviewer final aprovou o digest reparado para rollout controlado.
- [ ] Commit/push e deploy `READY` aprovados.
- [ ] Smoke no alias canônico comprova health, login, cadastro, recuperação e UI.
- [ ] Entrega real é comprovada em caixa controlada; endereço pessoal exige autorização específica.

## Rollback

- [ ] Em falha, desativar a recuperação e promover novamente o baseline `6298c50`.
- [ ] Confirmar após rollback: health `200`, login inválido `401` e recuperação desativada.
