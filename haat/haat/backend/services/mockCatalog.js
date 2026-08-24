import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ALL_PRODUCTS = JSON.parse(
  readFileSync(join(__dirname, '../data/products.json'), 'utf8')
)

// Score a product against query + category for relevance ranking
function score(product, query, category) {
  let points = 0
  const haystack = [
    product.name, product.description,
    product.category, product.tags.join(' '),
    product.city, product.state,
  ].join(' ').toLowerCase()

  if (category && product.category === category.toLowerCase()) points += 10

  const words = (query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  for (const word of words) {
    if (haystack.includes(word)) points += 3
  }

  // Prefer higher ratings when scores tie
  points += product.rating * 0.1
  return points
}

export function getMockProducts(query, category) {
  const scored = ALL_PRODUCTS
    .filter(p => p.available)
    .map(p => ({ ...p, _score: score(p, query, category) }))
    .sort((a, b) => b._score - a._score)

  return scored.slice(0, 8).map(({ _score, ...p }) => p)
}

export function getAllProducts() {
  return ALL_PRODUCTS
}

export function getProductsByCategory(category) {
  return ALL_PRODUCTS.filter(p => p.category === category.toLowerCase())
}
