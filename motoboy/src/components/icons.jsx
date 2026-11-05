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

export function IconPedidos(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3.5H17C18.1 3.5 19 4.4 19 5.5V20.5L16.5 19L14 20.5L12 19L10 20.5L7.5 19L5 20.5V5.5C5 4.4 5.9 3.5 7 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.5 9H15.5M8.5 12.5H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconMapa(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 6.5L9 4L15 6.5L20.5 4V17.5L15 20L9 17.5L3.5 20V6.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 4V17.5M15 6.5V20" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

export function IconBack(props) {
  return (
    <svg {...base} {...props}>
      <path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconClock(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5V12L15 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconPhone(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 4.5H9L10.5 8.5L8.5 10C9.5 12 11 13.5 13.5 15.5L15 13.5L19 15V19C19 19.6 18.6 20 18 20C10.8 20 4 13.2 4 6C4 5.4 4.4 4.5 5 4.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

export function IconChat(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12C4 7.6 7.6 4 12 4C16.4 4 20 7.6 20 12C20 16.4 16.4 20 12 20C10.7 20 9.5 19.7 8.4 19.2L4 20L5 16C4.4 14.9 4 13.5 4 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

export function IconBag(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 8H19L18 20H6L5 8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 10V6.5C9 5 10.3 4 12 4C13.7 4 15 5 15 6.5V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconDinheiro(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="6.5" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

export function IconCheck(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12.5L10 17.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconChevron(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
