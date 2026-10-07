import React, { useState } from 'react'
import { ensureCatalogSeed } from './catalogDefaults.js'

const seededCatalog = ensureCatalogSeed()
const PUBLIC_MENU_BASE = `http://${window.location.hostname}:5174`

export default function CardapioOnline() {
  const [nomeRestaurante, setNomeRestaurante] = useState(
    () => localStorage.getItem('cardapio_restaurante') || seededCatalog.restaurantName,
  )
  const [slug, setSlug] = useState(
    () => localStorage.getItem('cardapio_slug') || seededCatalog.restaurantSlug,
  )
  const [linkStatus, setLinkStatus] = useState('')

  const [produto, setProduto] = useState({
    nome: '',
    descricao: '',
    preco: '',
    categoria: '',
    imagem: ''
  })

  const [produtos, setProdutos] = useState(() => {
    const salvos = localStorage.getItem('cardapio_produtos')
    return salvos ? JSON.parse(salvos) : seededCatalog.products
  })

  function gerarSlug(nome) {
    return nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
  }

  function salvarRestaurante(e) {
    const nome = e.target.value
    const proximoSlug = gerarSlug(nome) || 'restaurante-demo'

    setNomeRestaurante(nome)
    setSlug(proximoSlug)
    localStorage.setItem('cardapio_restaurante', nome)
    localStorage.setItem('cardapio_slug', proximoSlug)
    setLinkStatus('')
  }

  function gerarNovoLink() {
    const proximoSlug = gerarSlug(nomeRestaurante) || 'restaurante-demo'

    setSlug(proximoSlug)
    localStorage.setItem('cardapio_restaurante', nomeRestaurante)
    localStorage.setItem('cardapio_slug', proximoSlug)
    setLinkStatus('Link atualizado com sucesso.')
  }

  async function copiarLink() {
    try {
      await window.navigator.clipboard.writeText(linkPublico)
      setLinkStatus('Link copiado para a area de transferencia.')
    } catch {
      setLinkStatus('Nao foi possivel copiar automaticamente. Copie pelo campo acima.')
    }
  }

  function selecionarImagem(e) {
    const arquivo = e.target.files[0]

    if (!arquivo) return

    const leitor = new FileReader()

    leitor.onload = () => {
      setProduto({
        ...produto,
        imagem: leitor.result
      })
    }

    leitor.readAsDataURL(arquivo)
  }

  function cadastrarProduto(e) {
    e.preventDefault()

    const novoProduto = {
      id: Date.now(),
      ...produto
    }

    const novaLista = [...produtos, novoProduto]

    setProdutos(novaLista)
    localStorage.setItem('cardapio_produtos', JSON.stringify(novaLista))
    localStorage.setItem('cardapio_restaurante', nomeRestaurante)
    localStorage.setItem('cardapio_slug', slug)

    setProduto({
      nome: '',
      descricao: '',
      preco: '',
      categoria: '',
      imagem: ''
    })

    e.target.reset()
  }

  function removerProduto(id) {
    const novaLista = produtos.filter((item) => item.id !== id)
    setProdutos(novaLista)
    localStorage.setItem('cardapio_produtos', JSON.stringify(novaLista))
  }

  const linkPublico = `${PUBLIC_MENU_BASE}/cardapio/${slug}`

  return (
    <section className="cardapio-admin">
      <div className="painel-header">
        <h2>Cardápio Online</h2>
        <p>Cadastre os produtos do restaurante e gere um link público para os clientes.</p>
      </div>

      <div className="painel-section">
        <h3>Dados do restaurante</h3>

        <label>Nome do restaurante</label>
        <input
          type="text"
          value={nomeRestaurante}
          onChange={salvarRestaurante}
          placeholder="Ex: Restaurante Sabor Caseiro"
        />

        <label>Link público</label>
        <div className="link-publico">
          <input type="text" value={linkPublico} readOnly />
          <a className="link-publico-primary" href={linkPublico} target="_blank" rel="noreferrer">
            Abrir cardápio
          </a>
        </div>

        <div className="link-publico-actions">
          <button className="link-publico-secondary" type="button" onClick={gerarNovoLink}>
            Gerar novo link
          </button>
          <button className="link-publico-secondary" type="button" onClick={copiarLink}>
            Copiar link
          </button>
        </div>

        <small className="cardapio-hint">
          Use esta URL no navegador: {linkPublico}
        </small>

        {linkStatus && <small className="cardapio-link-status">{linkStatus}</small>}
      </div>

      <div className="painel-section">
        <h3>Cadastrar produto</h3>

        <form onSubmit={cadastrarProduto} className="form-cardapio">
          <input
            type="text"
            placeholder="Nome do produto"
            value={produto.nome}
            onChange={(e) => setProduto({ ...produto, nome: e.target.value })}
            required
          />

          <input
            type="text"
            placeholder="Categoria"
            value={produto.categoria}
            onChange={(e) => setProduto({ ...produto, categoria: e.target.value })}
            required
          />

          <input
            type="number"
            placeholder="Preço"
            value={produto.preco}
            onChange={(e) => setProduto({ ...produto, preco: e.target.value })}
            required
          />

          <textarea
            placeholder="Descrição do produto"
            value={produto.descricao}
            onChange={(e) => setProduto({ ...produto, descricao: e.target.value })}
            required
          />

          <label>Imagem do produto</label>
          <input
            type="file"
            accept="image/*"
            onChange={selecionarImagem}
          />

          {produto.imagem && (
            <img
              src={produto.imagem}
              alt="Prévia do produto"
              className="preview-produto"
            />
          )}

          <button type="submit">Adicionar ao cardápio</button>
        </form>
      </div>

      <div className="painel-section">
        <h3>Produtos cadastrados</h3>

        {produtos.length === 0 ? (
          <p>Nenhum produto cadastrado ainda.</p>
        ) : (
          <div className="lista-produtos">
            {produtos.map((item) => (
              <div className="produto-card" key={item.id}>
                {item.imagem && (
                  <img
                    src={item.imagem}
                    alt={item.nome}
                    className="produto-imagem"
                  />
                )}

                <div className="produto-info">
                  <h4>{item.nome}</h4>
                  <p>{item.descricao}</p>
                  <small>{item.categoria}</small>
                </div>

                <div className="produto-acoes">
                  <strong>R$ {Number(item.preco).toFixed(2)}</strong>
                  <button type="button" onClick={() => removerProduto(item.id)}>Remover</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}