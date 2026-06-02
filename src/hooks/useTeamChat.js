import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export const useTeamChat = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('team_chat')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
    // Poll every 3 seconds for new messages
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async (message, senderName, senderRole) => {
    const { data: { user } } = await supabase.auth.getUser();
    const newMsg = {
      id: Date.now().toString(),
      message,
      sender_name: senderName,
      sender_role: senderRole,
      user_id: user?.id,
      created_at: new Date().toISOString()
    };
    // Optimistically add to UI
    setMessages(prev => [...prev, newMsg]);

    const { error } = await supabase.from('team_chat').insert([{
      message,
      sender_name: senderName,
      sender_role: senderRole,
      user_id: user?.id
    }]);
    if (error) {
      console.error('Team chat send error:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== newMsg.id));
      throw error;
    }
  };

  return { messages, loading, sendMessage };
};
