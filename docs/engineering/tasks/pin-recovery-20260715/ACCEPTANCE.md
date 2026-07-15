# Critérios de aceitação

## Segurança e identidade

- [x] Solicitação pública sempre retorna `202` com corpo equivalente e `challenge_id` aleatório.
- [x] Conta inexistente, identificador ambíguo, rate limit e falha de e-mail não enviam código nem alteram o corpo público.
- [x] Código tem 6 dígitos CSPRNG, HMAC com segredo, expira em 10 minutos, bloqueia após 5 erros e funciona uma vez.
- [x] Dois consumos concorrentes produzem exatamente um vencedor.
- [x] Recuperação revoga todas as sessões e exige login normal.
- [x] Alteração autenticada exige PIN atual, revoga todas as sessões e deixa apenas a sessão substituta.
- [x] Logout revoga apenas o token apresentado.
- [x] PIN legado continua válido; PBKDF2 funciona; migração só ocorre com feature habilitada.
- [x] Cadastro não sobrescreve telefone/e-mail equivalente e pedidos não alteram identidade.
- [x] Admin gera código por `comprador.id` somente após registrar método e nota de validação.
- [x] Auditoria não contém PIN, código, token, e-mail, telefone ou IP em claro.

## UX

- [x] Login oferece **Esqueci meu PIN**.
- [x] Comprador pode solicitar e concluir recuperação por código.
- [x] Comprador autenticado pode alterar o PIN.
- [x] Admin pode selecionar comprador inequívoco, registrar validação e copiar o código temporário.
- [x] Mensagens não revelam existência da conta.

## Dados, entrega e rollback

- [x] Migração aditiva/idempotente aplicada duas vezes sem erro e com grants explícitos.
- [x] Release de compatibilidade publicada e provada antes da ativação.
- [ ] Segredos Gmail SMTP configurados; e-mail real recebido em caixa de teste.
- [x] Testes focados, sintaxe e build passam.
- [ ] Verifier independente aprova o diff; Reviewer de terceira família não encontra bloqueador.
- [ ] Commit enviado ao GitHub e deploy Vercel fica `READY`.
- [ ] Smoke no ar cobre request/complete, admin fallback, change-PIN, logout, token antigo rejeitado e UI acessível.
- [ ] Rollback comprovado para a release de compatibilidade com recuperação desativada.
