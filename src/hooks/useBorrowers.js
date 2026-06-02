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
        .order('created_at', { ascending: true });

      if (error) throw error;
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
    const { data, error } = await supabase
      .from('borrowers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await fetchBorrowers();
    return data;
  };

  const deleteBorrower = async (id) => {
    const { error } = await supabase.from('borrowers').delete().eq('id', id);
    if (error) throw error;
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
    return data;
  };

  const updateTask = async (id, updates) => {
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  };

  const deleteTask = async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
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
  };

  const markStipReceived = async (id, docDate) => {
    const { error } = await supabase.from('stipulations').update({
      received: true, received_date: new Date().toISOString().split('T')[0], doc_date: docDate
    }).eq('id', id);
    if (error) throw error;
  };

  const removeStipulation = async (id) => {
    const { error } = await supabase.from('stipulations').delete().eq('id', id);
    if (error) throw error;
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

  return {
    borrowers,
    loading,
    error,
    refetch: fetchBorrowers,
    addBorrower,
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
    seedInitialData,
  };
};
