// Admin card showing user profile details and login history.
export default function UserProfileCard({ profile }) {
  if (!profile) return null
  const { user } = profile

  const formatDate = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const formatCurrency = (n) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0)
  }

  const companies = user.associated_companies || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%', background: '#037A8B',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', fontWeight: 800, flexShrink: 0
        }}>
          {(user.name || user.email || '?')[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{user.name || 'Kein Name'}</div>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{user.email}</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        <StatBox label="Erster Login" value={formatDate(user.first_login_at)} />
        <StatBox label="Letzter Login" value={formatDate(user.last_login_at)} />
        <StatBox label="Login-Anzahl" value={user.login_count || 0} />
        <StatBox label="Umsatz" value={formatCurrency(user.total_spent)} highlight />
        <StatBox label="Bestellungen" value={user.total_orders || 0} span2 />
      </div>

      {/* Companies */}
      {companies.length > 0 && (
        <div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '8px' }}>Firmen</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {companies.map((c, i) => (
              <span key={i} style={{
                background: '#e0f2fe', color: '#0369a1', padding: '4px 12px',
                borderRadius: '20px', fontSize: '0.82rem', fontWeight: 600
              }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, highlight, span2 }) {
  return (
    <div style={{
      background: '#f8fafc', borderRadius: '8px', padding: '12px',
      gridColumn: span2 ? 'span 2' : undefined,
    }}>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>{label}</div>
      <div style={{
        fontSize: highlight ? '1.1rem' : '0.95rem',
        fontWeight: 700,
        color: highlight ? '#037A8B' : '#0f172a'
      }}>
        {value}
      </div>
    </div>
  )
}
