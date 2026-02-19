import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface UsePropertyAIChatOptions {
  propertyId: string;
  propertyData: {
    address: string;
    borough?: string | null;
    bin?: string | null;
    bbl?: string | null;
    stories?: number | null;
    dwelling_units?: number | null;
    year_built?: number | null;
    zoning_district?: string | null;
    building_class?: string | null;
    co_status?: string | null;
  };
  violations: { id: string; status: string; oath_status?: string | null; cure_due_date: string | null; hearing_date: string | null; is_stop_work_order: boolean; is_vacate_order: boolean }[];
  workOrders: { id: string; status: string }[];
}

export function usePropertyAIChat({ propertyId, propertyData, violations, workOrders }: UsePropertyAIChatOptions) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const isOpenRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetUnread = () => {
    setUnreadCount(0);
    queryClient.invalidateQueries({ queryKey: ['property-ai-conversation', propertyId] });
    queryClient.invalidateQueries({ queryKey: ['property-ai-messages'] });
  };

  const setOpen = (open: boolean) => {
    isOpenRef.current = open;
    if (open) resetUnread();
  };

  // Fetch existing conversation
  const { data: existingConversation } = useQuery({
    queryKey: ['property-ai-conversation', propertyId],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('property_ai_conversations')
        .select('id')
        .eq('property_id', propertyId)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
  });

  // Fetch messages
  const { data: existingMessages } = useQuery({
    queryKey: ['property-ai-messages', existingConversation?.id],
    queryFn: async () => {
      if (!existingConversation?.id) return [];
      const { data, error } = await supabase
        .from('property_ai_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', existingConversation.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data?.map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content })) || [];
    },
    enabled: !!existingConversation?.id,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (existingConversation?.id) setConversationId(existingConversation.id);
  }, [existingConversation?.id]);

  useEffect(() => {
    if (existingMessages && existingMessages.length > 0) {
      setMessages(prev => existingMessages.length >= prev.length ? existingMessages : prev);
    }
  }, [existingMessages]);

  // Realtime
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`property-ai-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'property_ai_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const newMsg = payload.new as { id: string; role: string; content: string };
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, { id: newMsg.id, role: newMsg.role as 'user' | 'assistant', content: newMsg.content }];
        });
        if (!isOpenRef.current) setUnreadCount(prev => prev + 1);
        queryClient.invalidateQueries({ queryKey: ['property-ai-messages', conversationId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  // Documents
  const { data: allDocuments } = useQuery({
    queryKey: ['property-documents-ai', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_documents')
        .select('id, document_type, document_name, metadata, extracted_text')
        .eq('property_id', propertyId)
        .eq('is_current', true);
      if (error) throw error;
      return data || [];
    },
  });

  const createConversation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('property_ai_conversations')
        .insert({ property_id: propertyId, user_id: user.id })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setConversationId(data.id);
      queryClient.invalidateQueries({ queryKey: ['property-ai-conversation', propertyId] });
    },
  });

  const saveMessage = useMutation({
    mutationFn: async ({ conversationId: cid, role, content }: { conversationId: string; role: 'user' | 'assistant'; content: string }) => {
      const { error } = await supabase.from('property_ai_messages').insert({ conversation_id: cid, role, content });
      if (error) throw error;
    },
  });

  const clearConversation = useMutation({
    mutationFn: async () => {
      if (!conversationId) return;
      const { error } = await supabase.from('property_ai_conversations').delete().eq('id', conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      setMessages([]);
      setConversationId(null);
      queryClient.invalidateQueries({ queryKey: ['property-ai-conversation', propertyId] });
      toast.success('Conversation cleared');
    },
  });

  // Auto-scroll
  useEffect(() => {
    const timer = setTimeout(() => { scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight); }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;
    const rawInput = inputValue.trim();
    const isAIQuery = rawInput.toLowerCase().startsWith('@ai ');
    const messageContent = isAIQuery ? rawInput.slice(4).trim() : rawInput;

    if (isAIQuery && !messageContent) { toast.error('Type a question after @ai'); return; }

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: rawInput };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Please log in to use Property AI');
        setMessages(prev => prev.filter(m => m.id !== userMessage.id));
        setIsLoading(false);
        return;
      }

      let currentConversationId = conversationId;
      if (!currentConversationId) {
        const newConv = await createConversation.mutateAsync();
        currentConversationId = newConv.id;
      }

      await saveMessage.mutateAsync({ conversationId: currentConversationId, role: 'user', content: rawInput });

      if (!isAIQuery) { setIsLoading(false); inputRef.current?.focus(); return; }

      // Track usage
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: existingUsage } = await supabase.from('ai_usage').select('id, question_count').eq('user_id', user!.id).eq('month', currentMonth).maybeSingle();
      if (existingUsage) {
        await supabase.from('ai_usage').update({ question_count: existingUsage.question_count + 1, updated_at: new Date().toISOString() }).eq('id', existingUsage.id);
      } else {
        await supabase.from('ai_usage').insert({ user_id: user!.id, month: currentMonth, question_count: 1 });
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/property-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: messageContent }].filter(m => {
            if (m.role === 'user') { const c = m.content.toLowerCase(); return c.startsWith('@ai ') || c.startsWith('[via telegram]'); }
            return m.role === 'assistant';
          }).map(m => ({ role: m.role, content: m.role === 'user' && m.content.toLowerCase().startsWith('@ai ') ? m.content.slice(4).trim() : m.content })),
          propertyId,
          propertyData,
          violationsSummary: {
            total: violations.length,
            open: violations.filter(v => v.status === 'open').length,
            inProgress: violations.filter(v => v.status === 'in_progress').length,
            hasCritical: violations.some(v => v.is_stop_work_order || v.is_vacate_order),
          },
          documentContents: (allDocuments || []).map(d => ({ type: d.document_type, name: d.document_name, content: d.extracted_text || null })),
          workOrdersSummary: { total: workOrders.length, active: workOrders.filter(w => w.status !== 'completed').length },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) { toast.error('Rate limit exceeded.'); setMessages(prev => prev.filter(m => m.id !== userMessage.id)); return; }
        if (response.status === 402) { toast.error('AI credits depleted.'); setMessages(prev => prev.filter(m => m.id !== userMessage.id)); return; }
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');
      const decoder = new TextDecoder();
      let assistantMessage = '';
      const assistantId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      let buffer = '';
      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantMessage += content;
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantMessage } : m));
            }
          } catch { /* skip malformed */ }
        }
      }

      if (assistantMessage && currentConversationId) {
        await saveMessage.mutateAsync({ conversationId: currentConversationId, role: 'assistant', content: assistantMessage });
        await supabase.from('property_ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', currentConversationId);
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
      setMessages(prev => prev.filter(m => m.content !== ''));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [inputValue, isLoading, messages, conversationId, createConversation, saveMessage, propertyId, propertyData, violations, allDocuments, workOrders, user]);

  return {
    messages,
    inputValue,
    setInputValue,
    isLoading,
    sendMessage,
    clearConversation,
    unreadCount,
    setOpen,
    scrollRef,
    inputRef,
    allDocuments,
    conversationId,
  };
}
