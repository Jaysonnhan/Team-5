const paths = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4.2-4.2',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  camera:
    'M3 8h3l2-3h8l2 3h3v11H3V8ZM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  note: 'M6 3h9l4 4v14H6V3ZM15 3v4h4M9 12h6M9 16h4',
  question: 'M9 9a3 3 0 1 1 4 3c-1 .6-1 1.2-1 2M12 18h.01M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z',
  spark: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z',
  check: 'M4 13l5 5L20 6',
  clock: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18ZM12 7v5l3 2',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  book: 'M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4V5ZM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6V5Z',
  filter: 'M4 6h16M7 12h10M10 18h4',
  reset: 'M4 12a8 8 0 1 0 3-6.2M4 4v5h5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  lock: 'M7 11h10v9H7v-9ZM9 11V8a3 3 0 0 1 6 0v3',
  flag: 'M6 21V4h10l-1.5 3L16 10H6',
}

export default function Icon({ name, size = 18, className = '', strokeWidth = 1.7 }) {
  const d = paths[name] || paths.note
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  )
}
