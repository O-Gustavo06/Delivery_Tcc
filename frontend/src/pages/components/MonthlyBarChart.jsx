import React, { useRef, useState } from 'react'

const MONTH_LABELS = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
}

const CHART_HEIGHT = 220
const CHART_WIDTH = 700
const TOP_PADDING = 8

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Grafico de barras agrupadas em SVG puro, sem lib externa - cores vem das variaveis CSS
// do proprio tema (--success/--danger/--info), entao acompanha claro/escuro automatico.
// Suporta valores negativos (ex: lucro no vermelho): as barras crescem a partir de uma
// linha de zero, pra cima ou pra baixo, em vez de sempre pra cima como se fossem positivas.
export default function MonthlyBarChart({ data, series }) {
  const containerRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  if (!data || data.length === 0) {
    return <div className="empty">Sem dados suficientes pra mostrar o grafico ainda.</div>
  }

  const allValues = data.flatMap((row) => series.map((s) => Number(row[s.key]) || 0))
  const maxPositivo = Math.max(0, ...allValues)
  const maxNegativo = Math.max(0, ...allValues.map((v) => -v))
  const amplitude = Math.max(1, maxPositivo + maxNegativo)
  const plotHeight = CHART_HEIGHT - TOP_PADDING
  const zeroY = TOP_PADDING + (maxPositivo / amplitude) * plotHeight

  const groupWidth = CHART_WIDTH / data.length
  const barWidth = Math.max(6, groupWidth / (series.length + 1.4))

  const mostrarTooltip = (event, label, value, color) => {
    const barRect = event.currentTarget.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()
    setTooltip({
      x: barRect.left + barRect.width / 2 - containerRect.left,
      y: barRect.top - containerRect.top,
      label,
      value,
      color,
    })
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 30}`} width="100%" height={CHART_HEIGHT + 30} role="img" aria-label="Grafico mensal">
        <line x1="0" y1={zeroY} x2={CHART_WIDTH} y2={zeroY} stroke="var(--line)" strokeWidth="1" />
        {data.map((row, groupIndex) => {
          const groupX = groupIndex * groupWidth
          return (
            <g key={row.mes}>
              {series.map((s, seriesIndex) => {
                const value = Number(row[s.key]) || 0
                const barHeight = (Math.abs(value) / amplitude) * plotHeight
                const x = groupX + seriesIndex * (barWidth + 4) + groupWidth * 0.1
                const y = value >= 0 ? zeroY - barHeight : zeroY
                return (
                  <rect
                    key={s.key}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(barHeight, 1)}
                    rx="3"
                    fill={s.color}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(event) => mostrarTooltip(event, s.label, value, s.color)}
                    onMouseMove={(event) => mostrarTooltip(event, s.label, value, s.color)}
                    onMouseLeave={() => setTooltip(null)}
                  />
                )
              })}
              <text
                x={groupX + groupWidth / 2}
                y={CHART_HEIGHT + 20}
                fontSize="11"
                textAnchor="middle"
                fill="var(--muted)"
              >
                {MONTH_LABELS[row.mes.slice(5)] || row.mes.slice(5)}
              </text>
            </g>
          )
        })}
      </svg>
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            marginTop: -8,
            background: 'var(--card-bg)',
            border: '1px solid var(--line)',
            borderRadius: 10,
            padding: '6px 11px',
            fontSize: 12.5,
            color: 'var(--text)',
            boxShadow: 'var(--shadow-soft)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
        >
          <strong style={{ color: tooltip.color }}>{tooltip.label}</strong>: {formatMoney(tooltip.value)}
        </div>
      )}
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key} className="chart-legend-item">
            <span className="chart-legend-dot" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
