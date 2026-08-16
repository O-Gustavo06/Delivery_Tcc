import React, { useEffect, useState } from 'react'

const formatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

// Fuso fixo em America/Sao_Paulo (Brasilia), independente do horario configurado no celular
// do motoboy. Atualiza a cada minuto - suficiente pra um relogio, sem re-render a cada segundo.
export default function Clock() {
  const [label, setLabel] = useState(() => formatter.format(new Date()))

  useEffect(() => {
    const timer = setInterval(() => setLabel(formatter.format(new Date())), 60000)
    return () => clearInterval(timer)
  }, [])

  return <span className="clock-chip">{label}</span>
}
