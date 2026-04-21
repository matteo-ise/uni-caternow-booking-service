// Wrapper card for chart sections in the analytics dashboard.
export default function ChartCard({ title, subtitle, children }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      padding: '32px',
    }}>
      {title && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>{title}</h3>
          {subtitle && (
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>{subtitle}</div>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
