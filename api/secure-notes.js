import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'closio-default-key-change-me-32!'; // Must be 32 chars
const ALGORITHM = 'aes-256-cbc';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  try {
    const [ivHex, encrypted] = text.split(':');
    if (!ivHex || !encrypted) return text; // Not encrypted, return as-is
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return text; // If decryption fails, return original (probably not encrypted)
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // POST = save encrypted note
  if (req.method === 'POST') {
    const { userId, noteText, existingIndex } = req.body;
    if (!userId || !noteText) {
      return res.status(400).json({ error: 'Missing userId or noteText' });
    }

    const newEntry = `- ${noteText}`;
    const newIndex = existingIndex ? `${existingIndex}\n${newEntry}` : newEntry;
    const encrypted = encrypt(newIndex);

    const { data, error } = await supabase.from('lender_matrices').upsert({
      user_id: userId,
      lender_name: 'My Notes',
      ai_index: encrypted,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'lender_name,user_id' }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, id: data?.id });
  }

  // GET = fetch and decrypt notes
  if (req.method === 'GET') {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const { data, error } = await supabase.from('lender_matrices')
      .select('*')
      .eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });

    // Decrypt ai_index for each matrix
    const decrypted = (data || []).map(m => ({
      ...m,
      ai_index: m.lender_name === 'My Notes' ? decrypt(m.ai_index || '') : m.ai_index
    }));

    return res.status(200).json({ data: decrypted });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
