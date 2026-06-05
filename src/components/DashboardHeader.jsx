import React, { useMemo, useState } from 'react';
import { format, parseISO, differenceInDays, isSameDay, startOfDay } from 'date-fns';
import { Calendar, Lock, AlertTriangle, Clock, CheckSquare, TrendingUp, DollarSign, Home, Users, X } from 'lucide-react';
import { STAGES, STAGE_COLORS } from '../lib/constants';
import { formatCurrency } from '../lib/utils';

// Assignee colors - text only, no pills
const getAssigneeTextColor = (name) => {
  if (name === 'Danielle') return '#fbbf24'; // yellow
  if (name === 'Hailey') return '#22c55e'; // green
  return '#6b7280';
};

// Full Tasks Modal with sorting
const TasksModal = ({ tasks, onClose, onSelectBorrower, onToggleTask, onDeleteTask }) => {
  const [sortBy, setSortBy] = useState('date');

  const sortedTasks = useMemo(() => {
    let sorted = [...tasks];
    if (sortBy === 'date') sorted.sort((a, b) => a.daysUntil - b.daysUntil);
    if (sortBy === 'borrower') sorted.sort((a, b) => (a.borrower.name || '').localeCompare(b.borrower.name || ''));
    if (sortBy === 'danielle') sorted = sorted.filter(t => t.assigned_to === 'Danielle').sort((a, b) => a.daysUntil - b.daysUntil);
    if (sortBy === 'hailey') sorted = sorted.filter(t => t.assigned_to === 'Hailey').sort((a, b) => a.daysUntil - b.daysUntil);
    if (sortBy === 'overdue') sorted = sorted.filter(t => t.daysUntil < 0).sort((a, b) => a.daysUntil - b.daysUntil);
    return sorted;
  }, [tasks, sortBy]);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', zIndex: 1000, minWidth: '650px', maxWidth: '800px', maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)' }}>All Tasks ({tasks.length})</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Sort:</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
              <option value="date">Date</option>
              <option value="overdue">Overdue</option>
              <option value="borrower">Borrower</option>
              <option value="danielle">Danielle</option>
              <option value="hailey">Hailey</option>
            </select>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', marginLeft: '8px' }}><X size={20} /></button>
          </div>
        </div>
        {sortedTasks.length === 0 ? (
          <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '40px', fontSize: '15px' }}>No tasks - you're all caught up! 🎉</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sortedTasks.map((t, i) => (
              <div key={i} onClick={() => { onSelectBorrower(t.borrower.id); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 14px', background: 'var(--surface2)', borderRadius: '8px', borderLeft: t.daysUntil < 0 ? '3px solid #ef4444' : t.daysUntil === 0 ? '3px solid #f59e0b' : '3px solid var(--border)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={t.completed || false}
                  onChange={(e) => { e.stopPropagation(); onToggleTask?.(t.id, !t.completed); }}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                <span style={{ color: t.daysUntil < 0 ? '#ef4444' : t.daysUntil === 0 ? '#f59e0b' : '#a0a0b8', fontWeight: '700', minWidth: '70px', fontSize: '14px' }}>
                  {t.date ? (t.daysUntil < 0 ? 'OVERDUE' : t.daysUntil === 0 ? 'TODAY' : format(t.date, 'M/d')) : '—'}
                </span>
                <span style={{ fontWeight: '700', color: '#3b82f6', minWidth: '140px', fontSize: '14px' }}>{t.borrower.name?.split(',')[0]}</span>
                <span style={{ flex: 1, color: 'var(--text)', fontSize: '14px' }}>{t.title}</span>
                {t.assigned_to && <span style={{ fontSize: '12px', color: getAssigneeTextColor(t.assigned_to), fontWeight: '700' }}>{t.assigned_to}</span>}
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteTask?.(t.id); }}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', fontWeight: '700' }}
                >×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

// Appointments Modal - like Tasks Modal
const AppointmentsModal = ({ appointments, onClose, onSelectBorrower, onDeleteAppt, onToggleAppt }) => {
  const [sortBy, setSortBy] = useState('date');

  const sortedAppts = useMemo(() => {
    let sorted = [...appointments];
    if (sortBy === 'date') sorted.sort((a, b) => a.daysUntil - b.daysUntil);
    if (sortBy === 'all') sorted.sort((a, b) => a.daysUntil - b.daysUntil);
    if (sortBy === 'overdue') sorted = sorted.filter(t => t.daysUntil < 0).sort((a, b) => a.daysUntil - b.daysUntil);
    if (sortBy === 'danielle') sorted = sorted.filter(t => t.assigned_to === 'Danielle').sort((a, b) => a.daysUntil - b.daysUntil);
    if (sortBy === 'hailey') sorted = sorted.filter(t => t.assigned_to === 'Hailey').sort((a, b) => a.daysUntil - b.daysUntil);
    return sorted;
  }, [appointments, sortBy]);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', zIndex: 1000, minWidth: '650px', maxWidth: '800px', maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)' }}>All Appointments ({appointments.length})</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Sort:</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
              <option value="date">Date</option>
              <option value="overdue">Overdue</option>
              <option value="danielle">Danielle</option>
              <option value="hailey">Hailey</option>
            </select>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', marginLeft: '8px' }}><X size={20} /></button>
          </div>
        </div>
        {sortedAppts.length === 0 ? (
          <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '40px', fontSize: '15px' }}>No appointments scheduled</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sortedAppts.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 14px', background: t.completed ? '#1e293b' : 'var(--surface2)', borderRadius: '8px', borderLeft: t.daysUntil < 0 ? '3px solid #ef4444' : t.daysUntil === 0 ? '3px solid #3b82f6' : '3px solid var(--border)' }}>
                <input
                  type="checkbox"
                  checked={t.completed || false}
                  onChange={(e) => { e.stopPropagation(); onToggleAppt?.(t.id, !t.completed); }}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                <span onClick={() => { onSelectBorrower(t.borrower.id); onClose(); }} style={{ color: t.daysUntil < 0 ? '#ef4444' : t.daysUntil === 0 ? '#3b82f6' : '#a0a0b8', fontWeight: '700', minWidth: '70px', fontSize: '14px', cursor: 'pointer', textDecoration: t.completed ? 'line-through' : 'none' }}>
                  {t.date ? (t.daysUntil < 0 ? 'OVERDUE' : t.daysUntil === 0 ? 'TODAY' : format(t.date, 'M/d')) : '—'}
                </span>
                <span onClick={() => { onSelectBorrower(t.borrower.id); onClose(); }} style={{ fontWeight: '700', color: '#3b82f6', minWidth: '140px', fontSize: '14px', cursor: 'pointer', textDecoration: t.completed ? 'line-through' : 'none' }}>{t.borrower.name?.split(',')[0]}</span>
                <span onClick={() => { onSelectBorrower(t.borrower.id); onClose(); }} style={{ flex: 1, color: 'var(--text)', fontSize: '14px', cursor: 'pointer', textDecoration: t.completed ? 'line-through' : 'none' }}>{t.title}</span>
                {t.assigned_to && <span style={{ fontSize: '12px', color: getAssigneeTextColor(t.assigned_to), fontWeight: '700' }}>{t.assigned_to}</span>}
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteAppt?.(t.id); }}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', fontWeight: '700' }}
                >×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
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
      <span style={{ fontSize: '8px', color: '#a0a0b8', fontWeight: '600', textTransform: 'uppercase' }}>{label}</span>
    </div>
    <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)', lineHeight: 1 }}>{value}</div>
  </div>
);

// Medium card for Calendar and Tasks
const MediumCard = ({ children, style = {} }) => (
  <div style={{
    background: 'var(--surface2)', borderRadius: '8px', padding: '4px 8px',
    minWidth: '130px', border: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
    ...style
  }}>
    {children}
  </div>
);

const DashboardHeader = ({ borrowers = [], onSelectBorrower, onFilterStage, ops, onToggleTask, onDeleteTask }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [showApptsModal, setShowApptsModal] = useState(false);
  const [addingAppt, setAddingAppt] = useState(null);
  const [apptForm, setApptForm] = useState({ title: '', time: '', borrower_id: '' });

  const dashboardData = useMemo(() => {
    const today = new Date();
    if (!borrowers || !Array.isArray(borrowers)) {
      return {
        tasksDueToday: [], todaysAppts: [], allTasks: [], locksExpiring: [], floatingLoans: [], contingenciesDue: [],
        stageCounts: {}, donutData: [], totalVolume: 0, totalRevenue: 0, processingCount: 0, fundedCount: 0, totalLoans: 0,
      };
    }

    // All tasks/appointments
    const allTasks = [];
    borrowers.forEach(b => {
      (b.tasks || []).forEach(t => {
        if (t.completed) return;
        if (t.due_date) {
          try {
            const taskDate = startOfDay(parseISO(t.due_date));
            const todayStart = startOfDay(today);
            if (isNaN(taskDate.getTime())) return;
            const daysUntil = differenceInDays(taskDate, todayStart);
            allTasks.push({ ...t, borrower: b, daysUntil, isToday: daysUntil === 0, date: taskDate });
          } catch (e) {
            console.warn('Invalid task date:', t.due_date);
          }
        } else {
          // Tasks without due date - show as "no date"
          allTasks.push({ ...t, borrower: b, daysUntil: 999, isToday: false, date: null });
        }
      });
    });
    allTasks.sort((a, b) => a.daysUntil - b.daysUntil);
    // Tasks due today or overdue
    const tasksDueToday = allTasks.filter(t => t.daysUntil <= 0);
    // Upcoming tasks (next 7 days, not today)
    const upcomingTasks = allTasks.filter(t => t.daysUntil > 0 && t.daysUntil <= 7);
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
    stageCounts, donutData, totalVolume, totalRevenue, processingCount, fundedCount, totalLoans,
  } = dashboardData;

  // Separate appointments and tasks
  const allAppointments = allTasks.filter(t => t.type === 'appointment');
  const onlyTasks = allTasks.filter(t => t.type !== 'appointment');

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
      <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch', width: '100%' }}>

        {/* 1. PIPELINE */}
        <SmallCard icon={Users} label="Pipeline" value={totalLoans} color="#8b5cf6" />

        {/* 2. PROCESSING + FUNDED */}
        <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '6px 12px', minWidth: '70px', border: '1px solid var(--border)', cursor: 'pointer' }}>
          <div onClick={() => onFilterStage('Processing')} style={{ marginBottom: '4px' }}>
            <div style={{ fontSize: '8px', color: '#06b6d4', fontWeight: '600', textTransform: 'uppercase' }}>Processing</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff' }}>{processingCount}</div>
          </div>
          <div onClick={() => onFilterStage('Funded')}>
            <div style={{ fontSize: '8px', color: '#10b981', fontWeight: '600', textTransform: 'uppercase' }}>Funded</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff' }}>{fundedCount}</div>
          </div>
        </div>

        {/* 3. WORKING */}
        <SmallCard icon={TrendingUp} label="Working" value={stageCounts['Working'] || 0} color="#3b82f6" onClick={() => onFilterStage('Working')} />

        {/* 4. SHOPPING */}
        <SmallCard icon={Home} label="Shopping" value={stageCounts['Shopping'] || 0} color="#f59e0b" onClick={() => onFilterStage('Shopping')} />

        {/* 5. CALENDAR - ONLY appointments */}
        <div style={{ background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flex: '1 1 20%', minWidth: '280px', padding: '6px 10px', gap: '10px' }}>
          {/* Date box - F R I vertical LEFT of 5 - INSIDE the box */}
          <div onClick={() => setShowApptsModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', paddingRight: '10px', borderRight: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', lineHeight: 1.1 }}>F</span>
              <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', lineHeight: 1.1 }}>R</span>
              <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', lineHeight: 1.1 }}>I</span>
            </div>
            <div style={{ fontSize: '28px', color: '#fff', fontWeight: '800', lineHeight: 1 }}>{format(new Date(), 'd')}</div>
          </div>
          {/* Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <span onClick={() => setShowApptsModal(true)} style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '700', cursor: 'pointer' }}>CALENDAR</span>
              <span onClick={() => setShowApptsModal(true)} style={{ background: '#3b82f6', color: '#fff', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', cursor: 'pointer' }}>{allAppointments.filter(t => t.daysUntil >= 0 && !t.completed).length}</span>
            </div>
            {allAppointments.filter(t => t.daysUntil >= 0 && !t.completed).length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text3)' }}>No appointments</div>
            ) : (
              <>
                {allAppointments.filter(t => t.daysUntil >= 0 && !t.completed).slice(0, 2).map((t, i) => (
                  <div key={i} onClick={() => onSelectBorrower(t.borrower.id)} style={{ fontSize: '11px', color: 'var(--text)', cursor: 'pointer', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ color: t.daysUntil === 0 ? '#fbbf24' : '#f59e0b', fontWeight: '700' }}>{t.daysUntil === 0 ? 'TODAY' : format(t.date, 'M/d')}</span>
                    <span style={{ fontWeight: '600' }}>{t.borrower.name?.split(',')[0]}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                    {t.assigned_to && <span style={{ fontSize: '10px', color: '#a855f7', fontWeight: '600' }}>{t.assigned_to}</span>}
                  </div>
                ))}
                {allAppointments.filter(t => t.daysUntil >= 0 && !t.completed).length > 2 && (
                  <div onClick={() => setShowApptsModal(true)} style={{ fontSize: '11px', color: '#22c55e', cursor: 'pointer', fontWeight: '600' }}>
                    +{allAppointments.filter(t => t.daysUntil >= 0 && !t.completed).length - 2} more...
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Appointments Modal */}
        {showApptsModal && (
          <AppointmentsModal
            appointments={allAppointments}
            onClose={() => setShowApptsModal(false)}
            onSelectBorrower={onSelectBorrower}
            onDeleteAppt={onDeleteTask}
            onToggleAppt={onToggleTask}
          />
        )}

        {/* 7. TASKS - ONLY tasks (not appointments) */}
        <div style={{ background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)', flex: '1 1 20%', minWidth: '280px', padding: '4px 10px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
            <span onClick={() => setShowTasksModal(true)} style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '700', cursor: 'pointer' }}>TASKS</span>
            <span onClick={() => setShowTasksModal(true)} style={{ background: '#3b82f6', color: '#fff', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', cursor: 'pointer' }}>{onlyTasks.filter(t => t.daysUntil >= 0 && !t.completed).length}</span>
          </div>
          {onlyTasks.filter(t => t.daysUntil >= 0 && !t.completed).length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text3)' }}>All caught up!</div>
          ) : (
            <>
              {onlyTasks.filter(t => t.daysUntil >= 0 && !t.completed).slice(0, 2).map((t, i) => (
                <div key={i} onClick={() => onSelectBorrower(t.borrower.id)} style={{ fontSize: '11px', color: 'var(--text)', cursor: 'pointer', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ color: t.daysUntil === 0 ? '#fbbf24' : '#f59e0b', fontWeight: '700' }}>{t.daysUntil === 0 ? 'TODAY' : format(t.date, 'M/d')}</span>
                  <span style={{ fontWeight: '600' }}>{t.borrower.name?.split(',')[0]}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                  {t.assigned_to && <span style={{ fontSize: '10px', color: '#a855f7', fontWeight: '600' }}>{t.assigned_to}</span>}
                </div>
              ))}
              {onlyTasks.filter(t => t.daysUntil >= 0 && !t.completed).length > 2 && (
                <div onClick={() => setShowTasksModal(true)} style={{ fontSize: '11px', color: '#22c55e', cursor: 'pointer', fontWeight: '600' }}>
                  +{onlyTasks.filter(t => t.daysUntil >= 0 && !t.completed).length - 2} more...
                </div>
              )}
            </>
          )}
        </div>

        {/* Tasks Modal - ONLY TASKS (not appointments) */}
        {showTasksModal && (
          <TasksModal
            tasks={onlyTasks}
            onClose={() => setShowTasksModal(false)}
            onSelectBorrower={onSelectBorrower}
            onToggleTask={onToggleTask}
            onDeleteTask={onDeleteTask}
          />
        )}

        {/* 8. FLOATING + LOCK EXPIRY */}
        <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '6px 12px', minWidth: '70px', border: '1px solid var(--border)' }}>
          <div style={{ marginBottom: '4px' }}>
            <div style={{ fontSize: '8px', color: '#f59e0b', fontWeight: '600', textTransform: 'uppercase' }}>Floating</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff' }}>{floatingLoans.length}</div>
          </div>
          <div>
            <div style={{ fontSize: '8px', color: '#ef4444', fontWeight: '600', textTransform: 'uppercase' }}>Lock Expiry</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff' }}>{locksExpiring.length}</div>
          </div>
        </div>

        {/* 11. REVENUE & VOLUME */}
        <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '8px 12px', minWidth: '90px', border: '1px solid var(--border)' }}>
          <div style={{ marginBottom: '6px' }}>
            <div style={{ fontSize: '8px', color: 'var(--text3)', fontWeight: '600', textTransform: 'uppercase' }}>Revenue</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#10b981' }}>{formatCurrency(totalRevenue)}</div>
          </div>
          <div>
            <div style={{ fontSize: '8px', color: 'var(--text3)', fontWeight: '600', textTransform: 'uppercase' }}>Volume</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>{formatCurrency(totalVolume)}</div>
          </div>
        </div>

        {/* 12. DONUT CHART */}
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
