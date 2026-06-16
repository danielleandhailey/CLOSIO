import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { INITIAL_BORROWERS, INITIAL_TAGS, INITIAL_TASKS, INITIAL_CONTINGENCIES, INITIAL_CONTACTS } from '../lib/constants';

export const useBorrowers = () => {
  const [borrowers, setBorrowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBorrowers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('borrowers')
        .select(`
          *,
          borrower_tags(*),
          tasks(*),
          contingencies(*),
          contacts(*),
          stipulations(*)
        `)
        // created_at first, then id as a STABLE tiebreaker so records with the
        // same/blank created_at never swap order between refetches (which made
        // open files jump up/down every poll). Order is now deterministic.
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (error) throw error;

      // Fetch notes_history separately (table may not exist yet)
      if (data) {
        try {
          const { data: notesData } = await supabase.from('notes_history').select('*');
          if (notesData) {
            data.forEach(b => {
              b.notes_history = notesData.filter(n => n.borrower_id === b.id);
            });
          }
        } catch (e) {
          // notes_history table doesn't exist yet - that's ok
        }
      }
      setBorrowers(data || []);
    } catch (e) {
      setError(e.message);
      console.error('Fetch borrowers error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBorrowers();

    // Poll every 60 seconds for webhook-created records
    const pollInterval = setInterval(fetchBorrowers, 60000);

    // Real-time subscription for borrowers
    const borrowerSub = supabase
      .channel('borrowers-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'borrowers' }, () => {
        fetchBorrowers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'borrower_tags' }, () => {
        fetchBorrowers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchBorrowers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contingencies' }, () => {
        fetchBorrowers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        fetchBorrowers();
      })
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(borrowerSub);
    };
  }, [fetchBorrowers]);

  // ---- CRUD Operations ----

  const addBorrower = async (borrowerData) => {
    const { data, error } = await supabase
      .from('borrowers')
      .insert([{ ...borrowerData, last_touched: new Date().toISOString() }])
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  const updateBorrower = async (id, updates) => {
    let payload = { ...updates };

    // Stamp each manually-edited field with today's date so a dropped document can
    // only overwrite it when the document is newer-dated (smart recency). Skip
    // bookkeeping keys and any call that already manages field_dates itself.
    if (updates.field_dates === undefined) {
      const NON_FIELD_KEYS = new Set(['updated_at', 'last_touched', 'stage', 'field_dates', 'notes']);
      const stampKeys = Object.keys(updates).filter(k => !NON_FIELD_KEYS.has(k));
      if (stampKeys.length) {
        const today = new Date().toISOString().slice(0, 10);
        const current = borrowers.find(b => b.id === id)?.field_dates || {};
        const stamps = {};
        stampKeys.forEach(k => { stamps[k] = today; });
        payload.field_dates = { ...current, ...stamps };
      }
    }

    let { data, error } = await supabase
      .from('borrowers')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    // field_dates column may not exist on older databases — retry without it.
    if (error && payload.field_dates !== undefined) {
      const { field_dates, ...rest } = payload;
      ({ data, error } = await supabase
        .from('borrowers')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single());
    }

    // Still failing? A column may not exist — save field-by-field, skipping any
    // that fail, so one missing column never breaks (or appears to "lose") a record.
    if (error) {
      const { field_dates, ...rest } = payload;
      let anyOk = false;
      for (const [k, v] of Object.entries(rest)) {
        const { error: e2 } = await supabase
          .from('borrowers')
          .update({ [k]: v, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (!e2) anyOk = true;
        else console.warn(`Skipped borrower field "${k}":`, e2.message);
      }
      if (!anyOk) throw error;
    }

    await fetchBorrowers();
    return data;
  };

  const deleteBorrower = async (id) => {
    const { error } = await supabase.from('borrowers').delete().eq('id', id);
    if (error) throw error;
    await fetchBorrowers();
  };

  const touchBorrower = async (id) => {
    const result = await updateBorrower(id, { last_touched: new Date().toISOString() });
    await fetchBorrowers(); // force refresh to show updated date
    return result;
  };

  const moveBorrower = async (id, newStage, fromStage) => {
    // Log stage history — non-blocking, don't let failure stop the move
    supabase.from('stage_history').insert([{
      borrower_id: id, from_stage: fromStage, to_stage: newStage
    }]).then(() => {}).catch(() => {});
    return updateBorrower(id, { stage: newStage });
  };

  // ---- Tags ----
  const addTag = async (borrowerId, tag) => {
    const { error } = await supabase.from('borrower_tags').insert([{ borrower_id: borrowerId, tag }]);
    if (error) { console.error('addTag error:', error); throw error; }
    await fetchBorrowers(); // force refresh
  };

  const removeTag = async (tagId) => {
    const { error } = await supabase.from('borrower_tags').delete().eq('id', tagId);
    if (error) { console.error('removeTag error:', error); throw error; }
    await fetchBorrowers();
  };

  // ---- Tasks ----
  const addTask = async (taskData) => {
    const { data, error } = await supabase.from('tasks').insert([taskData]).select().single();
    if (error) throw error;
    await fetchBorrowers(); // Refresh to show new task
    return data;
  };

  const updateTask = async (id, updates) => {
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single();
    if (error) throw error;
    await fetchBorrowers();
    return data;
  };

  const deleteTask = async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
    await fetchBorrowers();
  };

  // ---- Contingencies ----
  const addContingency = async (borrowerId, name, dueDate) => {
    const { error } = await supabase.from('contingencies').insert([{
      borrower_id: borrowerId, name, due_date: dueDate
    }]);
    if (error) throw error;
  };

  const removeContingency = async (id) => {
    const { error } = await supabase.from('contingencies').delete().eq('id', id);
    if (error) throw error;
  };

  const toggleContingency = async (id, completed) => {
    const { error } = await supabase.from('contingencies').update({ completed }).eq('id', id);
    if (error) throw error;
  };

  // ---- Contacts ----
  const upsertContact = async (borrowerId, role, contactData) => {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('borrower_id', borrowerId)
      .eq('role', role)
      .single();

    if (existing) {
      const { error } = await supabase.from('contacts').update(contactData).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('contacts').insert([{
        borrower_id: borrowerId, role, ...contactData
      }]);
      if (error) throw error;
    }
  };

  // ---- Stipulations ----
  const addStipulation = async (borrowerId, item) => {
    const { error } = await supabase.from('stipulations').insert([{ borrower_id: borrowerId, item }]);
    if (error) throw error;
    await fetchBorrowers();
  };

  const markStipReceived = async (id, docDate) => {
    const { error } = await supabase.from('stipulations').update({
      received: true, received_date: new Date().toISOString().split('T')[0], doc_date: docDate
    }).eq('id', id);
    if (error) throw error;
    await fetchBorrowers();
  };

  const removeStipulation = async (id) => {
    const { error } = await supabase.from('stipulations').delete().eq('id', id);
    if (error) throw error;
    await fetchBorrowers();
  };

  // ---- Notes History ----
  const addNote = async (borrowerId, note) => {
    const dateStamp = new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
    const stampedNote = `[${dateStamp}] ${note}`;

    // Try notes_history table first
    const { error: histError } = await supabase.from('notes_history').insert([{ borrower_id: borrowerId, note: stampedNote }]);

    // Get current notes and prepend new one
    const { data: borrower } = await supabase.from('borrowers').select('notes').eq('id', borrowerId).single();
    const existingNotes = borrower?.notes || '';
    const newNotes = existingNotes ? `${stampedNote}\n${existingNotes}` : stampedNote;

    await supabase.from('borrowers').update({ notes: newNotes, updated_at: new Date().toISOString() }).eq('id', borrowerId);
    await fetchBorrowers();
  };

  const deleteNote = async (noteId) => {
    const { error } = await supabase.from('notes_history').delete().eq('id', noteId);
    if (error) throw error;
    await fetchBorrowers();
  };

  // ---- Seed initial data ----
  const seedInitialData = async () => {
    const { data: existing } = await supabase.from('borrowers').select('id').limit(1);
    if (existing && existing.length > 0) return; // Already seeded

    for (const b of INITIAL_BORROWERS) {
      const { data: newB } = await supabase.from('borrowers').insert([b]).select().single();
      if (!newB) continue;

      // Seed tags
      if (INITIAL_TAGS[b.name]) {
        for (const tag of INITIAL_TAGS[b.name]) {
          await supabase.from('borrower_tags').insert([{ borrower_id: newB.id, tag }]);
        }
      }

      // Seed tasks
      if (INITIAL_TASKS[b.name]) {
        for (const task of INITIAL_TASKS[b.name]) {
          await supabase.from('tasks').insert([{ borrower_id: newB.id, ...task }]);
        }
      }

      // Seed contacts
      if (INITIAL_CONTACTS[b.name]) {
        for (const contact of INITIAL_CONTACTS[b.name]) {
          await supabase.from('contacts').insert([{ borrower_id: newB.id, ...contact }]);
        }
      }

      // Seed contingencies
      if (INITIAL_CONTINGENCIES[b.name]) {
        for (const c of INITIAL_CONTINGENCIES[b.name]) {
          await supabase.from('contingencies').insert([{ borrower_id: newB.id, ...c }]);
        }
      }
    }
    console.log('✅ Initial data seeded');
  };

  // Merge duplicates: keep winnerId, fill its blank fields from the losers,
  // move child records (docs, tasks, contacts, etc.) onto the winner, delete losers.
  const mergeBorrowers = async (winnerId, loserIds, overrides = {}) => {
    const winner = borrowers.find(b => b.id === winnerId);
    const losers = (loserIds || []).map(id => borrowers.find(b => b.id === id)).filter(Boolean);
    if (!winner || !losers.length) return;

    const SKIP = new Set(['id', 'created_at', 'updated_at', 'user_id',
      'borrower_tags', 'tasks', 'contingencies', 'contacts', 'stipulations']);
    const isEmpty = (v) => v === null || v === undefined || v === '' ||
      (Array.isArray(v) && v.length === 0) ||
      (typeof v === 'object' && !Array.isArray(v) && v && Object.keys(v).length === 0);

    // Fill any blank winner field from a loser that has it
    const updates = {};
    for (const loser of losers) {
      for (const [k, v] of Object.entries(loser)) {
        if (SKIP.has(k) || isEmpty(v)) continue;
        if (isEmpty(winner[k]) && isEmpty(updates[k])) updates[k] = v;
      }
    }
    // Combine income arrays across all records
    const allIncomes = [winner, ...losers].flatMap(b => Array.isArray(b.incomes) ? b.incomes : []);
    if (allIncomes.length) updates.incomes = allIncomes;

    // Force any explicit overrides (e.g. a corrected stage chosen at merge time)
    Object.assign(updates, overrides);

    // Move child records from each loser to the winner
    const childTables = ['documents', 'tasks', 'contacts', 'contingencies', 'stipulations', 'borrower_tags', 'stage_history', 'notes_history'];
    for (const loser of losers) {
      for (const t of childTables) {
        try { await supabase.from(t).update({ borrower_id: winnerId }).eq('borrower_id', loser.id); } catch (e) { /* table may not exist */ }
      }
    }

    // Apply merged fields (resilient: per-field if a column is missing)
    if (Object.keys(updates).length) {
      const { error } = await supabase.from('borrowers').update(updates).eq('id', winnerId);
      if (error) {
        for (const [k, v] of Object.entries(updates)) {
          await supabase.from('borrowers').update({ [k]: v }).eq('id', winnerId);
        }
      }
    }

    await supabase.from('borrowers').delete().in('id', loserIds);
    await fetchBorrowers();
  };

  return {
    borrowers,
    loading,
    error,
    refetch: fetchBorrowers,
    addBorrower,
    mergeBorrowers,
    updateBorrower,
    deleteBorrower,
    touchBorrower,
    moveBorrower,
    addTag,
    removeTag,
    addTask,
    updateTask,
    deleteTask,
    addContingency,
    removeContingency,
    toggleContingency,
    upsertContact,
    addStipulation,
    markStipReceived,
    removeStipulation,
    addNote,
    deleteNote,
    seedInitialData,
  };
};
