const STATIONS = [
  { label: 'Präferenzen' },
  { label: 'Menü verfeinern' },
  { label: 'Services & Abschluss' },
]

function ForkIcon({ active }) {
  return (
    <svg
      viewBox="0 0 14 22"
      fill="none"
      stroke={active ? '#ffffff' : '#94a3b8'}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="14" height="22"
      aria-hidden
    >
      <line x1="3"  y1="2" x2="3"  y2="7" />
      <line x1="7"  y1="2" x2="7"  y2="7" />
      <line x1="11" y1="2" x2="11" y2="7" />
      <path d="M3 7 Q3 10 7 10 Q11 10 11 7" />
      <line x1="7" y1="10" x2="7" y2="20" />
    </svg>
  )
}

// step 1-2 → station 1 active, step 3 → 2, step 4 → 3
// Station index → target step when navigating back
const STATION_BACK_STEP = { 1: 2, 2: 3 }

export default function ProgressTimeline({ step, onNavigate }) {
  const active = step <= 2 ? 1 : step === 3 ? 2 : 3

  return (
    <div className="timeline">
      {STATIONS.map((station, i) => {
        const idx    = i + 1
        const isDone = idx < active
        const isCurr = idx === active
        const canNav = isDone && onNavigate && STATION_BACK_STEP[idx]

        return (
          <div className="timeline__item" key={station.label}>
            {i > 0 && (
              <div className={`timeline__connector${isDone ? ' timeline__connector--done' : ''}`} />
            )}

            <div
              className={`timeline__node${isCurr ? ' timeline__node--active' : isDone ? ' timeline__node--done' : ''}${canNav ? ' timeline__node--clickable' : ''}`}
              onClick={canNav ? () => onNavigate(STATION_BACK_STEP[idx]) : undefined}
              title={canNav ? 'Zurück zu diesem Schritt' : undefined}
            >
              <ForkIcon active={isCurr || isDone} />
            </div>

            <span className={`timeline__label${isCurr ? ' timeline__label--active' : ''}${canNav ? ' timeline__label--clickable' : ''}`}
                  onClick={canNav ? () => onNavigate(STATION_BACK_STEP[idx]) : undefined}>
              {station.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
