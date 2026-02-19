import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Sparkles } from 'lucide-react';
import { GlobalAIChatSheet } from './GlobalAIChatSheet';

export const GlobalAIChatButton = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Fetch total conversation count for badge
  const { data: conversationCount } = useQuery({
    queryKey: ['global-ai-conversations-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from('property_ai_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user,
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/40 hover:scale-105 transition-all duration-200"
        aria-label="Open CitiSignal AI"
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium hidden sm:inline">CitiSignal AI</span>
        {(conversationCount ?? 0) > 0 && (
          <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground">
            {conversationCount! > 9 ? '9+' : conversationCount}
          </span>
        )}
      </button>
      <GlobalAIChatSheet open={open} onOpenChange={setOpen} />
    </>
  );
};
