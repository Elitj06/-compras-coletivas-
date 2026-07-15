# Revisão adversarial de arquitetura

## Veredito inicial

Plano inicial rejeitado antes de código. Bloqueadores encontrados:

- jornada aprovada havia sido alterada para link e e-mail previamente verificado;
- duplicidade real de telefones e e-mails não estava resolvida no contrato;
- hash simples não protege código de 6 dígitos após vazamento do banco;
- rollback ao baseline antigo seria incompatível após migração de hash;
- provedor, remetente e segredos de e-mail ainda não existem no projeto.

## Correções incorporadas

- código de 6 dígitos com HMAC, desafio opaco, 10 minutos, cinco tentativas e consumo transacional;
- resposta `202` neutra para todos os resultados públicos;
- envio somente quando o identificador resolve exatamente um comprador;
- fluxo administrativo por ID com validação auditada;
- rollout em duas releases e rollback para a camada de compatibilidade;
- contrato explícito de configuração e falha fechada do provedor;
- cadastro create-only e pedidos sem mutação de identidade.

## Gate

Plano corrigido pode seguir para implementação `high/release`. Ativação em produção depende da aprovação do proprietário para configurar os segredos e o remetente de e-mail.
