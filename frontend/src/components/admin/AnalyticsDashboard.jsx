// Main analytics dashboard for the CaterNow admin panel.
import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, Cell, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import KpiCard from './analytics/KpiCard'
import ChartCard from './analytics/ChartCard'
import useAnalyticsData from './analytics/useAnalyticsData'

const TIME_OPTIONS = [
  { key: '7d', label: '7T' },
  { key: '30d', label: '30T' },
  { key: '90d', label: '90T' },
  { key: 'all', label: 'Alle' },
]

function formatCurrency(n) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
}

// Compact number formatting for Y-axis labels (1200 → "1,2k", 1500000 → "1,5M")
function formatCompact(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}M`
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}k`
  return n.toLocaleString('de-DE')
}

function truncate(str, max) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '...' : str
}

export default function AnalyticsDashboard({ orders, leads, feedbacks, dishes, users, systemHealth }) {
  const [timeRange, setTimeRange] = useState('30d')

  const {
    kpis, revenueOverTime, orderStatusPipeline,
    topDishes, feedbackTrend, userAcquisition,
  } = useAnalyticsData({ orders, leads, feedbacks, dishes, users }, timeRange)

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '24px', flexWrap: 'wrap', gap: '12px',
      }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Dashboard</h1>
        <div style={{
          display: 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '3px',
        }}>
          {TIME_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setTimeRange(opt.key)}
              style={{
                padding: '6px 14px', borderRadius: '8px', border: 'none',
                fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                background: timeRange === opt.key ? '#fff' : 'transparent',
                color: timeRange === opt.key ? '#0f172a' : '#64748b',
                boxShadow: timeRange === opt.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards — 3 columns on narrow, 5 on wide */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <KpiCard label="Gesamtumsatz" value={formatCurrency(kpis.totalRevenue)} suffix="€" />
        <KpiCard label="Bestellungen" value={kpis.totalOrders} />
        <KpiCard label="Aktive Leads" value={kpis.activeLeads} />
        <KpiCard label="Ø Bestellwert" value={formatCurrency(kpis.avgOrderValue)} suffix="€" />
        <KpiCard label="Conversion" value={kpis.conversionRate.toFixed(1)} suffix="%" />
      </div>

      {/* Revenue Chart */}
      <div style={{ marginBottom: '24px' }}>
        <ChartCard title="Umsatzentwicklung">
          {revenueOverTime.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '0.9rem' }}>
              Noch keine Umsatzdaten vorhanden.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenueOverTime} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={60} tickFormatter={v => `${formatCompact(v)} €`} />
                <Tooltip formatter={v => [`${formatCurrency(v)} €`, 'Umsatz']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="umsatz" stroke="#037A8B" strokeWidth={2} fill="#037A8B" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Order Status + Top Dishes — stack on narrow screens */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        <ChartCard title="Bestellstatus-Verteilung">
          {orderStatusPipeline.every(s => s.count === 0) ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '0.9rem' }}>
              Keine Bestellungen vorhanden.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={orderStatusPipeline} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <YAxis dataKey="status" type="category" tick={{ fontSize: 11, fill: '#475569' }} width={110} tickLine={false} axisLine={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {orderStatusPipeline.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Top 10 Gerichte">
          {topDishes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '0.9rem' }}>
              Keine Gerichtdaten vorhanden.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topDishes} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#475569' }} width={130} tickFormatter={v => truncate(v, 20)} tickLine={false} axisLine={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v, _, props) => [v, props.payload.name]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="popularity" fill="#037A8B" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Feedback Trend + User Acquisition */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        <ChartCard title="Bewertungsverlauf">
          {feedbackTrend.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '0.9rem' }}>
              Keine Bewertungen vorhanden.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={feedbackTrend} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" domain={[0, 5]} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => v.toFixed(1)} tickLine={false} axisLine={false} width={35} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={30} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="count" yAxisId="right" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Anzahl" />
                <Line type="monotone" dataKey="avgRating" yAxisId="left" stroke="#037A8B" strokeWidth={2} dot={{ fill: '#037A8B', r: 3 }} name="Ø Bewertung" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Neue Nutzer">
          {userAcquisition.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '0.9rem' }}>
              Keine Nutzerdaten vorhanden.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={userAcquisition} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={30} />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === 'cumulative') return [value, 'Gesamt']
                    return [value, 'Neue Nutzer']
                  }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="cumulative" stroke="#037A8B" strokeWidth={2} fill="#037A8B" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* System Health */}
      {systemHealth && (
        <div style={{
          background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0',
          padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>System Health</span>
          <HealthDot label="Gemini API" ok={systemHealth.geminiOk} />
          <HealthDot label="Firebase Auth" ok={systemHealth.firebaseOk} />
          <HealthDot label="Research Webhook" ok={systemHealth.researchOk} />
        </div>
      )}
    </div>
  )
}

function HealthDot({ label, ok }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{
        width: '10px', height: '10px', borderRadius: '50%',
        background: ok ? '#22c55e' : '#ef4444',
        boxShadow: ok ? '0 0 6px rgba(34,197,94,0.4)' : '0 0 6px rgba(239,68,68,0.4)',
      }} />
      <span style={{ fontSize: '0.82rem', color: '#475569' }}>{label}</span>
    </div>
  )
}
