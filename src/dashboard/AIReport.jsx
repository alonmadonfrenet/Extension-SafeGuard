import React, { useState, useEffect, useContext } from 'react';
import {
  Brain, RefreshCw, AlertTriangle, CheckCircle, TrendingUp,
  TrendingDown, Shield, Clock, FileText, ChevronDown, ChevronUp,
  Users, Activity, BarChart2,
} from 'lucide-react';
import { AppContext } from '../context/AppContext.jsx';
import { useTranslation } from '../hooks/useTranslation.js';
import { getActivityLog, getProfiles, getActiveProfileId } from '../storage/storageService.js';

// ── Category config ───────────────────────────────────────────────────────────
const CAT_LABEL = {
  safe: 'Safe', educational: 'Educational', entertainment: 'Entertainment',
  news_category: 'News', violence_category: 'Violence', adult_category: 'Adult Content',
  gambling_category: 'Gambling', drugs_category: 'Drugs', hate_category: 'Hate Speech',
  keyword: 'Blocked Keyword', manual: 'Blacklisted', bypass_attempt: 'Bypass Attempt',
  schedule: 'Schedule Block', parent_override: 'Parent Override',
};
const CAT_COLOR = {
  safe: '#10B981', educational: '#3B82F6', entertainment: '#8B5CF6',
  news_category: '#6B7280', violence_category: '#EF4444', adult_category: '#EC4899',
  gambling_category: '#F59E0B', drugs_category: '#F97316', hate_category: '#DC2626',
  keyword: '#F97316', manual: '#EF4444', bypass_attempt: '#7C3AED',
  schedule: '#6366F1', parent_override: '#059669',
};
const HARMFUL = [
  'violence_category','adult_category','gambling_category',
  'drugs_category','hate_category','keyword','manual','bypass_attempt',
];

// ── Deep data analysis engine ─────────────────────────────────────────────────
function analyzeData(log, period) {
  const cutoff = Date.now() - period * 24 * 60 * 60 * 1000;
  const recent = log.filter(e => new Date(e.timestamp).getTime() > cutoff);
  if (recent.length === 0) return null;

  const blocked   = recent.filter(e => e.decision === 'blocked');
  const bypasses  = recent.filter(e => e.category === 'bypass_attempt');
  const harmful   = recent.filter(e => HARMFUL.includes(e.category));

  // Category breakdown
  const catCount = {};
  for (const e of recent) {
    const c = e.category || 'safe';
    catCount[c] = (catCount[c] || 0) + 1;
  }

  // Top sites
  const siteCounts = {}, blockedSites = {}, bypassSites = {};
  for (const e of recent) {
    let h = e.url || ''; try { h = new URL(e.url).hostname.replace('www.',''); } catch {}
    siteCounts[h] = (siteCounts[h] || 0) + 1;
  }
  for (const e of blocked) {
    let h = e.url || ''; try { h = new URL(e.url).hostname.replace('www.',''); } catch {}
    blockedSites[h] = (blockedSites[h] || 0) + 1;
  }
  for (const e of bypasses) {
    let h = e.url || ''; try { h = new URL(e.url).hostname.replace('www.',''); } catch {}
    bypassSites[h] = (bypassSites[h] || 0) + 1;
  }

  const topSites       = Object.entries(siteCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const topBlocked     = Object.entries(blockedSites).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const persistBypass  = Object.entries(bypassSites).filter(([,c])=>c>=2).sort((a,b)=>b[1]-a[1]);
  const topCategories  = Object.entries(catCount).sort((a,b)=>b[1]-a[1]);

  // Temporal patterns
  const hourCounts = new Array(24).fill(0);
  const dayCounts  = new Array(7).fill(0);
  for (const e of recent) {
    hourCounts[new Date(e.timestamp).getHours()]++;
    dayCounts[new Date(e.timestamp).getDay()]++;
  }
  const peakHour    = hourCounts.indexOf(Math.max(...hourCounts));
  const lateNight   = hourCounts.slice(22).concat(hourCounts.slice(0,6)).reduce((a,b)=>a+b,0);
  const lateNightPct= recent.length > 0 ? (lateNight / recent.length) * 100 : 0;
  const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const busiestDay  = DAY_NAMES[dayCounts.indexOf(Math.max(...dayCounts))];

  // Daily trend
  const dailyVisits = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    dailyVisits.push(recent.filter(e => new Date(e.timestamp).toDateString() === d.toDateString()).length);
  }
  const trendUp = dailyVisits.slice(-3).reduce((a,b)=>a+b,0) > dailyVisits.slice(0,3).reduce((a,b)=>a+b,0);

  const eduCount  = catCount['educational'] || 0;
  const eduRate   = recent.length > 0 ? eduCount / recent.length : 0;
  const blockRate = recent.length > 0 ? blocked.length / recent.length : 0;
  const riskScore = Math.min(100, Math.round(
    (harmful.length / Math.max(recent.length, 1)) * 55 +
    (bypasses.length / Math.max(recent.length, 1)) * 35 +
    (lateNightPct > 20 ? 10 : lateNightPct > 10 ? 5 : 0)
  ));

  return {
    total: recent.length, blocked: blocked.length, blockRate,
    bypasses, harmful, catCount, topCategories,
    topSites, topBlocked, persistBypass,
    peakHour, lateNightPct, busiestDay, dailyVisits, trendUp,
    eduCount, eduRate, riskScore, period,
  };
}

// ── Expert system — generates a structured narrative report ──────────────────
// This is a local rule-based NLG (Natural Language Generation) engine.
// It reads the actual data and composes personalised text without any API call.
function generateLocalReport(profile, data, lang) {
  const L  = (en, fr, ru) => lang === 'fr' ? fr : lang === 'ru' ? ru : en;
  const n  = profile.name;
  const ag = profile.ageGroup;
  const pct = (v, tot) => `${Math.round((v / Math.max(tot, 1)) * 100)}%`;

  // ── Section 1: Summary ──────────────────────────────────────────────────────
  let summary = '';
  if (data.total === 0) {
    summary = L(
      `No browsing activity was recorded for ${n} during this period.`,
      `Aucune activité de navigation enregistrée pour ${n} sur cette période.`,
      `За этот период активность ${n} не зафиксирована.`
    );
  } else {
    const riskWord = data.riskScore < 25
      ? L('low','faible','низким')
      : data.riskScore < 55
      ? L('moderate','modéré','умеренным')
      : L('elevated','élevé','повышенным');

    const blockSentence = data.blocked > 0
      ? L(
          `Out of ${data.total} pages visited, ${data.blocked} were blocked (${pct(data.blocked, data.total)}).`,
          `Sur ${data.total} pages visitées, ${data.blocked} ont été bloquées (${pct(data.blocked, data.total)}).`,
          `Из ${data.total} посещённых страниц ${data.blocked} заблокировано (${pct(data.blocked, data.total)}).`
        )
      : L(
          `${data.total} pages were visited with no content blocked.`,
          `${data.total} pages visitées sans aucun blocage.`,
          `${data.total} страниц посещено без блокировок.`
        );

    summary = L(
      `${n}'s browsing activity over the last ${data.period} days shows a ${riskWord} risk level (score: ${data.riskScore}/100). ${blockSentence}`,
      `L'activité de navigation de ${n} sur les ${data.period} derniers jours présente un niveau de risque ${riskWord} (score : ${data.riskScore}/100). ${blockSentence}`,
      `Активность ${n} за последние ${data.period} дн. демонстрирует ${riskWord} уровень риска (оценка: ${data.riskScore}/100). ${blockSentence}`
    );
  }

  // ── Section 2: Key findings (data-driven bullets) ───────────────────────────
  const findings = [];

  // Peak hours
  findings.push(L(
    `Peak activity detected at ${data.peakHour}:00–${data.peakHour + 1}:00, busiest on ${data.busiestDay}s.`,
    `Pic d'activité détecté à ${data.peakHour}h–${data.peakHour + 1}h, surtout le ${data.busiestDay}.`,
    `Пик активности: ${data.peakHour}:00–${data.peakHour + 1}:00, активнее всего в ${data.busiestDay}.`
  ));

  // Educational content
  if (data.eduRate > 0.3) {
    findings.push(L(
      `${pct(data.eduCount, data.total)} of browsing is educational content (${data.eduCount} pages) — a positive behaviour to encourage.`,
      `${pct(data.eduCount, data.total)} de la navigation est du contenu éducatif (${data.eduCount} pages) — un comportement positif à encourager.`,
      `${pct(data.eduCount, data.total)} просмотров — образовательный контент (${data.eduCount} стр.) — позитивная тенденция.`
    ));
  } else if (data.eduRate > 0) {
    findings.push(L(
      `Educational content represents only ${pct(data.eduCount, data.total)} of activity (${data.eduCount} pages).`,
      `Le contenu éducatif représente seulement ${pct(data.eduCount, data.total)} de l'activité (${data.eduCount} pages).`,
      `Образовательный контент — лишь ${pct(data.eduCount, data.total)} активности (${data.eduCount} стр.).`
    ));
  }

  // Top visited sites
  if (data.topSites.length > 0) {
    const siteList = data.topSites.slice(0, 3).map(([s, c]) => `${s} (${c}×)`).join(', ');
    findings.push(L(
      `Most visited sites: ${siteList}.`,
      `Sites les plus visités : ${siteList}.`,
      `Наиболее посещаемые сайты: ${siteList}.`
    ));
  }

  // Trend
  if (data.dailyVisits.some(v => v > 0)) {
    findings.push(
      data.trendUp
        ? L(`Browsing activity is increasing compared to the beginning of the period.`,
            `L'activité de navigation est en hausse par rapport au début de la période.`,
            `Активность просмотра растёт по сравнению с началом периода.`)
        : L(`Browsing activity is stable or decreasing this period.`,
            `L'activité de navigation est stable ou en baisse sur cette période.`,
            `Активность просмотра стабильна или снижается в этом периоде.`)
    );
  }

  // Late night
  if (data.lateNightPct > 15) {
    findings.push(L(
      `${Math.round(data.lateNightPct)}% of browsing occurs late at night (10pm–6am).`,
      `${Math.round(data.lateNightPct)}% de la navigation a lieu la nuit (22h–6h).`,
      `${Math.round(data.lateNightPct)}% активности приходится на позднее время (22:00–6:00).`
    ));
  }

  // ── Section 3: Concerns ────────────────────────────────────────────────────
  const concerns = [];

  // Harmful categories
  const harmfulCats = data.topCategories.filter(([c]) => HARMFUL.includes(c) && c !== 'bypass_attempt');
  for (const [cat, count] of harmfulCats.slice(0, 3)) {
    const label = CAT_LABEL[cat] || cat;
    concerns.push(L(
      `${label} content: ${count} pages accessed (${pct(count, data.total)}).`,
      `Contenu "${label}" : ${count} pages accédées (${pct(count, data.total)}).`,
      `Контент "${label}": ${count} страниц (${pct(count, data.total)}).`
    ));
  }

  // Bypass attempts
  if (data.bypasses.length > 0) {
    concerns.push(L(
      `${data.bypasses.length} bypass attempt(s) detected — ${n} tried to circumvent the parental controls.`,
      `${data.bypasses.length} tentative(s) de contournement — ${n} a essayé de contourner le contrôle parental.`,
      `${data.bypasses.length} попытк(и) обхода — ${n} пытался(ась) обойти родительский контроль.`
    ));
  }

  // Persistent bypass on same site
  if (data.persistBypass.length > 0) {
    const worst = data.persistBypass[0];
    concerns.push(L(
      `Persistent bypass: "${worst[0]}" was attempted ${worst[1]} times despite being blocked.`,
      `Contournement persistant : "${worst[0]}" a été tenté ${worst[1]} fois malgré le blocage.`,
      `Упорный обход: "${worst[0]}" — ${worst[1]} попыток несмотря на блокировку.`
    ));
  }

  // Most blocked site (child repeatedly tries to access)
  if (data.topBlocked.length > 0 && data.topBlocked[0][1] >= 3) {
    const [site, count] = data.topBlocked[0];
    concerns.push(L(
      `"${site}" was blocked ${count} times — ${n} repeatedly tries to access this site.`,
      `"${site}" a été bloqué ${count} fois — ${n} essaie régulièrement d'accéder à ce site.`,
      `"${site}" заблокирован ${count} раз(а) — ${n} постоянно пытается зайти на этот сайт.`
    ));
  }

  // Late night concern for children/teens
  if (data.lateNightPct > 20 && ag !== 'adult') {
    concerns.push(L(
      `Significant late-night browsing (${Math.round(data.lateNightPct)}%) is concerning for a ${ag}.`,
      `Navigation nocturne importante (${Math.round(data.lateNightPct)}%) préoccupante pour un(e) ${ag}.`,
      `Значительная ночная активность (${Math.round(data.lateNightPct)}%) тревожна для ${ag}.`
    ));
  }

  // ── Section 4: Recommendations ─────────────────────────────────────────────
  const recs = [];

  // Age-specific recs
  if (ag === 'child') {
    recs.push(L(
      `Review the list of most-visited sites weekly and discuss any unfamiliar ones with ${n}.`,
      `Examinez la liste des sites les plus visités chaque semaine et discutez avec ${n} des sites inconnus.`,
      `Еженедельно просматривайте список посещённых сайтов и обсуждайте с ${n} незнакомые.`
    ));
  } else if (ag === 'teenager') {
    recs.push(L(
      `Have an open conversation with ${n} about the blocked content and why those limits exist.`,
      `Engagez une conversation ouverte avec ${n} sur le contenu bloqué et les raisons de ces limites.`,
      `Поговорите с ${n} открыто о заблокированном контенте и причинах этих ограничений.`
    ));
  }

  // Educational content rec
  if (data.eduRate < 0.1 && data.total > 10) {
    recs.push(L(
      `Encourage ${n} to explore educational websites — only ${pct(data.eduCount, data.total)} of browsing is currently educational.`,
      `Encouragez ${n} à explorer des sites éducatifs — seulement ${pct(data.eduCount, data.total)} de la navigation est actuellement éducative.`,
      `Поощряйте ${n} посещать образовательные ресурсы — сейчас лишь ${pct(data.eduCount, data.total)} активности образовательные.`
    ));
  }

  // Late night rec
  if (data.lateNightPct > 10) {
    recs.push(L(
      `Consider enabling a schedule restriction to block browsing after 10pm.`,
      `Envisagez d'activer une restriction horaire pour bloquer la navigation après 22h.`,
      `Рассмотрите включение расписания блокировки после 22:00.`
    ));
  }

  // Bypass rec
  if (data.bypasses.length > 0 || data.persistBypass.length > 0) {
    recs.push(L(
      `Enable 2FA on your parental account to prevent ${n} from accessing settings.`,
      `Activez la 2FA sur votre compte parental pour empêcher ${n} d'accéder aux paramètres.`,
      `Включите 2FA на родительском аккаунте, чтобы ${n} не мог изменить настройки.`
    ));
    if (data.persistBypass.length > 0) {
      recs.push(L(
        `Manually add "${data.persistBypass[0][0]}" to the blocked domains list for immediate enforcement.`,
        `Ajoutez manuellement "${data.persistBypass[0][0]}" à la liste des domaines bloqués.`,
        `Добавьте "${data.persistBypass[0][0]}" вручную в список заблокированных доменов.`
      ));
    }
  }

  // Harmful content rec
  if (harmfulCats.length > 0) {
    recs.push(L(
      `Tighten the AI threshold in Filters to catch more borderline content.`,
      `Abaissez le seuil IA dans les Filtres pour bloquer davantage de contenus limites.`,
      `Снизьте порог ИИ в разделе Фильтры для более строгой блокировки.`
    ));
  }

  // Default positive rec
  if (recs.length < 2) {
    recs.push(L(
      `Keep a regular weekly review of the activity history to stay informed of ${n}'s online habits.`,
      `Effectuez une revue hebdomadaire de l'historique d'activité pour rester informé des habitudes en ligne de ${n}.`,
      `Регулярно (раз в неделю) просматривайте историю активности ${n}.`
    ));
  }

  return { summary, findings, concerns, recs };
}

// ── Mini sparkline ─────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#3B82F6' }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const W = 90, H = 26;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (v / max) * H * 0.85 - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = pts.split(' ').slice(-1)[0].split(',');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
    </svg>
  );
}

// ── Stat box ──────────────────────────────────────────────────────────────────
function StatBox({ label, value, sub, color, spark, sparkColor }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-bold leading-tight" style={{ color }}>{value}</div>
          <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--color-text)' }}>{label}</div>
          {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{sub}</div>}
        </div>
        {spark && <Sparkline data={spark} color={sparkColor || color} />}
      </div>
    </div>
  );
}

// ── Risk arc gauge ─────────────────────────────────────────────────────────────
function RiskGauge({ score }) {
  const color = score < 25 ? '#10B981' : score < 55 ? '#F59E0B' : '#EF4444';
  const label = score < 25 ? 'Low' : score < 55 ? 'Medium' : 'High';
  const R = 38, CX = 50, CY = 50;
  const a = (score / 100) * Math.PI;
  const ex = CX + R * Math.cos(Math.PI + a);
  const ey = CY + R * Math.sin(Math.PI + a);
  return (
    <div className="flex flex-col items-center">
      <svg width={100} height={60} viewBox="0 0 100 60">
        <path d={`M ${CX-R} ${CY} A ${R} ${R} 0 0 1 ${CX+R} ${CY}`}
              fill="none" stroke="var(--color-border)" strokeWidth="6" strokeLinecap="round" />
        <path d={`M ${CX-R} ${CY} A ${R} ${R} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`}
              fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />
        <text x={CX} y={CY+2} textAnchor="middle" fontSize="15" fontWeight="bold" fill={color}>{score}</text>
      </svg>
      <span className="text-xs font-semibold -mt-1" style={{ color }}>{label} Risk</span>
    </div>
  );
}

// ── Category bar ──────────────────────────────────────────────────────────────
function CatBar({ cat, count, total }) {
  const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
  const color = CAT_COLOR[cat] || '#9CA3AF';
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
          {CAT_LABEL[cat] || cat}
        </span>
        <span className="text-xs font-bold" style={{ color }}>
          {count} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>({pct}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Report section ────────────────────────────────────────────────────────────
function ReportSection({ title, icon: Icon, color, items, isList = true, children }) {
  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: `${color}30` }}>
      <div className="flex items-center gap-2 px-4 py-3"
           style={{ background: `${color}10`, borderBottom: `1px solid ${color}20` }}>
        <Icon size={15} style={{ color }} />
        <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{title}</span>
      </div>
      <div className="px-4 py-3">
        {children}
        {isList && items && items.map((item, i) => (
          <div key={i} className="flex gap-2 text-sm py-1.5 border-b last:border-0"
               style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
            <span className="flex-shrink-0 mt-0.5 font-bold" style={{ color }}>▸</span>
            <span className="leading-relaxed">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AIReportView() {
  const { lang } = useContext(AppContext);
  const { t }   = useTranslation();

  const [profiles, setProfiles]     = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [log, setLog]               = useState([]);
  const [period, setPeriod]         = useState(7);
  const [analysis, setAnalysis]     = useState(null);
  const [report, setReport]         = useState(null);
  const [generating, setGenerating] = useState(false);
  const [showData, setShowData]     = useState(false);

  useEffect(() => { loadInitial(); }, []);
  useEffect(() => {
    if (selectedId) {
      const profile = profiles.find(p => p.id === selectedId);
      const pLog = log.filter(e =>
        e.profileId === selectedId ||
        (profile && e.profileName === profile.name)
      );
      const data = analyzeData(pLog, period);
      setAnalysis(data);
      setReport(null);
    }
  }, [selectedId, period, log, profiles]);

  const loadInitial = async () => {
    const [profs, pid, actLog] = await Promise.all([
      getProfiles(), getActiveProfileId(), getActivityLog(),
    ]);
    setProfiles(profs);
    setSelectedId(pid || profs[0]?.id || null);
    setLog(actLog);
  };

  const generateReport = () => {
    const profile = profiles.find(p => p.id === selectedId);
    if (!profile || !analysis) return;
    setGenerating(true);
    setReport(null);
    // Small artificial delay for UX feedback (the engine is instant)
    setTimeout(() => {
      const r = generateLocalReport(profile, analysis, lang);
      setReport(r);
      setGenerating(false);
    }, 800);
  };

  const profile = profiles.find(p => p.id === selectedId);
  const L = (en, fr, ru) => lang === 'fr' ? fr : lang === 'ru' ? ru : en;

  return (
    <div className="p-6 space-y-5 animate-fade-in">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <Brain size={22} style={{ color: 'var(--color-primary)' }} />
          {L('AI Analysis', 'Analyse IA', 'ИИ-анализ')}
        </h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {L(
            'Local expert-system analysis of real browsing data — no external API required',
            'Analyse locale par système expert des vraies données de navigation — aucune API externe requise',
            'Локальный экспертный анализ реальных данных просмотра — без внешних API'
          )}
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
            {t('profile')}
          </label>
          <select value={selectedId || ''} onChange={e => setSelectedId(e.target.value)}
                  className="input text-sm">
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.avatar || '👤'} {p.name} ({t(p.ageGroup)})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
            {L('Period', 'Période', 'Период')}
          </label>
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--color-border)' }}>
            {[{v:1,l:'1d'},{v:7,l:'7d'},{v:30,l:'30d'}].map(({v,l}) => (
              <button key={v} onClick={() => setPeriod(v)}
                      className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                      style={{
                        background: period === v ? 'var(--color-surface)' : 'transparent',
                        color: period === v ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      }}>{l}</button>
            ))}
          </div>
        </div>

        <button onClick={generateReport}
                disabled={generating || !analysis || analysis.total === 0}
                className="btn btn-primary gap-2 px-5">
          {generating
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
            : <Brain size={15} />}
          {generating
            ? L('Analysing...','Analyse...','Анализ...')
            : L('Generate Analysis','Générer l\'analyse','Создать анализ')}
        </button>
      </div>

      {/* No profiles */}
      {!profile && (
        <div className="card p-12 text-center">
          <Users size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--color-text)' }} />
          <p style={{ color: 'var(--color-text-muted)' }}>{t('noProfiles')}</p>
        </div>
      )}

      {profile && analysis && (
        <>
          {/* Profile banner */}
          <div className="card p-5 flex items-center gap-5"
               style={{ borderLeft: `4px solid ${profile.color || '#3B82F6'}` }}>
            <div className="text-4xl">{profile.avatar || '👤'}</div>
            <div className="flex-1">
              <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>{profile.name}</h3>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {t(profile.ageGroup)} · {L(`Last ${period} days`,`${period} derniers jours`,`Последние ${period} дн.`)}
                {' · '}{analysis.total} {L('pages','pages','страниц')}
              </p>
            </div>
            <RiskGauge score={analysis.riskScore} />
          </div>

          {/* Key stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox label={L('Pages Visited','Pages visitées','Посещено')}
                     value={analysis.total} color="#3B82F6"
                     spark={analysis.dailyVisits} sparkColor="#3B82F6" />
            <StatBox label={L('Blocked','Bloqués','Заблокировано')}
                     value={analysis.blocked} color="#EF4444"
                     sub={`${Math.round(analysis.blockRate*100)}% rate`} />
            <StatBox label={L('Bypasses','Tentatives','Попыток')}
                     value={analysis.bypasses.length} color="#7C3AED"
                     sub={analysis.persistBypass.length > 0
                       ? L(`${analysis.persistBypass.length} persistent`,`${analysis.persistBypass.length} persistant(s)`,`${analysis.persistBypass.length} упорных`)
                       : L('none persistent','aucun persistant','нет упорных')} />
            <StatBox label={L('Educational','Éducatif','Образовательный')}
                     value={`${Math.round(analysis.eduRate*100)}%`} color="#10B981"
                     sub={`${analysis.eduCount} pages`} />
          </div>

          {/* Data panel (collapsible) */}
          <div className="card overflow-hidden">
            <button onClick={() => setShowData(v => !v)}
                    className="w-full flex items-center justify-between px-5 py-4"
                    style={{ borderBottom: showData ? '1px solid var(--color-border)' : 'none' }}>
              <span className="font-semibold text-sm flex items-center gap-2"
                    style={{ color: 'var(--color-text)' }}>
                <BarChart2 size={15} style={{ color: 'var(--color-primary)' }} />
                {L('Detailed navigation data (used by the analysis engine)',
                   'Données détaillées (utilisées par le moteur d\'analyse)',
                   'Подробные данные (используются движком анализа)')}
              </span>
              {showData ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showData && (
              <div className="p-5 grid grid-cols-2 gap-6">
                {/* Category bars */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide mb-3"
                      style={{ color: 'var(--color-text-muted)' }}>
                    {L('Content categories','Catégories','Категории')}
                  </h4>
                  <div className="space-y-2.5">
                    {analysis.topCategories.slice(0,8).map(([cat,count]) => (
                      <CatBar key={cat} cat={cat} count={count} total={analysis.total} />
                    ))}
                  </div>
                </div>

                {/* Tables */}
                <div className="space-y-5">
                  {/* Top sites */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide mb-2"
                        style={{ color: 'var(--color-text-muted)' }}>
                      {L('Top visited','Plus visités','Топ сайтов')}
                    </h4>
                    {analysis.topSites.map(([site,count]) => (
                      <div key={site} className="flex justify-between text-xs py-1.5 border-b"
                           style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                        <span className="truncate font-medium">{site}</span>
                        <span className="ml-2 flex-shrink-0 font-bold">{count}×</span>
                      </div>
                    ))}
                  </div>

                  {/* Most blocked */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide mb-2"
                        style={{ color: 'var(--color-text-muted)' }}>
                      {L('Most blocked','Plus bloqués','Чаще блокируются')}
                    </h4>
                    {analysis.topBlocked.length === 0
                      ? <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</p>
                      : analysis.topBlocked.map(([site,count]) => (
                          <div key={site} className="flex justify-between text-xs py-1.5 border-b"
                               style={{ borderColor: 'var(--color-border)' }}>
                            <span className="truncate" style={{ color: 'var(--color-danger)' }}>{site}</span>
                            <span className="ml-2 font-bold" style={{ color: 'var(--color-danger)' }}>{count}× 🚫</span>
                          </div>
                        ))
                    }
                  </div>

                  {/* Bypass */}
                  {analysis.persistBypass.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide mb-2"
                          style={{ color: '#7C3AED' }}>
                        ⚠️ {L('Persistent bypass','Contournements répétés','Упорные обходы')}
                      </h4>
                      {analysis.persistBypass.map(([site,count]) => (
                        <div key={site} className="flex justify-between text-xs py-1.5 border-b"
                             style={{ borderColor: 'var(--color-border)' }}>
                          <span className="truncate font-medium" style={{ color: '#7C3AED' }}>{site}</span>
                          <span className="ml-2 font-bold" style={{ color: '#7C3AED' }}>{count} attempts</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Temporal summary */}
                  <div className="text-xs space-y-1.5">
                    {[
                      [L('Peak hour','Heure de pointe','Пиковый час'), `${analysis.peakHour}h–${analysis.peakHour+1}h`, null],
                      [L('Late night','Navigation nocturne','Поздняя активность'), `${Math.round(analysis.lateNightPct)}%`, analysis.lateNightPct > 15 ? '#EF4444' : null],
                      [L('Busiest day','Jour le plus actif','Активнейший день'), analysis.busiestDay, null],
                      [L('Weekly trend','Tendance','Тенденция'),
                        analysis.trendUp ? L('↑ Increasing','↑ En hausse','↑ Растёт') : L('↓ Stable/Down','↓ Stable/Baisse','↓ Стабильно/Снижается'),
                        analysis.trendUp ? '#EF4444' : '#10B981'],
                    ].map(([label, val, color]) => (
                      <div key={label} className="flex justify-between">
                        <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                        <span className="font-medium" style={{ color: color || 'var(--color-text)' }}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Empty state */}
          {analysis.total === 0 && (
            <div className="card p-10 text-center">
              <Clock size={36} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                {L('No activity in this period','Aucune activité sur cette période','Нет активности за период')}
              </p>
            </div>
          )}

          {/* Prompt card */}
          {!report && !generating && analysis.total > 0 && (
            <div className="card p-8 text-center">
              <Brain size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--color-primary)' }} />
              <p className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                {L(`${analysis.total} pages of real data ready`,`${analysis.total} pages de données prêtes`,`${analysis.total} страниц данных готово`)}
              </p>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
                {L(
                  'The local analysis engine will read actual visited URLs, blocked sites, bypass attempts, timing patterns and generate a personalised report.',
                  'Le moteur d\'analyse local lira les vraies URLs visitées, sites bloqués, tentatives de contournement, patterns horaires et générera un rapport personnalisé.',
                  'Локальный движок прочитает реальные URL, заблокированные сайты, попытки обхода, временные паттерны и создаст персональный отчёт.'
                )}
              </p>
              <button onClick={generateReport} className="btn btn-primary gap-2 mx-auto">
                <Brain size={15} />
                {L('Generate Analysis','Générer l\'analyse','Создать анализ')}
              </button>
            </div>
          )}

          {/* Generating */}
          {generating && (
            <div className="card p-8 text-center">
              <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                {L('Expert system processing data...','Traitement des données par le système expert...','Экспертная система обрабатывает данные...')}
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {L(
                  'Detecting patterns · Scoring risks · Generating recommendations...',
                  'Détection des patterns · Évaluation des risques · Rédaction des recommandations...',
                  'Обнаружение паттернов · Оценка рисков · Создание рекомендаций...'
                )}
              </p>
            </div>
          )}

          {/* Report output */}
          {report && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                  <FileText size={16} style={{ color: 'var(--color-primary)' }} />
                  {L(`Analysis Report — ${profile.name}`,`Rapport d'analyse — ${profile.name}`,`Отчёт — ${profile.name}`)}
                  <span className="badge text-xs" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
                    ✓ {L('Local AI','IA locale','Локальный ИИ')}
                  </span>
                </h3>
                <button onClick={generateReport} className="btn btn-ghost p-1.5 gap-1 text-xs"
                        style={{ color: 'var(--color-text-muted)' }}>
                  <RefreshCw size={13} /> {L('Refresh','Rafraîchir','Обновить')}
                </button>
              </div>

              {/* Summary */}
              <ReportSection
                title={L('Summary','Résumé','Резюме')}
                icon={Shield} color="#3B82F6" isList={false}>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
                  {report.summary}
                </p>
              </ReportSection>

              {/* Key findings */}
              <ReportSection
                title={L('Key Findings','Observations clés','Ключевые наблюдения')}
                icon={Activity} color="#8B5CF6"
                items={report.findings} />

              {/* Concerns */}
              <ReportSection
                title={L('Areas of Concern','Points d\'inquiétude','Поводы для беспокойства')}
                icon={AlertTriangle} color="#EF4444"
                items={report.concerns.length > 0
                  ? report.concerns
                  : [L('No significant concerns detected for this period.',
                        'Aucun problème significatif détecté sur cette période.',
                        'Существенных поводов для беспокойства не выявлено.')]} />

              {/* Recommendations */}
              <ReportSection
                title={L('Recommendations','Recommandations','Рекомендации')}
                icon={CheckCircle} color="#10B981"
                items={report.recs} />

              {/* Footer */}
              <p className="text-xs px-1" style={{ color: 'var(--color-text-muted)' }}>
                {L(
                  `Generated by SafeGuard local analysis engine · Based on ${analysis.total} pages over ${period} days · ${new Date().toLocaleString()}`,
                  `Généré par le moteur d'analyse local SafeGuard · Basé sur ${analysis.total} pages sur ${period} jours · ${new Date().toLocaleString()}`,
                  `Создано локальным движком SafeGuard · На основе ${analysis.total} стр. за ${period} дн. · ${new Date().toLocaleString()}`
                )}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
