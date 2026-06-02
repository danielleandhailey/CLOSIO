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
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const sendMessage = async (message, senderName, senderRole) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('team_chat').insert([{
      message,
      sender_name: senderName,
      sender_role: senderRole,
      user_id: user?.id
    }]);
    if (error) {
      console.error('Team chat send error:', error);
      throw error;
    }
  };

  return { messages, loading, sendMessage };
};
