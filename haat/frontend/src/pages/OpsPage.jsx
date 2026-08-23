import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

/* ═══════════════════════════════════════════════════════════════════════════
   Platform activity.

   The ledger page shows one agent session. This shows all of them — every
   action taken against haat by any agent or shopper, including the refusals.

   It exists because "show the audit trail" should be a property of the platform
   rather than of a demo page. Anyone operating haat can answer, at any moment,
   what every agent did and why each decision went the way it did.
   ═══════════════════════════════════════════════════════════════════════════ */

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

const TONE = {
  blocked: 'var(--ember)',
  pending_approval: 'var(--brass)',
  allowed: 'var(--sage)',
}

export default function OpsPage() {
  const [data, setData] = useState(null)
  const [live, setLive] = useState(true)
  const [filter, setFilter] = useState('all')   // all | refused | money

  const load = useCallback(() => {
    fetch(`${API}/agent-commerce/activity?limit=120`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    if (!live) return
    const t = setInterval(load, 2500)
    return () => clearInterval(t)
  }, [load, live])

  const t = data?.totals
  const actions = (data?.actions ?? []).filter(a =>
    filter === 'all' ? true
    : filter === 'refused' ? (a.decision === 'blocked' || a.decision === 'pending_approval')
    : ['payment_confirmed', 'delivered', 'order_attempt', 'entitlement_reused'].includes(a.action_type),
  )

  return (
    <div className="h-wrap h-page">
      <div className="h-section-head">
        <div>
          <p className="h-eyebrow" style={{ marginBottom: 10 }}>Operations</p>
          <h1 className="h-title">Everything that happened.</h1>
          <p className="h-body h-muted" style={{ fontSize: 14, marginTop: 12, maxWidth: '58ch' }}>
            Every action taken against haat by any agent or shopper — the refusals included, each
            with the reason it was refused.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="h-chip" aria-pressed={live} onClick={() => setLive(l => !l)}>
            {live ? 'Live' : 'Paused'}
          </button>
          <Link to="/agent-checkout" className="h-btn h-btn-quiet">Agent ledger</Link>
        </div>
      </div>

      {!data && <p className="h-data h-faint">loading…</p>}

      {t && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1, background: 'var(--rule)', border: '1px solid var(--rule)', marginBottom: 36 }}>
            {[
              ['Value moved', t.gmv, 'var(--brass)'],
              ['Paid orders', `${t.paid_orders}`, null],
              ['By agents', `${t.by_agent}`, 'var(--brass)'],
              ['By people', `${t.by_people}`, null],
              ['Refused', `${t.blocked}`, t.blocked ? 'var(--ember)' : null],
              ['Gated', `${t.gated}`, t.gated ? 'var(--brass)' : null],
              ['Sessions', `${t.sessions}`, null],
            ].map(([label, value, colour]) => (
              <div key={label} style={{ background: 'var(--ink-raised)', padding: '18px 20px' }}>
                <div className="h-eyebrow" style={{ fontSize: 10, marginBottom: 9 }}>{label}</div>
                <div className="h-title" style={{ fontSize: 23, color: colour ?? 'var(--parchment)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* ── Sessions ─────────────────────────────────────────────────── */}
          {data.sessions.length > 0 && (
            <>
              <div className="h-section-head"><h2 className="h-eyebrow">Sessions</h2></div>
              <div style={{ overflowX: 'auto', marginBottom: 40 }}>
                <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Session', 'Actions', 'Refused', 'Gated', 'Spent', 'Last seen'].map((h, i) => (
                        <th key={h} className="h-eyebrow" style={{ fontSize: 10, textAlign: i ? 'right' : 'left', padding: '0 12px 11px', borderBottom: '1px solid var(--rule)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.sessions.map(s => (
                      <tr key={s.session_id}>
                        <td className="h-data" style={{ padding: '11px 12px', borderBottom: '1px solid var(--rule)', color: 'var(--parchment)' }}>
                          {s.session_id.startsWith('human:')
                            ? <span><span style={{ color: 'var(--faint)' }}>person </span>{s.session_id.slice(6)}</span>
                            : s.session_id}
                        </td>
                        {[
                          s.actions,
                          s.blocked,
                          s.gated,
                          s.spent,
                          new Date(s.last_at).toLocaleTimeString(),
                        ].map((v, i) => (
                          <td key={i} className="h-data" style={{
                            padding: '11px 12px', textAlign: 'right', borderBottom: '1px solid var(--rule)',
                            color: i === 1 && v > 0 ? 'var(--ember)' : i === 2 && v > 0 ? 'var(--brass)' : i === 3 ? 'var(--brass)' : 'var(--muted)',
                            whiteSpace: 'nowrap',
                          }}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Feed ─────────────────────────────────────────────────────── */}
          <div className="h-section-head">
            <h2 className="h-eyebrow">Activity</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['all', 'Everything'], ['refused', 'Refused & gated'], ['money', 'Money']].map(([v, l]) => (
                <button key={v} className="h-chip" aria-pressed={filter === v} onClick={() => setFilter(v)}>{l}</button>
              ))}
            </div>
          </div>

          <div style={{ border: '1px solid var(--rule)', background: 'var(--ink-sunken)' }}>
            {actions.length === 0 && (
              <p className="h-body h-muted" style={{ padding: '34px 20px', fontSize: 14 }}>
                Nothing recorded yet. Buy something, or run the scripted demo on the agent ledger.
              </p>
            )}
            {actions.map(a => (
              <div key={a.id} style={{
                display: 'grid', gridTemplateColumns: '78px 132px 1fr auto', gap: 14,
                padding: '11px 16px', borderBottom: '1px solid var(--rule)', alignItems: 'baseline',
              }}>
                <span className="h-data h-faint" style={{ fontSize: 11 }}>
                  {new Date(a.created_at).toTimeString().slice(0, 8)}
                </span>
                <span className="h-data" style={{ fontSize: 11, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.agent_session_id.startsWith('human:') ? 'person' : a.agent_session_id}
                </span>
                <span style={{ fontSize: 13.5, lineHeight: 1.5, color: a.decision === 'blocked' ? '#E8B9A6' : 'var(--parchment)' }}>
                  {a.reason}
                </span>
                <span className="h-tag" style={{ color: TONE[a.decision] ?? 'var(--faint)', fontSize: 9 }}>
                  {a.action_type.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
