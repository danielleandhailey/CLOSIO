import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!supabase) {
    return res.status(500).json({ error: 'Missing Supabase config' });
  }

  try {
    // Get all tasks
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, title, type');

    if (error) throw error;

    // Check current state
    const summary = {
      total: tasks.length,
      withType: tasks.filter(t => t.type).length,
      appointments: tasks.filter(t => t.type === 'appointment').length,
      tasks: tasks.filter(t => t.type === 'task').length,
      noType: tasks.filter(t => !t.type).length,
      items: tasks.map(t => ({ id: t.id, title: t.title?.substring(0, 30), type: t.type }))
    };

    // If fixing is requested
    if (req.query.fix === 'true') {
      // Set all tasks without type to 'task'
      const { data: fixed, error: fixError } = await supabase
        .from('tasks')
        .update({ type: 'task' })
        .is('type', null)
        .select();

      if (fixError) throw fixError;

      summary.fixed = fixed?.length || 0;
    }

    return res.status(200).json(summary);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
