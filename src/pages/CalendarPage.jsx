import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, isSameDay, parseISO, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { taskUrgency, urgencyColor } from '../lib/utils';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CalendarPage = ({ borrowers }) => {
  const [current, setCurrent] = useState(new Date());

  // Collect all tasks + appointments
  const allItems = useMemo(() => {
    const items = [];
    for (const b of borrowers) {
      for (const task of (b.tasks || [])) {
        if (task.due_date) {
          items.push({ ...task, borrowerName: b.name });
        }
      }
    }
    return items;
  }, [borrowers]);

  // Morning briefing
  const overdue = allItems.filter(t => !t.completed && taskUrgency(t.due_date) === 'overdue').length;
  const todayCount = allItems.filter(t => !t.completed && taskUrgency(t.due_date) === 'today').length;
  const totalOpen = allItems.filter(t => !t.completed).length;

  // Calendar grid
  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const getItemsForDay = (day) => {
    return allItems.filter(item => {
      const d = typeof item.due_date === 'string' ? parseISO(item.due_date) : item.due_date;
      return isSameDay(d, day);
    });
  };

  return (
    <div style={{ padding: '16px', flex: 1, overflow: 'auto' }}>
      {/* Morning Briefing */}
      <div className="briefing-card">
        <div style={{ marginRight: '8px' }}>
          <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '2px' }}>☀️ Morning Briefing</div>
          <div style={{ fontSize: '11px', color: '#6a6a80' }}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</div>
        </div>
        <div className="briefing-stat">
          <div className="num" style={{ color: '#dc2626' }}>{overdue}</div>
          <div className="lbl">Overdue</div>
        </div>
        <div className="briefing-stat">
          <div className="num" style={{ color: '#d97706' }}>{todayCount}</div>
          <div className="lbl">Due Today</div>
        </div>
        <div className="briefing-stat">
          <div className="num" style={{ color: '#6a6a80' }}>{totalOpen}</div>
          <div className="lbl">Total Open</div>
        </div>
      </div>

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <button type="button" className="btn-icon btn-ghost" onClick={() => setCurrent(d => subMonths(d, 1))}>
          <ChevronLeft size={16} />
        </button>
        <h2 style={{ flex: 1, textAlign: 'center', fontSize: '16px', fontWeight: '700', color: '#e8e8f0' }}>
          {format(current, 'MMMM yyyy')}
        </h2>
        <button type="button" className="btn-icon btn-ghost" onClick={() => setCurrent(d => addMonths(d, 1))}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', marginBottom: '1px' }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: '700', color: '#6a6a80', padding: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="calendar-grid">
        {days.map(day => {
          const dayItems = getItemsForDay(day);
          const isCurrentMonth = isSameMonth(day, current);
          const isCurrentDay = isToday(day);

          return (
            <div key={day.toISOString()} className={`calendar-day ${isCurrentDay ? 'today' : ''} ${!isCurrentMonth ? 'other-month' : ''}`}>
              <div className="cal-day-num">
                {isCurrentDay ? (
                  <span className="cal-day-num today-num">{format(day, 'd')}</span>
                ) : (
                  <span style={{ color: isCurrentMonth ? '#a0a0b8' : '#44445a' }}>{format(day, 'd')}</span>
                )}
              </div>
              {dayItems.slice(0, 3).map(item => {
                const urgency = item.type === 'appointment' ? 'appointment' : (item.completed ? 'completed' : taskUrgency(item.due_date));
                const isAppt = item.type === 'appointment';
                const colors = isAppt
                  ? { color: '#1e3a8a', bg: '#dbeafe' }
                  : urgencyColor(urgency);
                return (
                  <div key={item.id} style={{
                    fontSize: '9px',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    marginBottom: '2px',
                    background: colors.bg,
                    color: colors.color,
                    fontWeight: '500',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: 'default',
                  }} title={`${item.borrowerName}: ${item.title}`}>
                    {isAppt ? '📅 ' : ''}{item.borrowerName}: {item.title}
                  </div>
                );
              })}
              {dayItems.length > 3 && (
                <div style={{ fontSize: '9px', color: '#6a6a80' }}>+{dayItems.length - 3} more</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
        {[
          ['Overdue', '#dc2626', '#fee2e2'],
          ['Today', '#d97706', '#fef3c7'],
          ['Upcoming', '#16a34a', '#dcfce7'],
          ['Appointment', '#1e3a8a', '#dbeafe'],
        ].map(([label, color, bg]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: bg, border: `1px solid ${color}40`, display: 'inline-block' }} />
            <span style={{ color: '#a0a0b8' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarPage;
