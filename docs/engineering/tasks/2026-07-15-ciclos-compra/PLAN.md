# Ciclos de compra formais

## Objetivo

Separar permanentemente os pedidos por ciclo sem apagar pedidos, itens ou pagamentos existentes. O ciclo ativo será o escopo padrão do painel administrativo, consolidados, exportações e pagamentos.

## Decisões

- Risco: alto / lane: release. Há migração de banco e mudança em API/UI de produção.
- Deep Architecture: ativo. A alteração cria a fronteira de dados `ciclos_compra` e muda o contrato dos agregados administrativos.
- Fonte canônica: `/root/projects/compras-coletivas`, branch `main`.
- Hotspots e escritor único: `sql/06_ciclos_compra.sql`, `api/db.js`, `public/app.js`, `docs/API.md`, `README.md`.
- Retorno: commit `5f1c901`; alterações pré-existentes em `SYNC-RESULT.md`, `SYNC-TASK.md` e `scripts/sync_july2026.py` ficam fora do escopo.

## Fluxo e contratos

`ciclos_compra (um ativo)` <- `pedidos.ciclo_id` <- `itens_pedido` e `pagamentos`.

- `GET /ciclos-compra`: lista ciclos para administrador; o ativo é identificado no payload.
- `POST /ciclos-compra`: cria um ciclo aberto; se solicitado, torna-o ativo em transação.
- `PUT /ciclos-compra/:id/ativar`: fecha o ciclo ativo anterior e ativa o escolhido em transação.
- Rotas administrativas agregadas aceitam `?ciclo_id=`; sem ele usam o ciclo ativo.
- `POST /pedidos` obtém o ciclo ativo dentro da transação e grava seu id. Sem ciclo ativo, falha sem criar pedido.
- Histórico do comprador preserva todos os ciclos e informa o nome do ciclo; a tela de pedido atual solicita apenas o ativo.

## Migração e recuperação

Migração aditiva e idempotente: cria a tabela, insere Abril/2026 e Julho/2026, associa pedidos existentes pelo corte em 01/07/2026 e torna Julho ativo. Não há `DELETE`, `TRUNCATE` nem alteração de itens/pagamentos.

Recuperação: antes do deploy, o banco permanece no commit-base e os pedidos seguem sem a coluna. Após a migração, a reversão de aplicação é compatível porque a coluna é aditiva; para reverter o comportamento basta restaurar os arquivos do escopo para `5f1c901`. Não remover tabelas/colunas nem dados em produção.

## Aceitação

1. Os pedidos até 30/06/2026 pertencem a Abril/2026; os de 01/07/2026 em diante pertencem a Julho/2026.
2. Existe exatamente um ciclo ativo (Julho/2026).
3. Um novo pedido recebe obrigatoriamente o ciclo ativo.
4. Painel, consolidados, exportações e pagamentos padrão não combinam ciclos.
5. O administrador pode selecionar e consultar ciclo antigo; o histórico do comprador continua acessível.
6. Banco, API e UI são verificados localmente e no deploy de produção.
