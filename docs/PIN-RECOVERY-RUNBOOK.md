# Runbook — recuperação de PIN

## Configuração

- `PIN_RECOVERY_ENABLED`: habilita solicitação, conclusão e fallback admin.
- `PIN_HASH_MIGRATION_ENABLED`: migra hash legado depois de login válido.
- `RECOVERY_HMAC_KEY`: assina códigos; mínimo operacional de 32 bytes aleatórios.
- `RATE_LIMIT_HMAC_KEY`: anonimiza IP e identificador nos limites e auditoria.
- `SMTP_USER`: conta Gmail exclusiva usada como remetente.
- `SMTP_APP_PASSWORD`: senha de app de 16 caracteres do Gmail, armazenada como segredo no Vercel.
- `RECOVERY_FROM_EMAIL`: remetente no formato `Compras Coletivas <conta@gmail.com>`.
- `APP_BASE_URL`: URL canônica HTTPS do app.

Nunca reutilizar as duas chaves HMAC, registrar seus valores ou salvá-las no Git.

## Ativação

1. Aplicar `sql/05_pin_recovery.sql` e confirmar zero grants para papéis expostos.
2. Publicar a camada de compatibilidade e provar login SHA-256/PBKDF2.
3. Configurar os seis segredos/valores no Vercel.
4. Fazer envio real para uma caixa de teste e confirmar o recebimento.
5. Publicar a release funcional ainda com `PIN_RECOVERY_ENABLED=false`.
6. Executar smoke de login e rotas protegidas.
7. Ativar `PIN_RECOVERY_ENABLED=true` e `PIN_HASH_MIGRATION_ENABLED=true`.
8. Fazer novo deploy e testar e-mail, código admin, troca de PIN e revogação.

## Rotação das chaves HMAC

A versão atual aceita uma chave por finalidade. Rotacionar invalida desafios em
aberto e muda os buckets de rate limit. Procedimento:

1. desabilitar `PIN_RECOVERY_ENABLED`;
2. aguardar 10 minutos ou revogar desafios ativos;
3. gerar e substituir as duas chaves no Vercel;
4. implantar novamente;
5. reativar e executar os smokes.

## Retenção

- Limpar `pin_recovery_rate_limits` depois de `expires_at`.
- Manter auditoria conforme necessidade operacional e privacidade; não inserir PII.
- Remover desafios antigos somente após a janela de investigação definida pelo operador.

## Rollback

Desabilitar `PIN_RECOVERY_ENABLED` primeiro. Se necessário, voltar ao commit da
release de compatibilidade. As tabelas aditivas podem permanecer. Nunca voltar a
uma versão que não reconheça PBKDF2 depois que a migração de hashes foi ativada.
