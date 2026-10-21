import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  Activity, Search, Trash2, Download, Shield, AlertTriangle,
  CheckCircle, ChevronDown, ChevronUp, Calendar, Filter as FilterIcon,
  Globe, Clock, TrendingUp, Eye, X, Users,
} from 'lucide-react';
import { AppContext } from '../context/AppContext.jsx';
import { getActivityLog, clearActivityLog, getProfiles } from '../storage/storageService.js';
import { useTranslation } from '../hooks/useTranslation.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const CAT = {
  safe:              { color: '#10B981', label: 'Safe',          icon: '✅' },
  educational:       { color: '#3B82F6', label: 'Educational',   icon: '📚' },
  entertainment:     { color: '#8B5CF6', label: 'Entertainment', icon: '🎬' },
  news_category:     { color: '#6B7280', label: 'News',          icon: '📰' },
  violence_category: { color: '#EF4444', label: 'Violence',      icon: '⚔️' },
  adult_category:    { color: '#EC4899', label: 'Adult',         icon: '🔞' },
  gambling_category: { color: '#F59E0B', label: 'Gambling',      icon: '🎰' },
  drugs_category:    { color: '#F97316', label: 'Drugs',         icon: '💊' },
  hate_category:     { color: '#DC2626', label: 'Hate',          icon: '🚫' },
  keyword:           { color: '#F97316', label: 'Keyword',       icon: '🔤' },
  manual:            { color: '#EF4444', label: 'Blacklisted',   icon: '🛑' },
  bypass_attempt:    { color: '#7C3AED', label: 'Bypass',        icon: '🔓' },
  parent_override:   { color: '#059669', label: 'Override',      icon: '🔑' },
};

// ── Pure SVG Charts (no external lib) ────────────────────────────────────────

/** Bar chart: visits vs blocked per day */
function BarChart({ data }) {
  if (!data || data.length === 0) return null;
  const W = 520, H = 140, PAD = { t: 12, r: 10, b: 32, l: 38 };
  const cw = (W - PAD.l - PAD.r) / data.length;
  const maxV = Math.max(...data.map(d => d.visits), 1);

  const barH = (v) => ((v / maxV) * (H - PAD.t - PAD.b));
  const bx = (i) => PAD.l + i * cw + cw * 0.1;
  const bw = cw * 0.4;

  const yTicks = [0, Math.round(maxV / 2), maxV];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Grid lines */}
      {yTicks.map(v => {
        const y = PAD.t + (H - PAD.t - PAD.b) - barH(v);
        return (
          <g key={v}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
                  stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3,3" />
            <text x={PAD.l - 4} y={y + 4} textAnchor="end" fontSize="10"
                  fill="var(--color-text-muted)">{v}</text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const vh = barH(d.visits);
        const bh = barH(d.blocked);
        const base = H - PAD.b;
        return (
          <g key={i}>
            {/* Visits bar */}
            <rect x={bx(i)} y={base - vh} width={bw} height={vh}
                  fill="#3B82F6" rx="2" opacity="0.85" />
            {/* Blocked bar */}
            <rect x={bx(i) + bw + 1} y={base - bh} width={bw} height={bh}
                  fill="#EF4444" rx="2" opacity="0.85" />
            {/* X label */}
            <text x={bx(i) + bw} y={H - PAD.b + 14} textAnchor="middle"
                  fontSize="9" fill="var(--color-text-muted)">{d.label}</text>
          </g>
        );
      })}

      {/* Legend */}
      <rect x={PAD.l} y={H - 10} width={8} height={8} fill="#3B82F6" rx="1" />
      <text x={PAD.l + 11} y={H - 3} fontSize="9" fill="var(--color-text-muted)">Visits</text>
      <rect x={PAD.l + 52} y={H - 10} width={8} height={8} fill="#EF4444" rx="1" />
      <text x={PAD.l + 63} y={H - 3} fontSize="9" fill="var(--color-text-muted)">Blocked</text>
    </svg>
  );
}

/** Donut chart: category distribution */
function DonutChart({ data }) {
  if (!data || data.length === 0) return null;
  const R = 52, r = 30, CX = 70, CY = 70, W = 220, H = 140;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  let angle = -Math.PI / 2;
  const slices = data.map(d => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const start = angle;
    angle += sweep;
    return { ...d, start, sweep };
  });

  const arc = (cx, cy, R, start, sweep) => {
    const x1 = cx + R * Math.cos(start);
    const y1 = cy + R * Math.sin(start);
    const x2 = cx + R * Math.cos(start + sweep);
    const y2 = cy + R * Math.sin(start + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
  };

  const donutPath = (cx, cy, Ro, Ri, start, sweep) => {
    const x1o = cx + Ro * Math.cos(start), y1o = cy + Ro * Math.sin(start);
    const x2o = cx + Ro * Math.cos(start + sweep), y2o = cy + Ro * Math.sin(start + sweep);
    const x1i = cx + Ri * Math.cos(start + sweep), y1i = cy + Ri * Math.sin(start + sweep);
    const x2i = cx + Ri * Math.cos(start), y2i = cy + Ri * Math.sin(start);
    const large = sweep > Math.PI ? 1 : 0;
    return `M ${x1o} ${y1o} A ${Ro} ${Ro} 0 ${large} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${Ri} ${Ri} 0 ${large} 0 ${x2i} ${y2i} Z`;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Donut slices */}
      {slices.map((s, i) => (
        <path key={i} d={donutPath(CX, CY, R, r, s.start, Math.max(s.sweep - 0.02, 0.01))}
              fill={s.color} opacity="0.9" />
      ))}
      {/* Center text */}
      <text x={CX} y={CY - 4} textAnchor="middle" fontSize="14" fontWeight="bold"
            fill="var(--color-text)">{total}</text>
      <text x={CX} y={CY + 10} textAnchor="middle" fontSize="8"
            fill="var(--color-text-muted)">total</text>

      {/* Legend */}
      {data.slice(0, 6).map((d, i) => (
        <g key={i} transform={`translate(140, ${10 + i * 20})`}>
          <rect width="10" height="10" rx="2" fill={d.color} y="1" />
          <text x="14" y="10" fontSize="9" fill="var(--color-text)">
            {d.label} ({d.value})
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Heatmap: activity by hour of day */
function HourHeatmap({ data }) {
  // data: array of 24 numbers (visits per hour)
  const max = Math.max(...data, 1);
  const W = 520, H = 54, PAD = { l: 28, r: 8, t: 6, b: 20 };
  const cw = (W - PAD.l - PAD.r) / 24;

  const labels = [0, 3, 6, 9, 12, 15, 18, 21];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {data.map((v, h) => {
        const intensity = v / max;
        const x = PAD.l + h * cw;
        const y = PAD.t;
        const ch = H - PAD.t - PAD.b;
        // Color: blue tones for low, orange for high
        const r = Math.round(59 + intensity * 196);
        const g = Math.round(130 - intensity * 75);
        const b = Math.round(246 - intensity * 201);
        return (
          <g key={h}>
            <rect x={x + 1} y={y} width={cw - 2} height={ch}
                  fill={v === 0 ? 'var(--color-border)' : `rgb(${r},${g},${b})`}
                  rx="2" opacity={v === 0 ? 0.4 : 0.85} />
            {v > 0 && (
              <text x={x + cw / 2} y={y + ch / 2 + 4} textAnchor="middle"
                    fontSize="8" fill="white" fontWeight="bold">{v}</text>
            )}
          </g>
        );
      })}
      {labels.map(h => (
        <text key={h} x={PAD.l + h * cw + cw / 2} y={H - 2}
              textAnchor="middle" fontSize="9" fill="var(--color-text-muted)">
          {h}h
        </text>
      ))}
      <text x={0} y={PAD.t + (H - PAD.t - PAD.b) / 2 + 4} fontSize="9"
            fill="var(--color-text-muted)" textAnchor="middle"
            transform={`rotate(-90, 10, ${PAD.t + 15})`}>h</text>
    </svg>
  );
}

// ── Expandable row ─────────────────────────────────────────────────────────────
function ActivityRow({ entry, profileName }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const cat  = CAT[entry.category] || { color: '#9CA3AF', label: entry.category, icon: '📄' };
  const conf = entry.confidence ? Math.round(entry.confidence * 100) : null;

  let hostname = entry.url;
  try { hostname = new URL(entry.url).hostname.replace('www.', ''); } catch {}

  const isRussian = entry.url?.includes('.ru') || entry.url?.includes('.рф');

  return (
    <>
      <tr
        className="cursor-pointer hover:opacity-90 transition-opacity"
        style={{ borderBottom: '1px solid var(--color-border)' }}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Time */}
        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
          <div>{new Date(entry.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
          <div className="font-medium">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </td>

        {/* Site */}
        <td className="px-4 py-3 max-w-xs">
          <div className="flex items-center gap-2">
            {/* Favicon */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=16`}
              alt="" width={16} height={16}
              className="rounded flex-shrink-0"
              onError={e => e.target.style.display = 'none'}
            />
            <div className="min-w-0">
              <div className="font-medium text-sm truncate flex items-center gap-1" style={{ color: 'var(--color-text)' }}>
                {entry.title || hostname}
                {isRussian && <span className="text-xs">🇷🇺</span>}
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{hostname}</div>
            </div>
          </div>
        </td>

        {/* Profile/Child */}
        <td className="px-4 py-3">
          <span className="text-xs font-medium px-2 py-1 rounded-full"
                style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--color-primary)' }}>
            👤 {profileName || '—'}
          </span>
        </td>

        {/* Category */}
        <td className="px-4 py-3">
          <span className="badge text-xs" style={{ background: `${cat.color}18`, color: cat.color }}>
            {cat.icon} {cat.label}
          </span>
        </td>

        {/* Decision */}
        <td className="px-4 py-3">
          <span className="badge text-xs font-semibold" style={{
            background: entry.decision === 'blocked' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            color: entry.decision === 'blocked' ? '#EF4444' : '#10B981',
          }}>
            {entry.decision === 'blocked' ? '🚫' : '✅'} {t(entry.decision)}
          </span>
        </td>

        {/* Confidence */}
        <td className="px-4 py-3">
          {conf !== null && conf > 0 ? (
            <div className="flex items-center gap-2">
              <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                <div className="h-full rounded-full" style={{ width: `${conf}%`, background: cat.color }} />
              </div>
              <span className="text-xs font-bold" style={{ color: cat.color }}>{conf}%</span>
            </div>
          ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
        </td>

        {/* Expand */}
        <td className="px-3 py-3">
          <div style={{ color: 'var(--color-text-muted)' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
          <td colSpan={7} className="px-6 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                   style={{ color: 'var(--color-text-muted)' }}>Full URL</p>
                <a href={entry.url} target="_blank" rel="noreferrer"
                   className="text-xs break-all hover:underline"
                   style={{ color: 'var(--color-primary)' }}
                   onClick={e => e.stopPropagation()}>
                  {entry.url}
                </a>
              </div>
              {entry.explanation && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                     style={{ color: 'var(--color-text-muted)' }}>AI Analysis</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text)' }}>
                    {entry.explanation}
                  </p>
                </div>
              )}
              {entry.reason && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1"
                     style={{ color: 'var(--color-text-muted)' }}>Reason</p>
                  <code className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--color-border)', color: 'var(--color-text)' }}>
                    {entry.reason}
                  </code>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ActivityView() {
  const { t } = useTranslation();
  const { lang } = useContext(AppContext);

  const [log, setLog]                   = useState([]);
  const [profiles, setProfiles]         = useState([]);
  const [search, setSearch]             = useState('');
  const [filterDecision, setFilterDecision] = useState('all');
  const [filterProfile, setFilterProfile]   = useState('all');
  const [filterCat, setFilterCat]           = useState('all');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [activeView, setActiveView]     = useState('table'); // 'table' | 'charts'
  const [confirmClear, setConfirmClear] = useState(false);
  const [showFilters, setShowFilters]   = useState(false);
  const [page, setPage]                 = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [data, profs] = await Promise.all([getActivityLog(), getProfiles()]);
    setLog(data);
    setProfiles(profs);
  };

  const handleClear = async () => {
    await clearActivityLog();
    setLog([]);
    setConfirmClear(false);
  };

  // ── Profile name lookup ──────────────────────────────────────────────────────
  const profileName = (id) => profiles.find(p => p.id === id)?.name || null;

  // NOTE: activity log entries don't carry profileId yet — we show the active profile name
  // For a future improvement, the service worker would tag each entry with profileId
  const firstProfileName = profiles[0]?.name || null;

  // ── Filtered log ──────────────────────────────────────────────────────────────
  const filtered = log.filter(e => {
    if (filterDecision !== 'all' && e.decision !== filterDecision) return false;
    if (filterCat !== 'all' && e.category !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(e.url || '').toLowerCase().includes(q) &&
          !(e.title || '').toLowerCase().includes(q)) return false;
    }
    if (dateFrom) {
      if (new Date(e.timestamp) < new Date(dateFrom)) return false;
    }
    if (dateTo) {
      if (new Date(e.timestamp) > new Date(dateTo + 'T23:59:59')) return false;
    }
    return true;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // ── Chart data computation ────────────────────────────────────────────────────
  const chartData = (() => {
    // Last 7 days bar chart
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toDateString();
      const label = d.toLocaleDateString([], { weekday: 'short' });
      const dayLog = log.filter(e => new Date(e.timestamp).toDateString() === key);
      days.push({
        label,
        visits:  dayLog.length,
        blocked: dayLog.filter(e => e.decision === 'blocked').length,
      });
    }

    // Category donut
    const catCount = {};
    for (const e of log) {
      const c = e.category || 'safe';
      catCount[c] = (catCount[c] || 0) + 1;
    }
    const donut = Object.entries(catCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([cat, value]) => ({
        label: CAT[cat]?.label || cat,
        value,
        color: CAT[cat]?.color || '#9CA3AF',
      }));

    // Hourly heatmap
    const hours = new Array(24).fill(0);
    for (const e of log) hours[new Date(e.timestamp).getHours()]++;

    return { days, donut, hours };
  })();

  // ── Summary stats ─────────────────────────────────────────────────────────────
  const today = new Date().toDateString();
  const todayLog = log.filter(e => new Date(e.timestamp).toDateString() === today);
  const totalBlocked = log.filter(e => e.decision === 'blocked').length;
  const bypasses = log.filter(e => e.category === 'bypass_attempt').length;


  // Unique categories present
  const allCats = [...new Set(log.map(e => e.category).filter(Boolean))];

  const L = (fr, ru, en) => lang === 'fr' ? fr : lang === 'ru' ? ru : en;

  return (
    <div className="p-6 space-y-5 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
            {L("Historique d'activité", "История активности", "Activity History")}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {log.length} {L('entrées au total', 'записей всего', 'entries total')}
            {' · '}
            {todayLog.length} {L("aujourd'hui", 'сегодня', 'today')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--color-border)' }}>
            {[
              { v: 'table',  l: L('Tableau', 'Таблица', 'Table') },
              { v: 'charts', l: L('Graphiques', 'Графики', 'Charts') },
            ].map(({ v, l }) => (
              <button key={v} onClick={() => setActiveView(v)}
                      className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                      style={{
                        background: activeView === v ? 'var(--color-surface)' : 'transparent',
                        color: activeView === v ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      }}>
                {l}
              </button>
            ))}
          </div>

          <button onClick={() => {
            const headers = ['Time', 'URL', 'Title', 'Profile', 'Category', 'Decision', 'Confidence', 'Explanation'];
            const rows = filtered.map(e => [
              new Date(e.timestamp).toLocaleString(), e.url, e.title || '',
              firstProfileName || '', e.category || '', e.decision || '',
              e.confidence ? `${Math.round(e.confidence * 100)}%` : '', e.explanation || '',
            ]);
            const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
            a.download = `safeguard-${Date.now()}.csv`;
            a.click();
          }} className="btn btn-ghost gap-2 text-sm">
            <Download size={14} /> CSV
          </button>

          <button onClick={() => setConfirmClear(true)}
                  className="btn gap-2 text-sm"
                  style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
            <Trash2 size={14} /> {t('clearHistory')}
          </button>
        </div>
      </div>

      {/* ── Summary cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: L('Total', 'Всего', 'Total'),              value: log.length,     color: '#3B82F6', icon: <Activity size={16}/> },
          { label: L('Bloqués', 'Заблокировано', 'Blocked'),  value: totalBlocked,   color: '#EF4444', icon: <Shield size={16}/> },
          { label: L('Tentatives', 'Попыток', 'Bypasses'),    value: bypasses,       color: '#7C3AED', icon: <AlertTriangle size={16}/> },

        ].map(({ label, value, color, icon }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: `${color}1A`, color }}>
              {icon}
            </div>
            <div>
              <div className="text-xl font-bold" style={{ color }}>{value}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── CHARTS VIEW ──────────────────────────────────────────────────────── */}
      {activeView === 'charts' && (
        <div className="space-y-5">
          {/* Bar chart */}
          <div className="card p-5">
            <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text)' }}>
              📊 {L('Activité des 7 derniers jours', 'Активность за 7 дней', 'Last 7 days activity')}
            </h3>
            <BarChart data={chartData.days} />
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Donut */}
            <div className="card p-5">
              <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text)' }}>
                🍩 {L('Répartition des catégories', 'Распределение категорий', 'Category distribution')}
              </h3>
              <DonutChart data={chartData.donut} />
            </div>

            {/* Hourly heatmap */}
            <div className="card p-5">
              <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text)' }}>
                🕐 {L('Activité par heure', 'Активность по часам', 'Activity by hour')}
              </h3>
              <HourHeatmap data={chartData.hours} />
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                {L('Heures les plus actives de la journée', 'Самые активные часы дня', 'Most active hours of the day')}
              </p>
            </div>
          </div>

          {/* Top sites */}
          <div className="card p-5">
            <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text)' }}>
              🌐 {L('Top 10 des sites visités', 'Топ 10 посещённых сайтов', 'Top 10 visited sites')}
            </h3>
            {(() => {
              const siteCounts = {};
              for (const e of log) {
                let h = e.url;
                try { h = new URL(e.url).hostname.replace('www.', ''); } catch {}
                siteCounts[h] = (siteCounts[h] || 0) + 1;
              }
              const top = Object.entries(siteCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
              const maxC = top[0]?.[1] || 1;
              return (
                <div className="space-y-2">
                  {top.map(([site, count], i) => {
                    const isRu = site.includes('.ru') || site.includes('.рф');
                    const pct = Math.round((count / maxC) * 100);
                    const blocked = log.filter(e => {
                      let h = e.url; try { h = new URL(e.url).hostname.replace('www.', ''); } catch {}
                      return h === site && e.decision === 'blocked';
                    }).length;
                    return (
                      <div key={site} className="flex items-center gap-3">
                        <span className="text-xs w-5 text-right font-bold"
                              style={{ color: 'var(--color-text-muted)' }}>{i + 1}</span>
                        <img src={`https://www.google.com/s2/favicons?domain=${site}&sz=16`}
                             alt="" width={14} height={14} className="flex-shrink-0"
                             onError={e => e.target.style.display = 'none'} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>
                              {site}
                            </span>
                            {isRu && <span className="text-xs">🇷🇺</span>}
                            {blocked > 0 && (
                              <span className="text-xs px-1 rounded"
                                    style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                                {blocked}x🚫
                              </span>
                            )}
                          </div>
                          <div className="progress-bar" style={{ height: 4 }}>
                            <div className="progress-fill" style={{ width: `${pct}%`, background: '#3B82F6' }} />
                          </div>
                        </div>
                        <span className="text-xs font-bold w-8 text-right"
                              style={{ color: 'var(--color-text)' }}>{count}</span>
                      </div>
                    );
                  })}
                  {top.length === 0 && (
                    <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                      {t('noActivity')}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── TABLE VIEW ──────────────────────────────────────────────────────── */}
      {activeView === 'table' && (
        <div className="space-y-4">
          {/* Search + filter bar */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--color-text-muted)' }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                     placeholder={t('search')} className="input pl-9 text-sm" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--color-text-muted)' }}>
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Quick filters */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--color-border)' }}>
              {['all', 'blocked', 'allowed'].map(f => (
                <button key={f} onClick={() => { setFilterDecision(f); setPage(1); }}
                        className="px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize"
                        style={{
                          background: filterDecision === f ? 'var(--color-surface)' : 'transparent',
                          color: filterDecision === f ? 'var(--color-text)' : 'var(--color-text-muted)',
                        }}>
                  {f === 'all' ? L('Tout', 'Все', 'All') : f === 'blocked' ? t('blocked') : t('allowed')}
                </button>
              ))}
            </div>

            <button onClick={() => setShowFilters(v => !v)}
                    className="btn btn-ghost gap-2 text-sm">
              <FilterIcon size={14} />
              {L('Filtres', 'Фильтры', 'Filters')}
              {(filterCat !== 'all' || dateFrom || dateTo) && (
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary)' }} />
              )}
            </button>
          </div>

          {/* Advanced filters panel */}
          {showFilters && (
            <div className="card p-4 grid grid-cols-3 gap-4 animate-fade-in">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  {L('Catégorie', 'Категория', 'Category')}
                </label>
                <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1); }}
                        className="input text-sm">
                  <option value="all">{L('Toutes', 'Все', 'All')}</option>
                  {allCats.map(c => (
                    <option key={c} value={c}>{CAT[c]?.icon} {CAT[c]?.label || c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  {L('Du', 'С', 'From')}
                </label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                       className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  {L('Au', 'По', 'To')}
                </label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                       className="input text-sm" />
              </div>
            </div>
          )}

          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {filtered.length} {L('résultats', 'результатов', 'results')}
              {filtered.length !== log.length && ` (${log.length} ${L('total', 'всего', 'total')})`}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="btn btn-ghost px-2 py-1 text-xs disabled:opacity-40">←</button>
                <span>{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="btn btn-ghost px-2 py-1 text-xs disabled:opacity-40">→</button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            {paginated.length === 0 ? (
              <div className="p-12 text-center">
                <Activity size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--color-text)' }} />
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {log.length === 0 ? t('noActivity') : L('Aucun résultat', 'Нет результатов', 'No results')}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: 'var(--color-bg)', borderBottom: '2px solid var(--color-border)' }}>
                      {[
                        L('Heure', 'Время', 'Time'),
                        L('Site', 'Сайт', 'Site'),
                        L('Profil', 'Профиль', 'Profile'),
                        L('Catégorie', 'Категория', 'Category'),
                        L('Décision', 'Решение', 'Decision'),
                        L('Confiance', 'Уверенность', 'Confidence'),
                        '',
                      ].map((h, i) => (
                        <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                            style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(entry => (
                      <ActivityRow
                        key={entry.id}
                        entry={entry}
                        profileName={entry.profileName || firstProfileName}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Clear confirm ────────────────────────────────────────────────────── */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="card w-full max-w-sm p-6 animate-slide-up">
            <h3 className="text-lg font-bold text-center mb-2" style={{ color: 'var(--color-text)' }}>
              {t('clearHistory')}
            </h3>
            <p className="text-sm text-center mb-6" style={{ color: 'var(--color-text-muted)' }}>
              {L('Tout l\'historique sera supprimé définitivement.',
                 'Вся история будет удалена безвозвратно.',
                 'All history will be permanently deleted.')}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmClear(false)} className="btn btn-ghost flex-1">{t('cancel')}</button>
              <button onClick={handleClear} className="btn btn-danger flex-1">{t('delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
