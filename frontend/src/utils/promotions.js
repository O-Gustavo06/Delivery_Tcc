export function aplicarPromocoes(produtos, promocoes = [], quantidades = {}) {
  return produtos.map((produto) => {
    const produtoId = Number(produto.id)
    const categoriaId = Number(produto.categoria_id)
    const melhor = promocoes.reduce((atual, promocao) => {
      const elegivel = promocao.produtos.includes(produtoId) || promocao.categorias.includes(categoriaId)
      if (!elegivel) return atual

      const precoBase = Number(produto.preco || 0)
      const desconto = promocao.tipo_desconto === 'percentual'
        ? precoBase * Number(promocao.valor_desconto) / 100
        : Number(promocao.valor_desconto)
      const descontoAplicavel = Math.round(Math.min(precoBase, desconto) * 100) / 100
      return descontoAplicavel > (atual?.desconto || 0)
        ? { promocao, desconto: descontoAplicavel }
        : atual
    }, null)

    return {
      ...produto,
      precoOriginal: Number(produto.preco || 0),
      preco: melhor ? Math.max(0, Number(produto.preco || 0) - melhor.desconto) : Number(produto.preco || 0),
      promocaoAplicada: melhor?.promocao || null,
    }
  })
}
