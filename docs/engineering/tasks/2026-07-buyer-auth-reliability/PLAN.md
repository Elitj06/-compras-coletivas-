# Plano — confiabilidade do acesso do comprador

## Classificação

`critical / release`: corrige autenticação e recuperação de PIN e inclui mutação autorizada
de segredo no ambiente de produção.

Deep Architecture: não ativa. A mudança é localizada, preserva o modelo de dados e não
introduz arquitetura nova.

## Evidência inicial

- Produção: `GET /api/db/health` respondeu `200` em 2026-07-16.
- Produção: a solicitação de recuperação responde `202` com mensagem neutra; essa resposta não prova entrega do e-mail.
- O segredo HMAC da recuperação existia sem valor efetivo em produção; a recuperação falhava fechada.
- Há uma identidade com dois cadastros semanticamente equivalentes: somente um possui pedidos vinculados. A busca anterior tratava qualquer duplicidade como ambígua.
- Código publicado trata falhas de entrega de forma neutra por desenho de segurança e não oferece ao usuário um caminho visível quando o envio falha.
- O cadastro pode retornar erro de conflito (`409`), mas o frontend não protege contra exceções de rede/JSON nem sinaliza estado de envio; isso pode se manifestar como botão aparentemente inerte.

## Cadeia e ownership

- Baseline/rollback: commit `6298c50` e deploy atualmente ativo.
- Planner: análise independente somente leitura.
- Implementer: um único escritor, limitado a jornada de login/cadastro/recuperação e testes correlatos.
- Verifier: independente; não edita.
- Reviewer: independente, após verifier, focado em auth, privacidade e produção.

## Correção planejada

1. Configurar uma chave CSPRNG exclusiva no ambiente protegido, sem exibir ou persistir o valor.
2. Resolver duplicatas somente quando todos os nomes e e-mails forem equivalentes e exatamente um cadastro possuir pedidos; nunca mesclar ou excluir dados.
3. Usar o mesmo resolvedor conservador no login e na recuperação; ambiguidades reais continuam neutras.
4. Tornar o frontend resiliente: estado de envio, erro visível em falha de rede e direcionamento de conflito para login/recuperação.
5. Validar em testes unitários e PostgreSQL descartável e, após Verifier e Reviewer independentes, publicar com smoke controlado.

## Critérios de aceitação

- Cadastro válido cria sessão; cadastro já existente mostra instrução acionável; falha de API nunca parece inerte.
- Solicitação de recuperação para conta apta gera desafio entregue e e-mail é aceito pelo provedor; a falha fica auditável sem expor existência de conta.
- Dados inválidos recebem `400`; credenciais inválidas recebem `401`; nenhuma resposta inesperada vira `500`.
- Testes focados e suíte completa passam; deploy e smoke no alvo passam.
- Login e recuperação usam o cadastro histórico como canônico sem aceitar o PIN do duplicado nem alterar dados.

## Retorno

- Reverter exclusivamente o commit da correção e promover novamente o deploy de `6298c50` se qualquer smoke de acesso falhar.
- Desativar `PIN_RECOVERY_ENABLED` antes do rollback se a falha envolver recuperação; a chave nova pode permanecer protegida.
