import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export const useTeamChat = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load recent messages
    supabase
      .from('team_chat')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        setMessages(data || []);
        setLoading(false);
      });

    // Real-time subscription
    const channel = supabase
      .channel('team-chat-channel')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'team_chat'
      }, (payload) => {
        // Only add if not already in list (avoid duplicates from optimistic update)
        setMessages(prev => {
          const exists = prev.some(m => m.id === payload.new.id || m.message === payload.new.message && m.sender_name === payload.new.sender_name);
          if (exists) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
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
