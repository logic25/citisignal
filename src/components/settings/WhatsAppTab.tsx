import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, MessageSquare, Link2, Unlink, Copy } from 'lucide-react';

const WhatsAppTab = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [whatsappUser, setWhatsappUser] = useState<any>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);

  useEffect(() => {
    fetchWhatsAppLink();
  }, [user]);

  const fetchWhatsAppLink = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('whatsapp_users' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      setWhatsappUser(data);
    } catch (error) {
      console.error('Error fetching whatsapp link:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getLinkCode = () => {
    if (!user) return '';
    return btoa(user.id);
  };

  const handleCopyCode = () => {
    const code = `LINK ${getLinkCode()}`;
    navigator.clipboard.writeText(code);
    toast.success('Link code copied! Paste it into the WhatsApp chat.');
  };

  const handleUnlink = async () => {
    if (!user) return;
    setIsUnlinking(true);
    try {
      const { error } = await supabase
        .from('whatsapp_users' as any)
        .update({ is_active: false } as any)
        .eq('user_id', user.id);

      if (error) throw error;
      setWhatsappUser(null);
      toast.success('WhatsApp account unlinked');
    } catch (error) {
      console.error('Error unlinking:', error);
      toast.error('Failed to unlink account');
    } finally {
      setIsUnlinking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            WhatsApp Bot
          </CardTitle>
          <CardDescription>
            Connect your WhatsApp to query properties, get violation alerts, and receive compliance updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {whatsappUser ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-primary/5">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">
                      {whatsappUser.display_name || 'WhatsApp User'}
                    </p>
                    <Badge variant="default" className="text-xs">Connected</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    +{whatsappUser.phone_number}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Linked {new Date(whatsappUser.linked_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnlink}
                  disabled={isUnlinking}
                  className="text-destructive hover:text-destructive"
                >
                  {isUnlinking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Unlink className="w-4 h-4 mr-1" />
                      Unlink
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">What you can do:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Ask about violations: <span className="italic">"Violations at 123 Main St"</span></li>
                  <li>• Check compliance: <span className="italic">"Compliance status for all properties"</span></li>
                  <li>• Query hearings: <span className="italic">"Upcoming hearings this week"</span></li>
                  <li>• Quick overview: Send <code className="bg-muted px-1 rounded">STATUS</code></li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-dashed border-border">
                <h4 className="font-medium text-foreground mb-2">Connect Your WhatsApp</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Follow these steps to link your WhatsApp account to CitiSignal:
                </p>

                <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside mb-4">
                  <li>
                    Save our WhatsApp number: <span className="font-mono font-medium text-foreground">+1 (415) 523-8886</span>
                    <p className="ml-5 text-xs text-muted-foreground mt-0.5">(Twilio WhatsApp Sandbox)</p>
                  </li>
                  <li>
                    Send <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">join &lt;sandbox-keyword&gt;</code> to join the sandbox
                    <p className="ml-5 text-xs text-muted-foreground mt-0.5">You'll get the keyword from your admin</p>
                  </li>
                  <li>
                    Copy and send the link code below in the WhatsApp chat:
                  </li>
                </ol>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleCopyCode}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link Code
                  </Button>
                </div>

                <div className="mt-3 p-2 rounded bg-muted/50 border border-border">
                  <input
                    type="text"
                    readOnly
                    value={`LINK ${getLinkCode()}`}
                    className="w-full text-xs font-mono text-muted-foreground bg-transparent border-none outline-none select-all cursor-text"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppTab;
