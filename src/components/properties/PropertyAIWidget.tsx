import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Sparkles, Send, Bot, User, Loader2, FileText, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { usePropertyAIChat } from '@/hooks/usePropertyAIChat';

interface PropertyData {
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
}

interface Violation {
  id: string;
  status: string;
  oath_status?: string | null;
  cure_due_date: string | null;
  hearing_date: string | null;
  is_stop_work_order: boolean;
  is_vacate_order: boolean;
}

interface Document {
  id: string;
  document_type: string;
  document_name?: string;
}

interface WorkOrder {
  id: string;
  status: string;
}

interface PropertyAIWidgetProps {
  propertyId: string;
  propertyData: PropertyData;
  violations: Violation[];
  documents: Document[];
  workOrders: WorkOrder[];
}

export const PropertyAIWidget = ({ 
  propertyId, 
  propertyData, 
  violations, 
  documents, 
  workOrders 
}: PropertyAIWidgetProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const chat = usePropertyAIChat({ propertyId, propertyData, violations, workOrders });

  const handleDialogOpen = (open: boolean) => {
    setIsDialogOpen(open);
    chat.setOpen(open);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chat.sendMessage();
    }
  };

  const suggestedQuestions = [
    "@ai What are the open violations?",
    "@ai What's the zoning for this property?",
    "@ai Any upcoming deadlines?",
    "@ai Who's responsible for repairs?",
  ];

  const hasDocuments = (chat.allDocuments || documents).length > 0;

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleDialogOpen}>
      <DialogTrigger asChild>
        <button
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/40 hover:scale-105 transition-all duration-200 group"
          aria-label="Open Property AI"
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Property AI</span>
          {chat.unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground animate-pulse">
              {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[80vh] p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Property AI</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col h-full bg-card rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border bg-secondary/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Property AI</span>
              <span className="text-xs text-muted-foreground">• {propertyData.address}</span>
            </div>
            <div className="flex items-center gap-1">
              {hasDocuments && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 mr-2">
                  <FileText className="w-3 h-3" />
                  {(chat.allDocuments || documents).length} docs
                </span>
              )}
              {chat.messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => chat.clearConversation.mutate()}
                  disabled={chat.clearConversation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4" ref={chat.scrollRef}>
            {chat.messages.length === 0 ? (
              <div className="text-center py-8">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="font-medium text-foreground mb-2">Ask about this property</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Get answers about violations, deadlines, documents, zoning, and more.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestedQuestions.map((q, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        chat.setInputValue(q);
                        chat.inputRef.current?.focus();
                      }}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {chat.messages.map((message) => {
                  const isTelegram = message.content.startsWith('[via Telegram]');
                  const isAI = message.role === 'user' && message.content.toLowerCase().startsWith('@ai ');
                  const displayContent = isTelegram 
                    ? message.content.replace('[via Telegram] ', '') 
                    : isAI 
                      ? message.content.slice(4).trim() 
                      : message.content;
                  return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-none'
                          : 'bg-secondary text-secondary-foreground rounded-tl-none'
                      }`}
                    >
                      {isTelegram && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 mb-1">
                          📱 Telegram
                        </span>
                      )}
                      {isAI && message.role === 'user' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/20 text-primary-foreground mb-1">
                          ✨ AI Question
                        </span>
                      )}
                      {message.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{displayContent || '...'}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm">{displayContent}</p>
                      )}
                    </div>
                    {message.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  );
                })}
                {chat.isLoading && chat.messages[chat.messages.length - 1]?.role === 'user' && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl bg-secondary rounded-tl-none">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                ref={chat.inputRef}
                value={chat.inputValue}
                onChange={(e) => chat.setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message, or @ai to ask AI..."
                disabled={chat.isLoading}
                className="flex-1"
              />
              <Button onClick={chat.sendMessage} disabled={!chat.inputValue.trim() || chat.isLoading} size="icon">
                {chat.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Start with <span className="font-semibold text-primary">@ai</span> to ask AI. Plain messages are saved as notes.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
