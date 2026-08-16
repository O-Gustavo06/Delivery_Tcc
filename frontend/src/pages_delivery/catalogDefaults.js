const DEFAULT_RESTAURANT_NAME = 'Burger Station Demo'
const DEFAULT_RESTAURANT_SLUG = 'burger-station-demo'

const DEFAULT_PRODUCTS = [
  {
    id: 1001,
    nome: 'Hamburguer Smash Bacon',
    descricao: 'Pao brioche, dois smash burgers, queijo cheddar, bacon crocante e molho da casa.',
    preco: '32.9',
    categoria: 'Hamburgueres',
    imagem: '/download.jpg',
  },
  {
    id: 1002,
    nome: 'Batata Rustica Especial',
    descricao: 'Batata crocante com páprica, parmesao e maionese verde.',
    preco: '18.5',
    categoria: 'Porcoes',
    imagem: '/download.jpg',
  },
  {
    id: 1003,
    nome: 'Combo Burger + Refri',
    descricao: 'Smash burger classico com fritas individuais e refrigerante lata.',
    preco: '39.9',
    categoria: 'Combos',
    imagem: '/download.jpg',
  },
]

function safeParse(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function ensureCatalogSeed() {
  const storedName = window.localStorage.getItem('cardapio_restaurante')
  const storedSlug = window.localStorage.getItem('cardapio_slug')
  const storedProducts = safeParse(window.localStorage.getItem('cardapio_produtos'))

  const hasProducts = Array.isArray(storedProducts) && storedProducts.length > 0

  if (!storedName) {
    window.localStorage.setItem('cardapio_restaurante', DEFAULT_RESTAURANT_NAME)
  }

  if (!storedSlug) {
    window.localStorage.setItem('cardapio_slug', DEFAULT_RESTAURANT_SLUG)
  }

  if (!hasProducts) {
    window.localStorage.setItem('cardapio_produtos', JSON.stringify(DEFAULT_PRODUCTS))
  }

  return {
    restaurantName: storedName || DEFAULT_RESTAURANT_NAME,
    restaurantSlug: storedSlug || DEFAULT_RESTAURANT_SLUG,
    products: hasProducts ? storedProducts : DEFAULT_PRODUCTS,
  }
}