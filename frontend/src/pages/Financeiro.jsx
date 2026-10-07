import React, { useState } from 'react'

const TYPE_LABEL = { mesa: 'Mesa', delivery: 'Delivery', balcao: 'Balcão' }
const TYPE_BADGE = { mesa: 'badge-blue', delivery: 'badge-orange', balcao: 'badge-muted' }

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function PagamentosPendentesList({ pendingPayments, onVerPedido }) {
  if (pendingPayments.length === 0) {
    return (
      <article className="card section-card fade-in">
        <div className="section-head">
          <div>
            <h2>Pagamentos pendentes</h2>
            <p>Nenhum pagamento pendente no momento.</p>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className="card section-card fade-in">
      <div className="section-head">
        <div>
          <h2>Pagamentos pendentes</h2>
          <p>Toque num pedido pra abrir ele direto em Pedidos.</p>
        </div>
        <span className="badge badge-sun">{pendingPayments.length}</span>
      </div>
      <div className="data-table">
        {pendingPayments.map((item) => (
          <button
            key={item.id_pedido}
            type="button"
            className="data-row"
            style={{
              gridTemplateColumns: '0.5fr 0.7fr 1.2fr 0.6fr',
              cursor: 'pointer',
              border: 'none',
              width: '100%',
              textAlign: 'left',
              font: 'inherit',
              color: 'inherit',
            }}
            onClick={() => onVerPedido(item.number)}
          >
            <span className="order-number">#{item.number}</span>
            <span className={`badge ${TYPE_BADGE[item.type] || 'badge-muted'}`}>
              {item.type === 'mesa' && item.table_number != null
                ? `Mesa ${item.table_number}`
                : TYPE_LABEL[item.type] || item.type}
            </span>
            <span>{item.customer_name}</span>
            <strong>{formatMoney(item.value)}</strong>
          </button>
        ))}
      </div>
    </article>
  )
}

export default function Financeiro({ financeData, onVerPedido, onAtualizarChecklist }) {
  const [mostrarPendentes, setMostrarPendentes] = useState(false)
  const pendingPayments = financeData.pendingPayments || []

  return (
    <>
      <section className="cards">
        {financeData.kpis.map((item, index) => {
          const clicavel = item.id === 'payable' && onVerPedido
          const Wrapper = clicavel ? 'button' : 'div'

          return (
            <Wrapper
              className="card metric fade-in"
              style={{
                '--i': index,
                ...(clicavel ? { cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit' } : {}),
              }}
              key={item.id}
              type={clicavel ? 'button' : undefined}
              onClick={clicavel ? () => setMostrarPendentes((prev) => !prev) : undefined}
            >
              <div>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
              <div className={`metric-icon badge-${item.tone}`}>{item.label.slice(0, 2).toUpperCase()}</div>
            </Wrapper>
          )
        })}
      </section>

      {mostrarPendentes && (
        <PagamentosPendentesList pendingPayments={pendingPayments} onVerPedido={onVerPedido} />
      )}

      <section className="page-grid page-grid-2-1">
        <div className="page-stack">
          <article className="card section-card fade-in" style={{ '--i': financeData.kpis.length }}>
            <div className="section-head">
              <div>
                <h2>Fluxo de caixa</h2>
                <p>Movimentacoes do dia com origem e forma de pagamento.</p>
              </div>
            </div>
            <div className="data-table">
              <div className="data-row row-head" style={{ gridTemplateColumns: '0.6fr 1.1fr 1fr 0.8fr' }}>
                <span>Tipo</span>
                <span>Descricao</span>
                <span>Metodo</span>
                <span>Valor</span>
              </div>
              {financeData.cashFlow.map((entry) => (
                <div className="data-row" key={entry.id} style={{ gridTemplateColumns: '0.6fr 1.1fr 1fr 0.8fr' }}>
                  <span className="badge badge-light">{entry.type}</span>
                  <strong>{entry.description}</strong>
                  <span>{entry.method}</span>
                  <span>{entry.value}</span>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="page-stack">
          <article className="card section-card fade-in" style={{ '--i': financeData.kpis.length + 1 }}>
            <div className="section-head">
              <div>
                <h2>Formas de pagamento</h2>
                <p>Participacao no faturamento do periodo.</p>
              </div>
            </div>
            <div className="data-table">
              {financeData.paymentMethods.map((method) => (
                <div className="data-row" key={method.id} style={{ gridTemplateColumns: '1fr 0.5fr 0.8fr' }}>
                  <strong>{method.label}</strong>
                  <span>{method.share}</span>
                  <span>{method.amount}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="card section-card fade-in" style={{ '--i': financeData.kpis.length + 2 }}>
            <div className="section-head">
              <div>
                <h2>Checklist de fechamento</h2>
                <p>Rotina financeira obrigatoria antes de encerrar o caixa.</p>
              </div>
            </div>
            <div className="check-list">
              {financeData.checklist.map((item) => (
                <label className="check-item" key={item.id}>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(event) => onAtualizarChecklist(item.id, event.target.checked)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </article>
        </div>
      </section>
    </>
  )
}
