// Reusable KPI card for the analytics dashboard.
export default function KpiCard({ label, value, suffix, icon }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {icon && <span style={{ fontSize: '1.1rem' }}>{icon}</span>}
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>{value}</span>
        {suffix && (
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>{suffix}</span>
        )}
      </div>
    </div>
  )
}
