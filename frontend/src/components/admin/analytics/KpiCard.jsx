// Reusable KPI card — auto-shrinks text to prevent overflow.
export default function KpiCard({ label, value, suffix }) {
  const valStr = String(value)
  // Shrink font when value is long to prevent card overflow
  const fontSize = valStr.length > 10 ? '1.1rem' : valStr.length > 7 ? '1.3rem' : '1.6rem'

  return (
    <div style={{
      background: '#fff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      padding: '20px',
      minWidth: 0,
      overflow: 'hidden',
    }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: '4px',
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
      }}>
        <span style={{ fontSize, fontWeight: 800, color: '#0f172a' }}>{value}</span>
        {suffix && (
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', flexShrink: 0 }}>{suffix}</span>
        )}
      </div>
    </div>
  )
}
