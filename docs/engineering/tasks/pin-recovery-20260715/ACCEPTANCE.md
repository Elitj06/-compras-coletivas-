# Critérios de aceitação

## Segurança e identidade

- [ ] Solicitação pública sempre retorna `202` com corpo equivalente e `challenge_id` aleatório.
- [ ] Conta inexistente, identificador ambíguo, rate limit e falha de e-mail não enviam código nem alteram o corpo público.
- [ ] Código tem 6 dígitos CSPRNG, HMAC com segredo, expira em 10 minutos, bloqueia após 5 erros e funciona uma vez.
- [ ] Dois consumos concorrentes produzem exatamente um vencedor.
- [ ] Recuperação revoga todas as sessões e exige login normal.
- [ ] Alteração autenticada exige PIN atual, revoga todas as sessões e deixa apenas a sessão substituta.
- [ ] Logout revoga apenas o token apresentado.
- [ ] PIN legado continua válido; PBKDF2 funciona; migração só ocorre com feature habilitada.
- [ ] Cadastro não sobrescreve telefone/e-mail equivalente e pedidos não alteram identidade.
- [ ] Admin gera código por `comprador.id` somente após registrar método e nota de validação.
- [ ] Auditoria não contém PIN, código, token, e-mail, telefone ou IP em claro.

## UX

- [ ] Login oferece **Esqueci meu PIN**.
- [ ] Comprador pode solicitar e concluir recuperação por código.
- [ ] Comprador autenticado pode alterar o PIN.
- [ ] Admin pode selecionar comprador inequívoco, registrar validação e copiar o código temporário.
- [ ] Mensagens não revelam existência da conta.

## Dados, entrega e rollback

- [ ] Migração aditiva/idempotente aplicada duas vezes sem erro e com grants explícitos.
- [ ] Release de compatibilidade publicada e provada antes da ativação.
- [ ] Remetente Resend e segredos aprovados/configurados; e-mail real recebido em caixa de teste.
- [ ] Testes focados, sintaxe e build passam.
- [ ] Verifier independente aprova o diff; Reviewer de terceira família não encontra bloqueador.
- [ ] Commit enviado ao GitHub e deploy Vercel fica `READY`.
- [ ] Smoke no ar cobre request/complete, admin fallback, change-PIN, logout, token antigo rejeitado e UI acessível.
- [ ] Rollback comprovado para a release de compatibilidade com recuperação desativada.
