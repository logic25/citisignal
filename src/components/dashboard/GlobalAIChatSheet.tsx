import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  ArrowLeft,
  Plus,
  MessageCircle,
  Send,
  Bot,
  User,
  Loader2,
  Trash2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { usePropertyAIChat } from '@/hooks/usePropertyAIChat';
import { formatDistanceToNow } from 'date-fns';

interface ConversationWithProperty {
  id: string;
  property_id: string;
  updated_at: string;
  address: string;
  last_message?: string;
}

interface GlobalAIChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Inner chat component that uses the shared hook
const ChatView = ({
  propertyId,
  propertyData,
  onBack,
}: {
  propertyId: string;
  propertyData: { address: string; borough?: string | null; bin?: string | null; bbl?: string | null; stories?: number | null; dwelling_units?: number | null; year_built?: number | null; zoning_district?: string | null; building_class?: string | null; co_status?: string | null };
  onBack: () => void;
}) => {
  // Fetch violations and work orders for this property
  const { data: violations = [] } = useQuery({
    queryKey: ['property-violations-chat', propertyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('violations')
        .select('id, status, oath_status, cure_due_date, hearing_date, is_stop_work_order, is_vacate_order')
        .eq('property_id', propertyId);
      return (data || []).map(v => ({
        ...v,
        is_stop_work_order: v.is_stop_work_order ?? false,
        is_vacate_order: v.is_vacate_order ?? false,
      }));
    },
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ['property-work-orders-chat', propertyId],
    queryFn: async () => {
      const { data } = await supabase.from('work_orders').select('id, status').eq('property_id', propertyId);
      return data || [];
    },
  });

  const chat = usePropertyAIChat({ propertyId, propertyData, violations, workOrders });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{propertyData.address}</p>
        </div>
        {chat.messages.length > 0 && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => chat.clearConversation.mutate()}>
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" ref={chat.scrollRef}>
        {chat.messages.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Ask about this property</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {['@ai What are the open violations?', '@ai Any upcoming deadlines?'].map((q, i) => (
                <Button key={i} variant="outline" size="sm" className="text-xs" onClick={() => { chat.setInputValue(q); chat.inputRef.current?.focus(); }}>
                  {q}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {chat.messages.map((msg) => {
              const isTelegram = msg.content.startsWith('[via Telegram]');
              const isAI = msg.role === 'user' && msg.content.toLowerCase().startsWith('@ai ');
              const displayContent = isTelegram ? msg.content.replace('[via Telegram] ', '') : isAI ? msg.content.slice(4).trim() : msg.content;
              return (
                <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-secondary text-secondary-foreground rounded-tl-none'}`}>
                    {isTelegram && <span className="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 mb-1">📱 Telegram</span>}
                    {isAI && msg.role === 'user' && <span className="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/20 text-primary-foreground mb-1">✨ AI</span>}
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{displayContent || '...'}</ReactMarkdown></div>
                    ) : (
                      <p>{displayContent}</p>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
            {chat.isLoading && chat.messages[chat.messages.length - 1]?.role === 'user' && (
              <div className="flex gap-2 justify-start">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Bot className="w-3.5 h-3.5 text-primary" /></div>
                <div className="px-3 py-2 rounded-2xl bg-secondary rounded-tl-none"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <Input
            ref={chat.inputRef}
            value={chat.inputValue}
            onChange={(e) => chat.setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chat.sendMessage(); } }}
            placeholder="@ai to ask AI, or type a note..."
            disabled={chat.isLoading}
            className="flex-1 text-sm"
          />
          <Button onClick={chat.sendMessage} disabled={!chat.inputValue.trim() || chat.isLoading} size="icon">
            {chat.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export const GlobalAIChatSheet = ({ open, onOpenChange }: GlobalAIChatSheetProps) => {
  const { user } = useAuth();
  const [selectedProperty, setSelectedProperty] = useState<{ id: string; address: string; data: any } | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);

  // Fetch all conversations with property addresses and last message
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['global-ai-conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: convs, error } = await supabase
        .from('property_ai_conversations')
        .select('id, property_id, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (error || !convs) return [];

      const propertyIds = [...new Set(convs.map(c => c.property_id))];
      const { data: properties } = await supabase.from('properties').select('id, address').in('id', propertyIds);
      const propMap = new Map((properties || []).map(p => [p.id, p.address]));

      // Get last message for each conversation
      const result: ConversationWithProperty[] = [];
      for (const conv of convs) {
        const { data: lastMsg } = await supabase
          .from('property_ai_messages')
          .select('content')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        result.push({
          id: conv.id,
          property_id: conv.property_id,
          updated_at: conv.updated_at,
          address: propMap.get(conv.property_id) || 'Unknown Property',
          last_message: lastMsg?.content,
        });
      }
      return result;
    },
    enabled: !!user && open,
  });

  // Fetch all properties for "New Chat" selector
  const { data: allProperties = [] } = useQuery({
    queryKey: ['all-properties-for-chat', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('properties')
        .select('id, address, borough, bin, bbl, stories, dwelling_units, year_built, zoning_district, building_class, co_status')
        .eq('user_id', user.id)
        .order('address');
      return data || [];
    },
    enabled: !!user && open,
  });

  const handleSelectConversation = (conv: ConversationWithProperty) => {
    const prop = allProperties.find(p => p.id === conv.property_id);
    setSelectedProperty({
      id: conv.property_id,
      address: conv.address,
      data: prop || { address: conv.address },
    });
  };

  const handleNewChat = (propertyId: string) => {
    const prop = allProperties.find(p => p.id === propertyId);
    if (prop) {
      setSelectedProperty({ id: prop.id, address: prop.address, data: prop });
      setShowNewChat(false);
    }
  };

  const handleBack = () => {
    setSelectedProperty(null);
    setShowNewChat(false);
  };

  const handleOpenChange = (val: boolean) => {
    onOpenChange(val);
    if (!val) {
      setSelectedProperty(null);
      setShowNewChat(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="p-0 w-[400px] sm:max-w-[400px] flex flex-col">
        <SheetHeader className="sr-only">
          <SheetTitle>AI Assistant</SheetTitle>
        </SheetHeader>

        {selectedProperty ? (
          <ChatView
            propertyId={selectedProperty.id}
            propertyData={selectedProperty.data}
            onBack={handleBack}
          />
        ) : (
          <div className="flex flex-col h-full">
            {/* List Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">AI Assistant</span>
              </div>
              <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => setShowNewChat(!showNewChat)}>
                <Plus className="w-4 h-4" />
                <span className="text-xs">New</span>
              </Button>
            </div>

            {/* New chat property selector */}
            {showNewChat && (
              <div className="px-4 py-3 border-b border-border">
                <Select onValueChange={handleNewChat}>
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Select a property..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allProperties.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Conversation List */}
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <MessageCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No conversations yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Click "+ New" to start chatting about a property</p>
                </div>
              ) : (
                <div>
                  {conversations.map((conv, i) => (
                    <div key={conv.id}>
                      <button
                        onClick={() => handleSelectConversation(conv)}
                        className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors"
                      >
                        <p className="text-sm font-medium text-foreground truncate">{conv.address}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {conv.last_message
                            ? conv.last_message.length > 80
                              ? conv.last_message.slice(0, 80) + '…'
                              : conv.last_message
                            : 'No messages yet'}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
                        </p>
                      </button>
                      {i < conversations.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
