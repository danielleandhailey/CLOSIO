import React, { useMemo } from 'react';
import { format, parseISO, differenceInDays, isToday, isTomorrow, addDays, isSameDay } from 'date-fns';
import { Calendar, Lock, AlertTriangle, Clock, CheckCircle, Users, CheckSquare } from 'lucide-react';
import { STAGES, STAGE_COLORS } from '../lib/constants';

// Simple Pie Chart component
const PieChart = ({ data, size = 80 }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

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
        return <path key={i} d={d} fill={slice.color} stroke="#1a1a2e" strokeWidth="1" />;
      })}
      <circle cx="50" cy="50" r="20" fill="#1a1a2e" />
      <text x="50" y="54" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">{total}</text>
    </svg>
  );
};

const DashboardHeader = ({ borrowers, onSelectBorrower, onFilterStage }) => {
  // Calculate all dashboard data
  const dashboardData = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    // Tasks due today or upcoming (from all borrowers)
    const allTasks = [];
    borrowers.forEach(b => {
      (b.tasks || []).forEach(t => {
        if (t.completed) return;
        if (t.due_date) {
          const taskDate = parseISO(t.due_date);
          const daysUntil = differenceInDays(taskDate, today);
          if (daysUntil >= -1 && daysUntil <= 7) { // include yesterday (overdue) to 7 days out
            allTasks.push({ ...t, borrower: b, daysUntil, isToday: isSameDay(taskDate, today) });
          }
        }
      });
    });
    allTasks.sort((a, b) => a.daysUntil - b.daysUntil);

    const tasksDueToday = allTasks.filter(t => t.isToday || t.daysUntil < 0);

    // Locks expiring soon (within 7 days)
    const locksExpiring = borrowers.filter(b => {
      if (b.rate_status !== 'Locked' || !b.lock_expiration) return false;
      const lockDate = parseISO(b.lock_expiration);
      const daysUntil = differenceInDays(lockDate, today);
      return daysUntil >= 0 && daysUntil <= 7;
    }).map(b => ({
      ...b,
      daysUntil: differenceInDays(parseISO(b.lock_expiration), today),
    })).sort((a, b) => a.daysUntil - b.daysUntil);

    // Floating locks (rate_status = Floating in Processing+)
    const floatingLoans = borrowers.filter(b =>
      b.rate_status === 'Floating' &&
      ['Processing', 'Funded', 'LP Ready', 'Paycom'].includes(b.stage)
    );

    // Contingencies coming due (within 7 days)
    const contingenciesDue = [];
    borrowers.forEach(b => {
      const contFields = [
        { key: 'inspection_contingency_date', label: 'Inspection' },
        { key: 'appraisal_contingency_date', label: 'Appraisal' },
        { key: 'loan_contingency_date', label: 'Loan' },
        { key: 'seller_home_sale_contingency_date', label: 'Seller Home Sale' },
      ];
      contFields.forEach(({ key, label }) => {
        if (b[key]) {
          const contDate = parseISO(b[key]);
          const daysUntil = differenceInDays(contDate, today);
          if (daysUntil >= 0 && daysUntil <= 7) {
            contingenciesDue.push({
              borrower: b,
              contingency: label,
              date: b[key],
              daysUntil,
            });
          }
        }
      });
    });
    contingenciesDue.sort((a, b) => a.daysUntil - b.daysUntil);

    // COE dates coming up (within 14 days)
    const coeDates = borrowers.filter(b => {
      if (!b.coe_date) return false;
      const coeDate = parseISO(b.coe_date);
      const daysUntil = differenceInDays(coeDate, today);
      return daysUntil >= 0 && daysUntil <= 14;
    }).map(b => ({
      ...b,
      daysUntil: differenceInDays(parseISO(b.coe_date), today),
    })).sort((a, b) => a.daysUntil - b.daysUntil);

    // Stage counts
    const stageCounts = {};
    STAGES.forEach(s => { stageCounts[s] = 0; });
    borrowers.forEach(b => {
      if (stageCounts[b.stage] !== undefined) stageCounts[b.stage]++;
    });

    // Pie chart data
    const pieData = STAGES.map(s => ({
      label: s,
      value: stageCounts[s],
      color: STAGE_COLORS[s]?.bg || '#666',
    }));

    return { locksExpiring, floatingLoans, contingenciesDue, coeDates, stageCounts, tasksDueToday, allTasks, pieData };
  }, [borrowers]);

  const { locksExpiring, floatingLoans, contingenciesDue, coeDates, stageCounts, tasksDueToday, allTasks, pieData } = dashboardData;

  const Widget = ({ title, icon: Icon, color, items, emptyText, renderItem }) => (
    <div style={{
      background: '#1a1a2e',
      borderRadius: '10px',
      padding: '12px 14px',
      border: '1px solid #2a2a45',
      minWidth: '180px',
      flex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        <Icon size={14} style={{ color }} />
        <span style={{ fontSize: '11px', fontWeight: '700', color: '#a0a0c0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
        {items.length > 0 && (
          <span style={{
            background: color, color: '#fff', fontSize: '10px', fontWeight: '700',
            padding: '2px 6px', borderRadius: '10px', marginLeft: 'auto'
          }}>
            {items.length}
          </span>
        )}
      </div>
      <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
        {items.length === 0 ? (
          <div style={{ fontSize: '11px', color: '#5a5a7a', fontStyle: 'italic' }}>{emptyText}</div>
        ) : (
          items.slice(0, 5).map((item, i) => renderItem(item, i))
        )}
        {items.length > 5 && (
          <div style={{ fontSize: '10px', color: '#6b6b8a', marginTop: '4px' }}>+{items.length - 5} more</div>
        )}
      </div>
    </div>
  );

  const BorrowerLink = ({ borrower, extra, urgent }) => (
    <div
      onClick={() => onSelectBorrower(borrower.id)}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 8px', marginBottom: '4px', borderRadius: '6px',
        background: urgent ? '#2d1f1f' : '#13131f',
        border: `1px solid ${urgent ? '#5c2020' : '#2a2a40'}`,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = urgent ? '#3d2525' : '#1e1e30'}
      onMouseLeave={e => e.currentTarget.style.background = urgent ? '#2d1f1f' : '#13131f'}
    >
      <span style={{ fontSize: '12px', fontWeight: '600', color: '#e0e0f0' }}>
        {borrower.name?.split(' ')[0]}
      </span>
      <span style={{ fontSize: '10px', color: urgent ? '#f87171' : '#8080a8' }}>{extra}</span>
    </div>
  );

  return (
    <div style={{
      padding: '12px 16px',
      background: 'linear-gradient(180deg, #12121a 0%, #0d0d14 100%)',
      borderBottom: '1px solid #2a2a45',
    }}>
      {/* Widget Row */}
      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>

        {/* Pie Chart */}
        <div style={{
          background: '#1a1a2e',
          borderRadius: '10px',
          padding: '12px 14px',
          border: '1px solid #2a2a45',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: '100px',
        }}>
          <PieChart data={pieData} size={70} />
          <span style={{ fontSize: '9px', color: '#6b6b8a', marginTop: '4px' }}>Pipeline</span>
        </div>

        {/* Today's Tasks */}
        <Widget
          title="Today's Tasks"
          icon={CheckSquare}
          color="#3b82f6"
          items={tasksDueToday}
          emptyText="No tasks due today"
          renderItem={(t, i) => (
            <BorrowerLink
              key={i}
              borrower={t.borrower}
              extra={t.daysUntil < 0 ? 'OVERDUE' : t.title?.substring(0, 15)}
              urgent={t.daysUntil < 0}
            />
          )}
        />

        {/* Locks Expiring */}
        <Widget
          title="Locks Expiring"
          icon={Lock}
          color="#ef4444"
          items={locksExpiring}
          emptyText="No locks expiring soon"
          renderItem={(b, i) => (
            <BorrowerLink
              key={i}
              borrower={b}
              extra={b.daysUntil === 0 ? 'TODAY!' : `${b.daysUntil}d`}
              urgent={b.daysUntil <= 2}
            />
          )}
        />

        {/* Floating Loans */}
        <Widget
          title="Floating"
          icon={AlertTriangle}
          color="#f59e0b"
          items={floatingLoans}
          emptyText="No floating loans"
          renderItem={(b, i) => (
            <BorrowerLink
              key={i}
              borrower={b}
              extra={b.stage}
              urgent={false}
            />
          )}
        />

        {/* Contingencies Due */}
        <Widget
          title="Contingencies"
          icon={Clock}
          color="#8b5cf6"
          items={contingenciesDue}
          emptyText="No contingencies due"
          renderItem={(item, i) => (
            <BorrowerLink
              key={i}
              borrower={item.borrower}
              extra={`${item.contingency} ${item.daysUntil}d`}
              urgent={item.daysUntil <= 2}
            />
          )}
        />

        {/* COE Coming Up */}
        <Widget
          title="COE Dates"
          icon={Calendar}
          color="#22c55e"
          items={coeDates}
          emptyText="No COEs in 14 days"
          renderItem={(b, i) => (
            <BorrowerLink
              key={i}
              borrower={b}
              extra={b.daysUntil === 0 ? 'TODAY' : `${b.daysUntil}d`}
              urgent={b.daysUntil <= 3}
            />
          )}
        />
      </div>

      {/* Stage Pills Row */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
        {STAGES.map(stage => {
          const count = stageCounts[stage];
          const sc = STAGE_COLORS[stage];
          return (
            <button
              key={stage}
              onClick={() => onFilterStage(stage)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 10px', borderRadius: '6px',
                background: sc.bg, color: sc.text,
                border: 'none', cursor: 'pointer',
                fontSize: '11px', fontWeight: '700',
                opacity: count === 0 ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
            >
              <span>{stage}</span>
              <span style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '1px 5px',
                borderRadius: '8px',
                fontSize: '10px',
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardHeader;
