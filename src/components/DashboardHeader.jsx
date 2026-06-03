import React, { useMemo, useState } from 'react';
import { format, parseISO, differenceInDays, isSameDay } from 'date-fns';
import { Calendar, Lock, AlertTriangle, Clock, CheckSquare, TrendingUp, DollarSign, Home, Users, X } from 'lucide-react';
import { STAGES, STAGE_COLORS } from '../lib/constants';
import { formatCurrency } from '../lib/utils';

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

// Small stat card (Pipeline, Processing, Funded, Floating, Locks, Contingencies)
const SmallCard = ({ icon: Icon, label, value, color = '#3b82f6', onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: 'var(--surface2)', borderRadius: '8px', padding: '8px 12px',
      minWidth: '75px', cursor: onClick ? 'pointer' : 'default',
      border: '1px solid var(--border)', transition: 'all 0.2s',
    }}
    onMouseEnter={e => onClick && (e.currentTarget.style.borderColor = color)}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
      <Icon size={10} style={{ color }} />
      <span style={{ fontSize: '8px', color: 'var(--text3)', fontWeight: '600', textTransform: 'uppercase' }}>{label}</span>
    </div>
    <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)', lineHeight: 1 }}>{value}</div>
  </div>
);

// Medium card for Calendar and Tasks (larger, centered)
const MediumCard = ({ children, style = {} }) => (
  <div style={{
    background: 'var(--surface2)', borderRadius: '8px', padding: '10px 14px',
    minWidth: '130px', border: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', justifyContent: 'center',
    ...style
  }}>
    {children}
  </div>
);

const DashboardHeader = ({ borrowers, onSelectBorrower, onFilterStage, ops }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [addingAppt, setAddingAppt] = useState(null); // { date, borrowerId }
  const [apptForm, setApptForm] = useState({ title: '', time: '', borrower_id: '' });

  const dashboardData = useMemo(() => {
    const today = new Date();

    // All tasks/appointments (not just today)
    const allTasks = [];
    borrowers.forEach(b => {
      (b.tasks || []).forEach(t => {
        if (t.completed) return;
        if (t.due_date) {
          const taskDate = parseISO(t.due_date);
          const daysUntil = differenceInDays(taskDate, today);
          allTasks.push({ ...t, borrower: b, daysUntil, isToday: isSameDay(taskDate, today), date: taskDate });
        }
      });
    });
    allTasks.sort((a, b) => a.daysUntil - b.daysUntil);
    const tasksDueToday = allTasks.filter(t => t.isToday || t.daysUntil < 0);
    const todaysAppts = allTasks.filter(t => t.isToday && t.type === 'appointment');

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

    // Stage counts & totals
    const stageCounts = {};
    STAGES.forEach(s => { stageCounts[s] = 0; });
    let totalVolume = 0;
    let totalRevenue = 0;
    borrowers.forEach(b => {
      if (stageCounts[b.stage] !== undefined) stageCounts[b.stage]++;
      if (b.loan_amount) totalVolume += parseFloat(b.loan_amount) || 0;
      // Estimate revenue as 1% of loan amount (can be adjusted)
      if (b.loan_amount && b.stage !== 'CXLD') totalRevenue += (parseFloat(b.loan_amount) || 0) * 0.01;
    });

    // Donut data
    const donutData = STAGES.slice(0, 7).map(s => ({
      label: s,
      value: stageCounts[s],
      color: STAGE_COLORS[s]?.bg || '#475569',
    }));

    const processingCount = stageCounts['Processing'] || 0;
    const fundedCount = stageCounts['Funded'] || 0;

    return {
      tasksDueToday, todaysAppts, allTasks, locksExpiring, floatingLoans, contingenciesDue,
      stageCounts, donutData, totalVolume, totalRevenue, processingCount, fundedCount,
      totalLoans: borrowers.length,
    };
  }, [borrowers]);

  const {
    tasksDueToday, todaysAppts, allTasks, locksExpiring, floatingLoans, contingenciesDue,
    donutData, totalVolume, totalRevenue, processingCount, fundedCount, totalLoans,
  } = dashboardData;

  // Get appointments for a specific date
  const getApptsForDate = (day) => {
    const today = new Date();
    const checkDate = new Date(today.getFullYear(), today.getMonth(), day);
    return allTasks.filter(t => t.type === 'appointment' && isSameDay(t.date, checkDate));
  };

  const volStr = formatCurrency(totalVolume);
  const volFontSize = volStr.length > 10 ? '11px' : volStr.length > 8 ? '13px' : '15px';
  const revStr = formatCurrency(totalRevenue);
  const revFontSize = revStr.length > 10 ? '11px' : revStr.length > 8 ? '13px' : '15px';

  return (
    <div className="dashboard-header" style={{ padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch', overflowX: 'auto' }}>

        {/* 1. PIPELINE */}
        <SmallCard icon={Users} label="Pipeline" value={totalLoans} color="#8b5cf6" />

        {/* 2. PROCESSING */}
        <SmallCard icon={TrendingUp} label="Processing" value={processingCount} color="#3b82f6" onClick={() => onFilterStage('Processing')} />

        {/* 3. FUNDED */}
        <SmallCard icon={CheckSquare} label="Funded" value={fundedCount} color="#10b981" onClick={() => onFilterStage('Funded')} />

        {/* 4. REVENUE */}
        <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '8px 12px', minWidth: '85px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
            <DollarSign size={10} style={{ color: '#22c55e' }} />
            <span style={{ fontSize: '8px', color: 'var(--text3)', fontWeight: '600', textTransform: 'uppercase' }}>Revenue</span>
          </div>
          <div style={{ fontSize: revFontSize, fontWeight: '700', color: '#22c55e', lineHeight: 1 }}>{revStr}</div>
        </div>

        {/* 5. VOLUME */}
        <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '8px 12px', minWidth: '85px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
            <DollarSign size={10} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: '8px', color: 'var(--text3)', fontWeight: '600', textTransform: 'uppercase' }}>Volume</span>
          </div>
          <div style={{ fontSize: volFontSize, fontWeight: '700', color: '#f59e0b', lineHeight: 1 }}>{volStr}</div>
        </div>

        {/* 6. CALENDAR - Bigger, shows today's appts */}
        <MediumCard style={{ cursor: 'pointer', minWidth: '140px' }} onClick={() => setShowCalendar(true)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '8px', color: '#ef4444', fontWeight: '700', textTransform: 'uppercase' }}>{format(new Date(), 'EEE')}</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)', lineHeight: 1 }}>{format(new Date(), 'd')}</div>
              <div style={{ fontSize: '9px', color: 'var(--text3)', fontWeight: '600' }}>{format(new Date(), 'MMM')}</div>
            </div>
            <div style={{ flex: 1, borderLeft: '1px solid var(--border)', paddingLeft: '8px' }}>
              {todaysAppts.length === 0 ? (
                <div style={{ fontSize: '10px', color: 'var(--text3)', fontStyle: 'italic' }}>No appts today</div>
              ) : (
                todaysAppts.slice(0, 2).map((a, i) => (
                  <div key={i} style={{ fontSize: '9px', color: 'var(--text)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.title?.substring(0, 12)}
                  </div>
                ))
              )}
              {todaysAppts.length > 2 && <div style={{ fontSize: '8px', color: 'var(--text3)' }}>+{todaysAppts.length - 2} more</div>}
            </div>
          </div>
        </MediumCard>

        {/* 7. TASKS - Same size as calendar */}
        <MediumCard style={{ minWidth: '140px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CheckSquare size={10} style={{ color: '#3b82f6' }} />
              <span style={{ fontSize: '8px', color: 'var(--text3)', fontWeight: '600', textTransform: 'uppercase' }}>Tasks</span>
            </div>
            <span style={{ background: '#3b82f6', color: '#fff', fontSize: '9px', fontWeight: '700', padding: '1px 6px', borderRadius: '8px' }}>{tasksDueToday.length}</span>
          </div>
          <div style={{ maxHeight: '50px', overflowY: 'auto' }}>
            {tasksDueToday.length === 0 ? (
              <div style={{ fontSize: '10px', color: 'var(--text3)', fontStyle: 'italic' }}>All caught up!</div>
            ) : (
              tasksDueToday.slice(0, 3).map((t, i) => (
                <div key={i} onClick={() => onSelectBorrower(t.borrower.id)} style={{ fontSize: '9px', color: 'var(--text)', cursor: 'pointer', padding: '2px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: '600' }}>{t.borrower.name?.split(' ')[0]}</span>: {t.title?.substring(0, 15)}
                </div>
              ))
            )}
          </div>
        </MediumCard>

        {/* 8. FLOATING */}
        <SmallCard icon={AlertTriangle} label="Floating" value={floatingLoans.length} color="#f59e0b" onClick={() => {}} />

        {/* 9. LOCK EXPIRY */}
        <SmallCard icon={Lock} label="Lock Expiry" value={locksExpiring.length} color="#ef4444" onClick={() => {}} />

        {/* 10. CONTINGENCIES */}
        <SmallCard icon={Clock} label="Contg" value={contingenciesDue.length} color="#8b5cf6" onClick={() => {}} />

        {/* 11. DONUT CHART */}
        <div style={{ background: '#1e293b', borderRadius: '8px', padding: '6px 10px', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <DonutChart data={donutData} size={65} />
        </div>
      </div>

      {/* Calendar Popup */}
      {showCalendar && (
        <div style={{ position: 'fixed', zIndex: 1000, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', minWidth: '320px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontWeight: '700', color: 'var(--text)', fontSize: '16px' }}>{format(new Date(), 'MMMM yyyy')}</span>
            <button onClick={() => setShowCalendar(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '18px' }}>×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i) => <div key={i} style={{ fontSize: '10px', color: 'var(--text3)', padding: '6px', fontWeight: '600' }}>{d}</div>)}
            {(() => {
              const today = new Date();
              const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
              const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
              const cells = [];
              for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
              for (let d = 1; d <= daysInMonth; d++) {
                const isToday = d === today.getDate();
                const dayAppts = getApptsForDate(d);
                cells.push(
                  <div
                    key={d}
                    onDoubleClick={() => {
                      setAddingAppt({ day: d });
                      setApptForm({ title: '', time: '', borrower_id: borrowers[0]?.id || '' });
                    }}
                    style={{
                      padding: '6px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer',
                      background: isToday ? '#3b82f6' : dayAppts.length > 0 ? '#22c55e20' : 'transparent',
                      color: isToday ? '#fff' : 'var(--text)', fontWeight: isToday ? '700' : '400',
                      border: dayAppts.length > 0 && !isToday ? '1px solid #22c55e' : '1px solid transparent',
                      position: 'relative',
                    }}
                  >
                    {d}
                    {dayAppts.length > 0 && <div style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: isToday ? '#fff' : '#22c55e' }} />}
                  </div>
                );
              }
              return cells;
            })()}
          </div>
          <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text3)' }}>Double-click a date to add appointment</div>

          {/* Add Appointment Form */}
          {addingAppt && (
            <div style={{ marginTop: '12px', padding: '12px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text)', marginBottom: '8px' }}>
                Add Appointment - {format(new Date(new Date().getFullYear(), new Date().getMonth(), addingAppt.day), 'MMM d, yyyy')}
              </div>
              <input
                type="text"
                placeholder="Title"
                value={apptForm.title}
                onChange={e => setApptForm(f => ({ ...f, title: e.target.value }))}
                style={{ width: '100%', padding: '6px', marginBottom: '6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }}
              />
              <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                <input
                  type="time"
                  value={apptForm.time}
                  onChange={e => setApptForm(f => ({ ...f, time: e.target.value }))}
                  style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }}
                />
                <select
                  value={apptForm.borrower_id}
                  onChange={e => setApptForm(f => ({ ...f, borrower_id: e.target.value }))}
                  style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }}
                >
                  {borrowers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={async () => {
                    if (!apptForm.title || !apptForm.time || !apptForm.borrower_id) {
                      alert('Please fill all fields');
                      return;
                    }
                    const dueDate = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(addingAppt.day).padStart(2, '0')}T${apptForm.time}`;
                    try {
                      await ops.addTask({
                        title: apptForm.title,
                        due_date: dueDate,
                        type: 'appointment',
                        assigned_to: 'Danielle',
                        borrower_id: apptForm.borrower_id
                      });
                      setAddingAppt(null);
                    } catch (e) {
                      alert('Failed to add: ' + e.message);
                    }
                  }}
                  style={{ flex: 1, padding: '6px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Save
                </button>
                <button
                  onClick={() => setAddingAppt(null)}
                  style={{ padding: '6px 12px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {showCalendar && <div onClick={() => setShowCalendar(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }} />}
    </div>
  );
};

export default DashboardHeader;
