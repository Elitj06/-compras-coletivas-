/** Canonical, server-only order validation and cent calculation. */
export function validateOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) return { code: 'INVALID_ORDER_ITEMS', status: 400 };
  if (items.length > 50) return { code: 'ORDER_TOO_MANY_ITEMS', status: 400 };
  const seen = new Set();
  for (const item of items) {
    const codigo = String(item?.codigo || '').trim();
    if (!codigo || seen.has(codigo.toLowerCase())) return { code: 'INVALID_ORDER_ITEM_CODE', status: 400 };
    if (!Number.isSafeInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > 99) return { code: 'INVALID_ORDER_ITEM_QUANTITY', status: 400 };
    seen.add(codigo.toLowerCase());
  }
  return null;
}

export function priceItems(catalog, requested) {
  const byCode = new Map(catalog.map((row) => [String(row.codigo).trim().toLowerCase(), row]));
  let totalBruto = 0; let totalFinal = 0;
  const items = requested.map(({ codigo, quantidade }) => {
    const product = byCode.get(String(codigo).trim().toLowerCase());
    if (!product) throw Object.assign(new Error('CATALOG_ITEM_UNAVAILABLE'), { code: 'CATALOG_ITEM_UNAVAILABLE', status: 409 });
    const bruto = Math.round(Number(product.preco) * 100);
    const desconto = Number(product.desconto || 0);
    const final = Math.round(bruto * (100 - desconto) / 100);
    totalBruto += bruto * quantidade; totalFinal += final * quantidade;
    return { ...product, quantidade, bruto, final, desconto };
  });
  return { items, totalBruto, totalFinal };
}
