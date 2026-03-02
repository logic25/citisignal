/**
 * WhatsAppTab — Settings tab for WhatsApp bot integration
 * 
 * STATUS: DISABLED (2026-03-02)
 * 
 * This component allows users to link/unlink their WhatsApp account
 * to the CitiSignal bot for property queries and violation alerts.
 * 
 * The WhatsApp integration (and underlying Twilio webhook) is currently
 * disabled. This tab shows a "coming soon" placeholder instead.
 * 
 * TO RE-ENABLE:
 * 1. Re-enable the whatsapp-webhook edge function
 * 2. Restore the full UI below (see git history)
 * 3. Re-add the "whatsapp" tab trigger in SettingsPage.tsx
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

const WhatsAppTab = () => {
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
        <CardContent>
          <div className="p-6 rounded-lg border border-dashed border-border text-center space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="font-medium text-foreground">Coming Soon</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              WhatsApp integration is temporarily paused while we finalize the messaging infrastructure. 
              Use Telegram for bot-based property queries in the meantime.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppTab;
