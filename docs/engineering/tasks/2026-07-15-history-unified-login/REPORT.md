# Relatório

## Implementação

- Migração aditiva aplicada: pedido legado com vínculo inequívoco associado ao comprador; registros ambíguos permanecem sem alteração.
- Histórico agora retorna e exibe o ciclo de cada pedido.
- Painel administrativo ganhou seletor de ciclo para relatórios e consolidados.
- A conta administrativa é vinculada explicitamente a um único cadastro de comprador e, após autenticação, recebe sessões separadas de administrador e comprador.

## Segurança

- O token de comprador emitido no login administrativo não concede privilégios administrativos.
- O vínculo é por chave estrangeira, sem inferência por nome, telefone ou e-mail no login.

## Evidências locais

- Sintaxe de `api/db.js` e `public/app.js`: aprovada.
- Suíte: 13 testes aprovados; 1 suíte de integração PostgreSQL ficou pulada por não haver banco de teste configurado.
