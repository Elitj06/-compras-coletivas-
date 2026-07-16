# Critérios de aceite

- [x] Entrada de login inválida retorna `400` e `INVALID_LOGIN_INPUT`, nunca `500`.
- [x] Credencial/PIN inválido retorna `401` e `INVALID_CREDENTIALS`, nunca `500`.
- [x] As demais rotas assíncronas do mesmo dispatcher mantêm o mesmo tratamento de `BuyerAuthError`.
- [ ] Deploy automático concluído e smoke no alias de produção aprovado.
