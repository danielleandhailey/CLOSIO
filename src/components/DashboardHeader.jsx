import React, { useMemo } from 'react';
import { format, parseISO, differenceInDays, isSameDay } from 'date-fns';
import { Calendar, Lock, AlertTriangle, Clock, CheckSquare, TrendingUp, DollarSign, Home, Users } from 'lucide-react';
import { STAGES, STAGE_COLORS } from '../lib/constants';
import { formatCurrency } from '../lib/utils';

// Mini bar chart component
const MiniBarChart = ({ data, height = 60 }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height, padding: '4px 0' }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <div
            style={{
              width: '100%',
              maxWidth: '24px',
              height: `${Math.max((d.value / max) * height * 0.8, 4)}px`,
              background: d.color || '#3b82f6',
              borderRadius: '3px 3px 0 0',
              transition: 'height 0.3s',
            }}
            title={`${d.label}: ${d.value}`}
          />
          <span style={{ fontSize: '8px', color: '#6b7280', marginTop: '2px' }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
};

// Donut chart component
const DonutChart = ({ data, size = 90 }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '11px' }}>No data</div>;

  let cumulative = 0;
  const slices = data.filter(d => d.value > 0).map(d => {
    const start = cumulative;
    cumulative += (d.value / total) * 360;
    return { ...d, start, end: cumulative };
  });

  const getCoords = (angle, r) => {
    const rad = (angle - 90) * Math.PI / 180;
    return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) };
  };

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {slices.map((slice, i) => {
        const start = getCoords(slice.start, 40);
        const end = getCoords(slice.end, 40);
        const largeArc = slice.end - slice.start > 180 ? 1 : 0;
        const d = `M 50 50 L ${start.x} ${start.y} A 40 40 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
        return <path key={i} d={d} fill={slice.color} stroke="#1e293b" strokeWidth="0.5" />;
      })}
      <circle cx="50" cy="50" r="24" fill="#1e293b" />
      <text x="50" y="48" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="700">{total}</text>
      <text x="50" y="60" textAnchor="middle" fill="#94a3b8" fontSize="8">LOANS</text>
    </svg>
  );
};

// Stat Card component - compact
const StatCard = ({ icon: Icon, label, value, subtext, color = '#3b82f6', onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: 'var(--surface2)',
      borderRadius: '8px',
      padding: '10px 12px',
      minWidth: '100px',
      cursor: onClick ? 'pointer' : 'default',
      border: '1px solid var(--border)',
      transition: 'all 0.2s',
    }}
    onMouseEnter={e => onClick && (e.currentTarget.style.borderColor = color)}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
      <Icon size={12} style={{ color }} />
      <span style={{ fontSize: '9px', color: 'var(--text3)', fontWeight: '600', textTransform: 'uppercase' }}>{label}</span>
    </div>
    <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text)', lineHeight: 1 }}>{value}</div>
  </div>
);

// Alert Item component - compact
const AlertItem = ({ icon: Icon, text, subtext, color, urgent, onClick }) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '5px 8px', borderRadius: '5px',
      background: urgent ? `${color}15` : 'var(--surface)',
      border: `1px solid ${urgent ? color : 'var(--border)'}`,
      cursor: 'pointer', transition: 'all 0.15s',
      marginBottom: '3px',
    }}
    onMouseEnter={e => e.currentTarget.style.background = `${color}20`}
    onMouseLeave={e => e.currentTarget.style.background = urgent ? `${color}15` : 'var(--surface)'}
  >
    <Icon size={10} style={{ color, flexShrink: 0 }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</div>
      {subtext && <div style={{ fontSize: '9px', color: 'var(--text3)' }}>{subtext}</div>}
    </div>
  </div>
);

const DashboardHeader = ({ borrowers, onSelectBorrower, onFilterStage }) => {
  const dashboardData = useMemo(() => {
    const today = new Date();

    // Tasks
    const allTasks = [];
    borrowers.forEach(b => {
      (b.tasks || []).forEach(t => {
        if (t.completed) return;
        if (t.due_date) {
          const taskDate = parseISO(t.due_date);
          const daysUntil = differenceInDays(taskDate, today);
          if (daysUntil >= -7 && daysUntil <= 7) {
            allTasks.push({ ...t, borrower: b, daysUntil, isToday: isSameDay(taskDate, today) });
          }
        }
      });
    });
    allTasks.sort((a, b) => a.daysUntil - b.daysUntil);
    const tasksDueToday = allTasks.filter(t => t.isToday || t.daysUntil < 0);

    // Locks expiring
    const locksExpiring = borrowers.filter(b => {
      if (b.rate_status !== 'Locked' || !b.lock_expiration) return false;
      const lockDate = parseISO(b.lock_expiration);
      const daysUntil = differenceInDays(lockDate, today);
      return daysUntil >= 0 && daysUntil <= 7;
    }).map(b => ({ ...b, daysUntil: differenceInDays(parseISO(b.lock_expiration), today) }))
      .sort((a, b) => a.daysUntil - b.daysUntil);

    // Floating
    const floatingLoans = borrowers.filter(b =>
      b.rate_status === 'Floating' && ['Processing', 'Funded', 'LP Ready', 'Paycom'].includes(b.stage)
    );

    // Contingencies
    const contingenciesDue = [];
    borrowers.forEach(b => {
      const contFields = [
        { key: 'inspection_contingency_date', label: 'Inspection' },
        { key: 'appraisal_contingency_date', label: 'Appraisal' },
        { key: 'loan_contingency_date', label: 'Loan' },
      ];
      contFields.forEach(({ key, label }) => {
        if (b[key]) {
          const contDate = parseISO(b[key]);
          const daysUntil = differenceInDays(contDate, today);
          if (daysUntil >= 0 && daysUntil <= 7) {
            contingenciesDue.push({ borrower: b, contingency: label, daysUntil });
          }
        }
      });
    });
    contingenciesDue.sort((a, b) => a.daysUntil - b.daysUntil);

    // COE dates
    const coeDates = borrowers.filter(b => {
      if (!b.coe_date) return false;
      const coeDate = parseISO(b.coe_date);
      const daysUntil = differenceInDays(coeDate, today);
      return daysUntil >= 0 && daysUntil <= 30;
    }).map(b => ({ ...b, daysUntil: differenceInDays(parseISO(b.coe_date), today) }))
      .sort((a, b) => a.daysUntil - b.daysUntil);

    // Stage counts & totals
    const stageCounts = {};
    STAGES.forEach(s => { stageCounts[s] = 0; });
    let totalVolume = 0;
    borrowers.forEach(b => {
      if (stageCounts[b.stage] !== undefined) stageCounts[b.stage]++;
      if (b.loan_amount) totalVolume += parseFloat(b.loan_amount) || 0;
    });

    // Donut data
    const donutData = STAGES.slice(0, 7).map(s => ({
      label: s,
      value: stageCounts[s],
      color: STAGE_COLORS[s]?.bg || '#475569',
    }));

    // Bar chart data (stages)
    const barData = STAGES.slice(0, 6).map(s => ({
      label: s.substring(0, 3),
      value: stageCounts[s],
      color: STAGE_COLORS[s]?.bg || '#475569',
    }));

    // Counts
    const closingsThisMonth = coeDates.filter(b => b.daysUntil <= 30).length;
    const processingCount = stageCounts['Processing'] || 0;
    const fundedCount = stageCounts['Funded'] || 0;

    return {
      tasksDueToday, locksExpiring, floatingLoans, contingenciesDue, coeDates,
      stageCounts, donutData, barData, totalVolume, closingsThisMonth, processingCount, fundedCount,
      totalLoans: borrowers.length,
    };
  }, [borrowers]);

  const {
    tasksDueToday, locksExpiring, floatingLoans, contingenciesDue, coeDates,
    stageCounts, donutData, barData, totalVolume, closingsThisMonth, processingCount, fundedCount, totalLoans,
  } = dashboardData;

  // Alert box component - compact
  const AlertBox = ({ title, count, color, items, emptyText, renderItem }) => (
    <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '10px', border: '1px solid var(--border)', minWidth: '140px', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '9px', fontWeight: '600', color: 'var(--text3)', textTransform: 'uppercase' }}>{title}</span>
        <span style={{ background: color, color: '#fff', fontSize: '9px', fontWeight: '700', padding: '1px 6px', borderRadius: '8px' }}>{count}</span>
      </div>
      <div style={{ maxHeight: '60px', overflowY: 'auto' }}>
        {items.length === 0 ? (
          <div style={{ fontSize: '9px', color: 'var(--text3)', fontStyle: 'italic' }}>{emptyText}</div>
        ) : items.slice(0, 3).map(renderItem)}
      </div>
    </div>
  );

  return (
    <div className="dashboard-header" style={{ padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      {/* Single Row - Stats, Alerts, Donut */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', overflowX: 'auto', alignItems: 'stretch' }}>
        {/* Stat Cards */}
        <StatCard icon={Users} label="Pipeline" value={totalLoans} color="#8b5cf6" />
        <StatCard icon={DollarSign} label="Volume" value={formatCurrency(totalVolume)} color="#22c55e" />
        <StatCard icon={TrendingUp} label="Processing" value={processingCount} color="#3b82f6" onClick={() => onFilterStage('Processing')} />
        <StatCard icon={Home} label="Closing" value={closingsThisMonth} color="#f59e0b" />
        <StatCard icon={CheckSquare} label="Funded" value={fundedCount} color="#10b981" onClick={() => onFilterStage('Funded')} />

        {/* Divider */}
        <div style={{ width: '1px', background: '#334155', margin: '0 4px' }} />

        {/* Alert Boxes */}
        <AlertBox title="Tasks" count={tasksDueToday.length} color="#3b82f6" items={tasksDueToday} emptyText="All caught up!"
          renderItem={(t, i) => <AlertItem key={i} icon={CheckSquare} text={t.borrower.name?.split(' ')[0]} subtext={t.title?.substring(0, 15)}
            color={t.daysUntil < 0 ? '#ef4444' : '#3b82f6'} urgent={t.daysUntil < 0} onClick={() => onSelectBorrower(t.borrower.id)} />} />

        <AlertBox title="Locks" count={locksExpiring.length} color="#ef4444" items={locksExpiring} emptyText="No locks expiring"
          renderItem={(b, i) => <AlertItem key={i} icon={Lock} text={b.name?.split(' ')[0]} subtext={b.daysUntil === 0 ? 'TODAY!' : `${b.daysUntil}d`}
            color="#ef4444" urgent={b.daysUntil <= 2} onClick={() => onSelectBorrower(b.id)} />} />

        <AlertBox title="Floating" count={floatingLoans.length} color="#f59e0b" items={floatingLoans} emptyText="All locked"
          renderItem={(b, i) => <AlertItem key={i} icon={AlertTriangle} text={b.name?.split(' ')[0]} subtext={b.stage}
            color="#f59e0b" urgent={false} onClick={() => onSelectBorrower(b.id)} />} />

        <AlertBox title="Contingencies" count={contingenciesDue.length} color="#8b5cf6" items={contingenciesDue} emptyText="None due"
          renderItem={(c, i) => <AlertItem key={i} icon={Clock} text={c.borrower.name?.split(' ')[0]} subtext={`${c.contingency} ${c.daysUntil}d`}
            color="#8b5cf6" urgent={c.daysUntil <= 2} onClick={() => onSelectBorrower(c.borrower.id)} />} />

        {/* Donut Chart - Far Right */}
        <div style={{ background: '#1e293b', borderRadius: '8px', padding: '8px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <DonutChart data={donutData} size={70} />
          <span style={{ fontSize: '8px', color: '#64748b', marginTop: '2px' }}>Pipeline</span>
        </div>
      </div>

    </div>
  );
};

export default DashboardHeader;
