// Custom hook that derives all analytics data from raw entities.
import { useMemo } from 'react'

const STATUS_COLORS = {
  'neu': '#22c55e',
  'in bearbeitung': '#fbbf24',
  'angebot versendet': '#3b82f6',
  'abgeschlossen': '#037A8B',
  'storniert': '#ef4444',
}

function getFilteredByTime(items, timeRange, dateAccessor) {
  if (timeRange === 'all') return items
  const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return items.filter(item => {
    const d = dateAccessor(item)
    return d && new Date(d) >= cutoff
  })
}

function getGranularity(timeRange, items, dateAccessor) {
  if (timeRange === '90d') return 'weekly'
  if (timeRange === 'all') {
    if (items.length === 0) return 'daily'
    const dates = items.map(i => dateAccessor(i)).filter(Boolean).map(d => new Date(d))
    if (dates.length < 2) return 'daily'
    const min = Math.min(...dates)
    const max = Math.max(...dates)
    const diffDays = (max - min) / (1000 * 60 * 60 * 24)
    return diffDays > 90 ? 'monthly' : 'daily'
  }
  return 'daily'
}

function formatGroupKey(date, granularity) {
  const d = new Date(date)
  if (granularity === 'monthly') {
    return `${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
  }
  if (granularity === 'weekly') {
    const startOfYear = new Date(d.getFullYear(), 0, 1)
    const weekNum = Math.ceil(((d - startOfYear) / (1000 * 60 * 60 * 24) + startOfYear.getDay() + 1) / 7)
    return `KW ${String(weekNum).padStart(2, '0')}`
  }
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

function groupByDate(items, dateAccessor, granularity) {
  const groups = {}
  const sortKeys = {}
  items.forEach(item => {
    const raw = dateAccessor(item)
    if (!raw) return
    const key = formatGroupKey(raw, granularity)
    if (!groups[key]) {
      groups[key] = []
      sortKeys[key] = new Date(raw).getTime()
    }
    groups[key].push(item)
    const ts = new Date(raw).getTime()
    if (ts < sortKeys[key]) sortKeys[key] = ts
  })
  return Object.keys(groups)
    .sort((a, b) => sortKeys[a] - sortKeys[b])
    .map(key => ({ key, items: groups[key] }))
}

export default function useAnalyticsData({ orders = [], leads = [], feedbacks = [], dishes = [], users = [] }, timeRange) {

  const filteredOrders = useMemo(
    () => getFilteredByTime(orders, timeRange, o => o.created_at),
    [orders, timeRange]
  )

  // Leads use last_updated (Unix timestamp) instead of created_at
  const filteredLeads = useMemo(
    () => getFilteredByTime(leads, timeRange, l => l.last_updated ? new Date(l.last_updated * 1000).toISOString() : null),
    [leads, timeRange]
  )

  const filteredFeedbacks = useMemo(
    () => getFilteredByTime(feedbacks, timeRange, f => f.created_at),
    [feedbacks, timeRange]
  )

  const filteredUsers = useMemo(
    () => getFilteredByTime(users, timeRange, u => u.first_login_at || u.created_at),
    [users, timeRange]
  )

  const kpis = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total_price || 0), 0)
    const totalOrders = filteredOrders.length
    const activeLeads = filteredLeads.length
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
    const leadIdsWithOrders = new Set(filteredOrders.map(o => o.lead_id).filter(Boolean))
    const totalLeads = leads.length
    const conversionRate = totalLeads > 0 ? (leadIdsWithOrders.size / totalLeads) * 100 : 0

    return { totalRevenue, totalOrders, activeLeads, avgOrderValue, conversionRate }
  }, [filteredOrders, filteredLeads, leads])

  const revenueOverTime = useMemo(() => {
    const granularity = getGranularity(timeRange, filteredOrders, o => o.created_at)
    const grouped = groupByDate(filteredOrders, o => o.created_at, granularity)
    return grouped.map(({ key, items }) => ({
      date: key,
      umsatz: items.reduce((sum, o) => sum + (o.total_price || 0), 0),
    }))
  }, [filteredOrders, timeRange])

  const orderStatusPipeline = useMemo(() => {
    const counts = {}
    filteredOrders.forEach(o => {
      const s = o.status || 'neu'
      counts[s] = (counts[s] || 0) + 1
    })
    return Object.entries(STATUS_COLORS).map(([status, fill]) => ({
      status,
      count: counts[status] || 0,
      fill,
    }))
  }, [filteredOrders])

  // Uses the pre-computed popularity field from the dishes catalog
  const topDishes = useMemo(() => {
    return [...dishes]
      .filter(d => d.popularity > 0)
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 10)
      .map(d => ({ name: d.name, kategorie: d.kategorie || '', popularity: d.popularity || 0 }))
  }, [dishes])

  const feedbackTrend = useMemo(() => {
    const granularity = getGranularity(timeRange, filteredFeedbacks, f => f.created_at)
    const grouped = groupByDate(filteredFeedbacks, f => f.created_at, granularity)
    return grouped.map(({ key, items }) => {
      const ratings = items.map(f => f.rating).filter(r => typeof r === 'number')
      return {
        date: key,
        avgRating: ratings.length > 0 ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10 : 0,
        count: items.length,
      }
    })
  }, [filteredFeedbacks, timeRange])

  const userAcquisition = useMemo(() => {
    const granularity = getGranularity(timeRange, filteredUsers, u => u.first_login_at || u.created_at)
    const grouped = groupByDate(filteredUsers, u => u.first_login_at || u.created_at, granularity)
    let cumulative = 0
    return grouped.map(({ key, items }) => {
      cumulative += items.length
      return { date: key, newUsers: items.length, cumulative }
    })
  }, [filteredUsers, timeRange])

  return { kpis, revenueOverTime, orderStatusPipeline, topDishes, feedbackTrend, userAcquisition }
}
