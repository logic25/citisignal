import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Mail, Send, Eye, MessageCircle, Bell } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface EmailPreferences {
  digest_frequency: string;
  digest_day: string;
  notify_new_violations: boolean;
  notify_status_changes: boolean;
  notify_expirations: boolean;
  notify_new_applications: boolean;
  telegram_new_violations: boolean;
  telegram_status_changes: boolean;
  telegram_new_applications: boolean;
  telegram_expirations: boolean;
  telegram_daily_summary: boolean;
  telegram_critical_alerts: boolean;
  reminder_days: number[];
}

const defaultPrefs: EmailPreferences = {
  digest_frequency: 'none',
  digest_day: 'monday',
  notify_new_violations: true,
  notify_status_changes: true,
  notify_expirations: true,
  notify_new_applications: true,
  telegram_new_violations: false,
  telegram_status_changes: false,
  telegram_new_applications: false,
  telegram_expirations: false,
  telegram_daily_summary: false,
  telegram_critical_alerts: true,
  reminder_days: [30, 14, 7, 3, 1],
};

const AVAILABLE_REMINDER_DAYS = [
  { value: 60, label: '60 days' },
  { value: 30, label: '30 days' },
  { value: 14, label: '14 days' },
  { value: 7, label: '7 days' },
  { value: 3, label: '3 days' },
  { value: 1, label: '1 day' },
];

const EmailPreferencesTab = () => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<EmailPreferences>(defaultPrefs);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [hasTelegram, setHasTelegram] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const [prefsRes, telegramRes] = await Promise.all([
          supabase.from('email_preferences').select('*').eq('user_id', user.id).single(),
          supabase.from('telegram_users' as any).select('is_active').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
        ]);

        if (prefsRes.data) {
          const d = prefsRes.data as any;
          setPrefs({
            digest_frequency: d.digest_frequency || 'none',
            digest_day: d.digest_day || 'monday',
            notify_new_violations: d.notify_new_violations ?? true,
            notify_status_changes: d.notify_status_changes ?? true,
            notify_expirations: d.notify_expirations ?? true,
            notify_new_applications: d.notify_new_applications ?? true,
            telegram_new_violations: d.telegram_new_violations ?? false,
            telegram_status_changes: d.telegram_status_changes ?? false,
            telegram_new_applications: d.telegram_new_applications ?? false,
            telegram_expirations: d.telegram_expirations ?? false,
            telegram_daily_summary: d.telegram_daily_summary ?? false,
            telegram_critical_alerts: d.telegram_critical_alerts ?? true,
            reminder_days: d.reminder_days ?? [30, 14, 7, 3, 1],
          });
        }
        setHasTelegram(!!telegramRes.data);
      } catch (err) {
        console.error('Error fetching prefs:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('email_preferences')
        .upsert({
          user_id: user.id,
          email: user.email,
          ...prefs,
        } as any, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Notification preferences saved');
    } catch (err) {
      console.error('Error saving prefs:', err);
      toast.error('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!user) return;
    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email-digest', {
        body: { user_id: user.id, test_mode: true },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Test digest sent to your email!');
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Error sending test:', err);
      toast.error(`Failed to send test: ${err.message}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  const handlePreview = async () => {
    if (!user) return;
    setIsLoadingPreview(true);
    setShowPreview(true);
    try {
      const response = await supabase.functions.invoke('send-email-digest', {
        body: { user_id: user.id, preview_only: true },
      });
      if (response.error) throw response.error;
      const html = typeof response.data === 'string' ? response.data : response.data?.toString() || '<p>Unable to generate preview</p>';
      setPreviewHtml(html);
    } catch (err: any) {
      console.error('Error loading preview:', err);
      setPreviewHtml(`<div style="padding:40px;text-align:center;color:#ef4444;">Error loading preview: ${err.message}</div>`);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const digestEnabled = prefs.digest_frequency !== 'none';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const ALERT_TYPES = [
    { emailKey: 'notify_new_violations' as const, telegramKey: 'telegram_new_violations' as const, label: 'New Violations', desc: 'Newly issued violations from any agency' },
    { emailKey: 'notify_status_changes' as const, telegramKey: 'telegram_status_changes' as const, label: 'Status Changes', desc: 'Violations or applications that changed status' },
    { emailKey: 'notify_new_applications' as const, telegramKey: 'telegram_new_applications' as const, label: 'New Applications', desc: 'DOB/FDNY/HPD application filings' },
    { emailKey: 'notify_expirations' as const, telegramKey: 'telegram_expirations' as const, label: 'Expiring Insurance & Docs', desc: 'Insurance policies and documents expiring soon' },
  ];

  return (
    <>
      <div className="space-y-6">
        {/* Digest Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Weekly Email Digest
            </CardTitle>
            <CardDescription>
              Receive a beautiful summary of all compliance activity across your properties
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="font-medium">Enable Weekly Digest</p>
                <p className="text-sm text-muted-foreground">
                  Get a compliance summary delivered to {user?.email}
                </p>
              </div>
              <Switch
                checked={digestEnabled}
                onCheckedChange={(checked) =>
                  setPrefs({ ...prefs, digest_frequency: checked ? 'weekly' : 'none' })
                }
              />
            </div>

            {digestEnabled && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select value={prefs.digest_frequency} onValueChange={(v) => setPrefs({ ...prefs, digest_frequency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {prefs.digest_frequency === 'weekly' && (
                    <div className="space-y-2">
                      <Label>Send On</Label>
                      <Select value={prefs.digest_day} onValueChange={(v) => setPrefs({ ...prefs, digest_day: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(d => (
                            <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save Preferences
              </Button>
              <Button variant="outline" onClick={handlePreview}>
                <Eye className="w-4 h-4 mr-2" />
                Preview Email
              </Button>
              <Button variant="outline" onClick={handleSendTest} disabled={isSendingTest}>
                {isSendingTest ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Send Test Email
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notification Channel Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Alert Channels</CardTitle>
            <CardDescription>
              Choose how you receive each type of alert — via email, Telegram, or both.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Header row */}
            <div className="grid grid-cols-[1fr,80px,100px] gap-2 mb-3 px-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alert Type</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">
                <Mail className="w-3.5 h-3.5 inline mr-1" />Email
              </span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">
                <MessageCircle className="w-3.5 h-3.5 inline mr-1" />Telegram
              </span>
            </div>

            <div className="space-y-2">
              {ALERT_TYPES.map(({ emailKey, telegramKey, label, desc }) => (
                <div key={emailKey} className="grid grid-cols-[1fr,80px,100px] gap-2 items-center p-3 rounded-lg border border-border">
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <div className="flex justify-center">
                    <Checkbox
                      checked={prefs[emailKey]}
                      onCheckedChange={(checked) => setPrefs({ ...prefs, [emailKey]: !!checked })}
                    />
                  </div>
                  <div className="flex justify-center">
                    {hasTelegram ? (
                      <Checkbox
                        checked={prefs[telegramKey]}
                        onCheckedChange={(checked) => setPrefs({ ...prefs, [telegramKey]: !!checked })}
                      />
                    ) : (
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">Link first</span>
                    )}
                  </div>
                </div>
              ))}

              {/* Telegram-only: Daily Summary */}
              <div className="grid grid-cols-[1fr,80px,100px] gap-2 items-center p-3 rounded-lg border border-border">
                <div>
                  <p className="font-medium text-sm">Daily Change Summary</p>
                  <p className="text-xs text-muted-foreground">Telegram ping when daily sync detects changes</p>
                </div>
                <div className="flex justify-center">
                  <span className="text-[10px] text-muted-foreground">—</span>
                </div>
                <div className="flex justify-center">
                  {hasTelegram ? (
                    <Checkbox
                      checked={prefs.telegram_daily_summary}
                      onCheckedChange={(checked) => setPrefs({ ...prefs, telegram_daily_summary: !!checked })}
                    />
                  ) : (
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">Link first</span>
                  )}
                </div>
              </div>

              {/* Critical Alerts */}
              <div className="grid grid-cols-[1fr,80px,100px] gap-2 items-center p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                <div>
                  <p className="font-medium text-sm text-destructive">Critical Alerts (SWO / Vacate)</p>
                  <p className="text-xs text-muted-foreground">Immediate push for stop work and vacate orders</p>
                </div>
                <div className="flex justify-center">
                  <Checkbox checked disabled className="opacity-60" />
                </div>
                <div className="flex justify-center">
                  {hasTelegram ? (
                    <Checkbox
                      checked={prefs.telegram_critical_alerts}
                      onCheckedChange={(checked) => setPrefs({ ...prefs, telegram_critical_alerts: !!checked })}
                    />
                  ) : (
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">Link first</span>
                  )}
                </div>
              </div>
            </div>

            {!hasTelegram && (
              <p className="text-xs text-muted-foreground mt-4 p-3 rounded-lg bg-muted/50">
                💡 To enable Telegram alerts, link your Telegram account in the Telegram tab first.
              </p>
            )}

            <div className="mt-4 pt-4 border-t border-border">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save Preferences
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reminder Intervals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Expiration Reminder Schedule
            </CardTitle>
            <CardDescription>
              Choose when to be reminded before COI, insurance, document, and tax exemption expirations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {AVAILABLE_REMINDER_DAYS.map(({ value, label }) => {
                const isSelected = prefs.reminder_days.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      const next = isSelected
                        ? prefs.reminder_days.filter(d => d !== value)
                        : [...prefs.reminder_days, value].sort((a, b) => b - a);
                      setPrefs({ ...prefs, reminder_days: next });
                    }}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {prefs.reminder_days.length === 0 && (
              <p className="text-xs text-destructive mt-2">⚠️ No reminder intervals selected — you won't receive expiration reminders.</p>
            )}
            <div className="mt-4 pt-4 border-t border-border">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save Preferences
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Digest Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-lg border border-border bg-muted/30">
            {isLoadingPreview ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[600px] border-0"
                title="Email Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmailPreferencesTab;
