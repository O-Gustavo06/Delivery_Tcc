import React, { useState } from 'react'
import EnderecoPorCep from '../pages_delivery/EnderecoPorCep.jsx'
import { resolveApiBase } from '../utils/apiBase'

const API_BASE = resolveApiBase()

const emptyItem = () => ({ name: '', qty: '1', price: '', note: '' })

export default function NovoPedidoModal({ onCreate, onClose }) {
  const [type, setType] = useState('mesa')
  const [tableNumber, setTableNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [address, setAddress] = useState('')
  const [cep, setCep] = useState('')
  const [rua, setRua] = useState('')
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState('')
  const [channel, setChannel] = useState('loja')
  const [paymentMethod, setPaymentMethod] = useState('pix')
  const [changeFor, setChangeFor] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState([emptyItem()])
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const buscarNomePeloTelefone = async (telefone) => {
    const digits = telefone.replace(/\D/g, '')
    if (digits.length < 10) return

    try {
      const response = await fetch(`${API_BASE}/pedir/cliente/${digits}`, { headers: { Accept: 'application/json' } })
      if (!response.ok) return
      const payload = await response.json()
      if (payload.nome && !customerName.trim()) {
        setCustomerName(payload.nome)
      }
    } catch {
      // sem sorte, sem problema: admin digita o nome normalmente
    }
  }

  const updateItem = (index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const addItem = () => setItems((prev) => [...prev, emptyItem()])
  const removeItem = (index) => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))

  const total = items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0), 0)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!customerName.trim()) {
      setError('Nome do cliente e obrigatorio.')
      return
    }
    if (type === 'mesa' && !tableNumber) {
      setError('Numero da mesa e obrigatorio.')
      return
    }
    if (type === 'delivery' && (!cep.trim() || !address.trim())) {
      setError('CEP e numero sao obrigatorios pra delivery.')
      return
    }
    if (type === 'delivery' && channel !== 'loja' && !customerPhone.trim()) {
      setError('Telefone e obrigatorio pra pedidos de iFood/99Food (vira o codigo de confirmacao).')
      return
    }
    const validItems = items.filter((item) => item.name.trim() && Number(item.qty) > 0 && item.price !== '')
    if (validItems.length === 0) {
      setError('Adicione pelo menos um item valido.')
      return
    }

    const payload = {
      type,
      customer_name: customerName.trim(),
      items: validItems.map((item) => ({
        name: item.name.trim(),
        qty: Number(item.qty),
        price: Number(item.price),
        ...(item.note.trim() ? { note: item.note.trim() } : {}),
      })),
    }

    if (type === 'mesa') {
      payload.table_number = Number(tableNumber)
    }

    if (type === 'delivery') {
      payload.address = address.trim()
      payload.cep = cep.trim()
      payload.rua = rua
      payload.cidade = cidade
      payload.uf = uf
      payload.channel = channel
      if (customerPhone.trim()) payload.customer_phone = customerPhone.trim()
    }

    payload.payment_method = paymentMethod
    if (paymentMethod === 'dinheiro' && changeFor) {
      payload.change_for = Number(changeFor)
    }
    if (note.trim()) {
      payload.note = note.trim()
    }

    setIsSaving(true)
    const result = await onCreate(payload)
    setIsSaving(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Novo pedido</h2>
            <p>Cria um pedido de mesa, delivery ou balcao.</p>
          </div>
          <button className="btn btn-light" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          <div className="type-tabs">
            {[
              { value: 'mesa', label: 'Mesa' },
              { value: 'delivery', label: 'Delivery' },
              { value: 'balcao', label: 'Balcao' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className={`tab ${type === option.value ? 'active' : ''}`}
                onClick={() => setType(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="form-grid-2">
            <div className="filter-group">
              <label>Nome do cliente</label>
              <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} required />
            </div>

            {type === 'mesa' && (
              <div className="filter-group">
                <label>Numero da mesa</label>
                <input
                  type="number"
                  min="1"
                  value={tableNumber}
                  onChange={(event) => setTableNumber(event.target.value)}
                  required
                />
              </div>
            )}

            {type === 'delivery' && (
              <div className="filter-group">
                <label>Canal</label>
                <select value={channel} onChange={(event) => setChannel(event.target.value)}>
                  <option value="loja">Loja (proprio)</option>
                  <option value="ifood">iFood</option>
                  <option value="99food">99Food</option>
                </select>
              </div>
            )}
          </div>

          {type === 'delivery' && (
            <>
              <div className="form-grid-2">
                <EnderecoPorCep
                  onResolved={(resolved) => {
                    setCep(resolved?.cep || '')
                    setAddress(resolved?.endereco || '')
                    setRua(resolved?.rua || '')
                    setCidade(resolved?.cidade || '')
                    setUf(resolved?.uf || '')
                  }}
                />
              </div>

              <div className="filter-group">
                <label>Telefone do cliente{channel !== 'loja' ? ' (obrigatorio)' : ' (opcional)'}</label>
                <input
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  onBlur={(event) => buscarNomePeloTelefone(event.target.value)}
                />
              </div>
            </>
          )}

          <div className="form-grid-2">
            <div className="filter-group">
              <label>Forma de pagamento</label>
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                <option value="pix">Pix</option>
                <option value="cartao">Cartao</option>
                <option value="dinheiro">Dinheiro</option>
              </select>
            </div>
            {paymentMethod === 'dinheiro' && (
              <div className="filter-group">
                <label>Troco pra quanto</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={changeFor}
                  onChange={(event) => setChangeFor(event.target.value)}
                />
              </div>
            )}
          </div>

          <div className="filter-group">
            <label>Observações do pedido (opcional)</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex: campainha não funciona, embalar para viagem, troco combinado na porta..."
              rows={2}
              style={{ resize: 'vertical', minHeight: 44 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12.5, color: 'var(--muted)' }}>Itens</label>
            <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
              {items.map((item, index) => (
                <div key={index} style={{ display: 'grid', gap: 4 }}>
                  <div className="item-row">
                    <input
                      placeholder="Item"
                      value={item.name}
                      onChange={(event) => updateItem(index, 'name', event.target.value)}
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="Qtd"
                      value={item.qty}
                      onChange={(event) => updateItem(index, 'qty', event.target.value)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Preco"
                      value={item.price}
                      onChange={(event) => updateItem(index, 'price', event.target.value)}
                    />
                    <button
                      className="item-remove"
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                    >
                      ×
                    </button>
                  </div>
                  <div className="filter-group">
                    <input
                      placeholder="Obs do item (ex: retirar cebola)"
                      value={item.note}
                      onChange={(event) => updateItem(index, 'note', event.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-light" type="button" style={{ marginTop: 8 }} onClick={addItem}>
              + Adicionar item
            </button>
          </div>

          <div className="items-total">
            <span>Total</span>
            <strong>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={isSaving}>
            {isSaving ? 'Criando...' : 'Criar pedido'}
          </button>
        </form>
      </div>
    </div>
  )
}
