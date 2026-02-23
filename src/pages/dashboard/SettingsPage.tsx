import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, User, Bell, Shield, CreditCard, MessageCircle, MessageSquare, FileText, Info } from 'lucide-react';
import EmailPreferencesTab from '@/components/settings/EmailPreferencesTab';
import TelegramTab from '@/components/settings/TelegramTab';
import WhatsAppTab from '@/components/settings/WhatsAppTab';

const SettingsPage = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [profile, setProfile] = useState({
    display_name: '',
    company_name: '',
    phone: '',
    license_id: '',
    po_terms_and_conditions: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        if (data) {
          setProfile({
            display_name: data.display_name || '',
            company_name: data.company_name || '',
            phone: data.phone || '',
            license_id: data.license_id || '',
            po_terms_and_conditions: data.po_terms_and_conditions || '',
          });
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          display_name: profile.display_name || null,
          company_name: profile.company_name || null,
          phone: profile.phone || null,
          license_id: profile.license_id || null,
          po_terms_and_conditions: profile.po_terms_and_conditions || null,
        }, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setIsSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Password reset email sent — check your inbox');
    } catch (error) {
      console.error('Error sending password reset:', error);
      toast.error('Failed to send password reset email');
    } finally {
      setIsSendingReset(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="po-terms" className="gap-2">
              <FileText className="w-4 h-4" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>PO Terms</span>
                </TooltipTrigger>
                <TooltipContent>Your default Purchase Order terms — auto-applied to every PO you generate. You can override them per PO.</TooltipContent>
              </Tooltip>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="w-4 h-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="telegram" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>Telegram</span>
                </TooltipTrigger>
                <TooltipContent>Connect your Telegram account to receive real-time violation alerts via bot message.</TooltipContent>
              </Tooltip>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Billing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal and company details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={user?.email || ''} disabled className="bg-muted" />
                    <p className="text-xs text-muted-foreground">Contact support to change your email</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="display_name">Display Name</Label>
                    <Input
                      id="display_name"
                      placeholder="John Doe"
                      value={profile.display_name}
                      onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Company Name</Label>
                    <Input
                      id="company_name"
                      placeholder="ABC Realty LLC"
                      value={profile.company_name}
                      onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="license_id">License / Expediter ID</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3.5 h-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>Your professional license or expediter ID. Appears on the "Prepared by" line of Due Diligence reports.</TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id="license_id"
                      placeholder="e.g., NYC Expediter #12345"
                      value={profile.license_id}
                      onChange={(e) => setProfile({ ...profile, license_id: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="po-terms">
            <Card>
              <CardHeader>
                <CardTitle>Purchase Order Terms & Conditions</CardTitle>
                <CardDescription>
                  Set your default terms that appear on every purchase order. You can override them per PO when approving a work order.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="po_terms">Default Terms & Conditions</Label>
                  <Textarea
                    id="po_terms"
                    placeholder={`e.g.,\n1. Work must be completed within the agreed timeline.\n2. All materials and labor are included in the agreed amount.\n3. Vendor must carry valid insurance.\n4. Payment will be issued within 7 business days of verified completion.\n5. Any change orders must be approved in writing before work proceeds.`}
                    className="min-h-[200px] font-mono text-sm"
                    value={profile.po_terms_and_conditions}
                    onChange={(e) => setProfile({ ...profile, po_terms_and_conditions: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    These terms will be auto-applied to new purchase orders. You can edit them per PO before generating.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Terms
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <EmailPreferencesTab />
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Manage your account security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div>
                    <p className="font-medium">Change Password</p>
                    <p className="text-sm text-muted-foreground">
                      We'll send a password reset link to <span className="font-medium">{user?.email}</span>
                    </p>
                  </div>
                  <Button variant="outline" onClick={handlePasswordReset} disabled={isSendingReset}>
                    {isSendingReset ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Send Reset Email
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="telegram">
            <TelegramTab />
          </TabsContent>

          <TabsContent value="whatsapp">
            <WhatsAppTab />
          </TabsContent>

          <TabsContent value="billing">
            <Card>
              <CardHeader>
                <CardTitle>Billing & Subscription</CardTitle>
                <CardDescription>Your current plan and billing status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-6 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <p className="font-semibold text-primary">Invite-Only Beta</p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    CitiSignal is currently in invite-only beta. Billing is not yet active — your access is complimentary while we build toward launch.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You'll be notified before any paid plans are introduced.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
};

export default SettingsPage;
