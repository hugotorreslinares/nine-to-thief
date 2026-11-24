// Enlace de pago de la preventa del art toy (Stripe Payment Link, Shopify, etc.).
// Se define al compilar con VITE_PREORDER_URL; sin él, los botones de preventa no aparecen.

function parse(value: unknown): string | undefined {
  if (typeof value !== 'string' || value === '') return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : undefined
  } catch {
    console.warn('VITE_PREORDER_URL no es una URL válida')
    return undefined
  }
}

export const PREORDER_URL = parse(import.meta.env.VITE_PREORDER_URL)
