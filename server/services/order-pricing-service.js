/**
 * @fileoverview Validação do payload e cálculo canônico de pedidos.
 * @module server/services/order-pricing-service
 */

/**
 * Valida os itens mínimos aceitos pela API de pedidos.
 * @param {unknown} items - Itens enviados pelo cliente.
 * @returns {{code:string,status:number}|null}
 */
export function validateOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) return { code: 'INVALID_ORDER_ITEMS', status: 400 };
  if (items.length > 50) return { code: 'ORDER_TOO_MANY_ITEMS', status: 400 };
  const seen = new Set();
  for (const item of items) {
    const code = String(item?.codigo || '').trim();
    if (!code || seen.has(code.toLowerCase())) return { code: 'INVALID_ORDER_ITEM_CODE', status: 400 };
    if (!Number.isSafeInteger(item?.quantidade) || item.quantidade < 1 || item.quantidade > 99) {
      return { code: 'INVALID_ORDER_ITEM_QUANTITY', status: 400 };
    }
    seen.add(code.toLowerCase());
  }
  return null;
}

/**
 * Converte o catálogo em um pedido com valores inteiros em centavos.
 * @param {Array<object>} catalog - Produtos resolvidos no banco.
 * @param {Array<object>} requested - Código e quantidade validados.
 * @returns {{items:Array<object>,totalBruto:number}}
 */
export function priceItems(catalog, requested) {
  const byCode = new Map(catalog.map((row) => [String(row.codigo).trim().toLowerCase(), row]));
  let totalBruto = 0;
  const items = requested.map(({ codigo, quantidade }) => {
    const product = byCode.get(String(codigo).trim().toLowerCase());
    if (!product) {
      throw Object.assign(new Error('CATALOG_ITEM_UNAVAILABLE'), {
        code: 'CATALOG_ITEM_UNAVAILABLE',
        status: 409,
      });
    }
    const bruto = Math.round(Number(product.preco) * 100);
    totalBruto += bruto * quantidade;
    return { ...product, quantidade, bruto };
  });
  return { items, totalBruto };
}
