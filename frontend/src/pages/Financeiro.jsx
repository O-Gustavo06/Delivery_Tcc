import React from 'react'

export default function Financeiro({ financeData }) {
  return (
    <>
      <section className="cards">
        {financeData.kpis.map((item, index) => (
          <div className="card metric fade-in" style={{ '--i': index }} key={item.id}>
            <div>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
            <div className={`metric-icon badge-${item.tone}`}>{item.label.slice(0, 2).toUpperCase()}</div>
          </div>
        ))}
      </section>

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
                <label className="check-item" key={item}>
                  <input type="checkbox" defaultChecked={false} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </article>
        </div>
      </section>
    </>
  )
}
