import React from 'react'

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': true,
}

export function IconRota(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21C12 21 19 14.5 19 9.5C19 5.9 15.87 3 12 3C8.13 3 5 5.9 5 9.5C5 14.5 12 21 12 21Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

export function IconScan(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 8V6C4 4.9 4.9 4 6 4H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 8V6C20 4.9 19.1 4 18 4H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 16V18C4 19.1 4.9 20 6 20H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 16V18C20 19.1 19.1 20 18 20H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconHistorico(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5V12L15 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconLogout(props) {
  return (
    <svg {...base} {...props}>
      <path d="M15 17L20 12L15 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 4H5C4.44772 4 4 4.44772 4 5V19C4 19.5523 4.44772 20 5 20H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
