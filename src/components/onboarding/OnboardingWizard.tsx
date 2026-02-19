import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SmartAddressAutocomplete } from '@/components/properties/SmartAddressAutocomplete';
import { determineApplicableAgencies } from '@/lib/property-utils';
import { toast } from 'sonner';
import {
  Building2,
  User,
  MessageCircle,
  Rocket,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  ExternalLink,
  SkipForward,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingWizardProps {
  onComplete: () => void;
}

const STEPS = [
  { id: 'welcome', label: 'Welcome', icon: Zap },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'property', label: 'Property', icon: Building2 },
  { id: 'telegram', label: 'Telegram', icon: MessageCircle },
  { id: 'done', label: 'All Set', icon: Rocket },
];

const OnboardingWizard = ({ onComplete }: OnboardingWizardProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Profile state
  const [companyName, setCompanyName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');

  // Property state
  const [address, setAddress] = useState('');
  const [bin, setBin] = useState('');
  const [bbl, setBbl] = useState('');
  const [borough, setBorough] = useState('');
  const [stories, setStories] = useState('');
  const [primaryUseGroup, setPrimaryUseGroup] = useState('');
  const [dwellingUnits, setDwellingUnits] = useState('');
  const [propertyAdded, setPropertyAdded] = useState(false);

  // Telegram state
  const [telegramLinked, setTelegramLinked] = useState(false);

  const botUsername = 'CitiSignalBot';

  useEffect(() => {
    checkTelegramLink();
  }, [step]);

  const checkTelegramLink = async () => {
    if (!user || step !== 3) return;
    const { data } = await supabase
      .from('telegram_users' as any)
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    setTelegramLinked(!!data);
  };

  const getTelegramLink = () => {
    if (!user) return '';
    return `https://t.me/${botUsername}?start=${btoa(user.id)}`;
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').upsert({
        user_id: user.id,
        company_name: companyName || null,
        display_name: displayName || null,
        phone: phone || null,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      setStep(2);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAddressSelect = (result: any) => {
    setAddress(result.address);
    setBin(result.bin || '');
    setBbl(result.bbl || '');
    setBorough(result.borough || '');
    setStories(result.stories?.toString() || '');
    setPrimaryUseGroup(result.primaryUseGroup || '');
    setDwellingUnits(result.dwellingUnits?.toString() || '');
  };

  const handleAddProperty = async () => {
    if (!user || !address) return;
    setSaving(true);
    try {
      const agencies = determineApplicableAgencies(primaryUseGroup, dwellingUnits ? parseInt(dwellingUnits) : null);
      const { error } = await supabase.from('properties').insert({
        user_id: user.id,
        address,
        bin: bin || null,
        bbl: bbl || null,
        borough: borough || null,
        stories: stories ? parseInt(stories) : null,
        primary_use_group: primaryUseGroup || null,
        dwelling_units: dwellingUnits ? parseInt(dwellingUnits) : null,
        applicable_agencies: agencies,
      });
      if (error) throw error;
      setPropertyAdded(true);
      toast.success('Property added!');
    } catch (e) {
      console.error(e);
      toast.error('Failed to add property');
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.from('profiles').upsert({
        user_id: user.id,
        has_completed_onboarding: true,
      }, { onConflict: 'user_id' });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
      onComplete();
    }
  };

  const currentStep = STEPS[step];

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Progress bar */}
      <div className="w-full bg-muted h-1">
        <div
          className="h-full bg-accent transition-all duration-500"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 py-6 px-4">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isDone = i < step;
          const isCurrent = i === step;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300',
                  isDone && 'bg-accent text-accent-foreground',
                  isCurrent && 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background',
                  !isDone && !isCurrent && 'bg-muted text-muted-foreground'
                )}
              >
                {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('w-8 h-0.5 rounded-full hidden sm:block', i < step ? 'bg-accent' : 'bg-muted')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-center justify-center px-4 overflow-auto">
        <div className="w-full max-w-lg animate-fade-in">
          {/* Welcome */}
          {step === 0 && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 mx-auto rounded-2xl gradient-hero flex items-center justify-center shadow-xl">
                <Zap className="w-10 h-10 text-primary-foreground" />
              </div>
              <div className="space-y-3">
                <h1 className="font-display text-4xl font-bold text-foreground">
                  Welcome to CitiSignal
                </h1>
                <p className="text-lg text-muted-foreground max-w-md mx-auto">
                  Your building intelligence platform. Monitor violations, track compliance, and manage your NYC properties — all in one place.
                </p>
              </div>
              <Button size="xl" variant="hero" onClick={() => setStep(1)} className="mt-4">
                Get Started <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
            </div>
          )}

          {/* Profile */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="font-display text-2xl font-bold text-foreground">Set Up Your Profile</h2>
                <p className="text-muted-foreground">Tell us a bit about yourself and your company.</p>
              </div>
              <div className="space-y-4 bg-card rounded-xl border border-border p-6 shadow-card">
                <div className="space-y-2">
                  <Label>Your Name</Label>
                  <Input placeholder="Jane Smith" value={displayName} onChange={e => setDisplayName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input placeholder="ABC Realty LLC" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input type="tel" placeholder="+1 (555) 123-4567" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(0)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <SkipForward className="w-4 h-4 mr-1" /> Skip
                  </Button>
                  <Button onClick={handleSaveProfile} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save & Continue <ArrowRight className="w-4 h-4 ml-1" /></>}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Add Property */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="font-display text-2xl font-bold text-foreground">Add Your First Property</h2>
                <p className="text-muted-foreground">Start typing an NYC address — we'll auto-populate building data from DOB.</p>
              </div>
              {!propertyAdded ? (
                <div className="space-y-4 bg-card rounded-xl border border-border p-6 shadow-card">
                  <div className="space-y-2">
                    <Label>NYC Address</Label>
                    <SmartAddressAutocomplete
                      value={address}
                      onChange={setAddress}
                      onSelect={handleAddressSelect}
                      placeholder="Start typing a NYC address..."
                    />
                  </div>
                  {bin && (
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>BIN: <strong className="text-foreground">{bin}</strong></span>
                      {stories && <span>Stories: <strong className="text-foreground">{stories}</strong></span>}
                      {dwellingUnits && <span>Units: <strong className="text-foreground">{dwellingUnits}</strong></span>}
                    </div>
                  )}
                  <Button onClick={handleAddProperty} disabled={saving || !address} className="w-full">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>
                      <Building2 className="w-4 h-4 mr-1" /> Add Property
                    </>}
                  </Button>
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-success/30 p-6 shadow-card text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-success/10 flex items-center justify-center">
                    <Check className="w-6 h-6 text-success" />
                  </div>
                  <p className="font-medium text-foreground">{address}</p>
                  <p className="text-sm text-muted-foreground">Property added! Violations will be synced automatically.</p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <div className="flex gap-2">
                  {!propertyAdded && (
                    <Button variant="outline" onClick={() => setStep(3)}>
                      <SkipForward className="w-4 h-4 mr-1" /> Skip
                    </Button>
                  )}
                  {propertyAdded && (
                    <Button onClick={() => setStep(3)}>
                      Continue <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Telegram */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="font-display text-2xl font-bold text-foreground">Connect Telegram</h2>
                <p className="text-muted-foreground">Get instant alerts and query your properties on the go.</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-5">
                {telegramLinked ? (
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-full bg-success/10 flex items-center justify-center">
                      <Check className="w-6 h-6 text-success" />
                    </div>
                    <p className="font-medium text-foreground">Telegram Connected!</p>
                    <p className="text-sm text-muted-foreground">You'll receive alerts and can query your data via @{botUsername}.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-[#229ED9]/10 flex items-center justify-center">
                        <MessageCircle className="w-7 h-7 text-[#229ED9]" />
                      </div>
                      <ol className="text-sm text-muted-foreground space-y-2 text-left w-full">
                        <li className="flex items-start gap-2">
                          <span className="w-6 h-6 rounded-full bg-muted text-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                          Click "Open in Telegram" below
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-6 h-6 rounded-full bg-muted text-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                          Press "Start" in the bot chat
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-6 h-6 rounded-full bg-muted text-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                          You're linked! Come back here to continue.
                        </li>
                      </ol>
                    </div>
                    <Button asChild className="w-full" size="lg">
                      <a href={getTelegramLink()} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Open in Telegram
                        <ExternalLink className="w-3 h-3 ml-2" />
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" className="w-full" onClick={checkTelegramLink}>
                      I've linked — check now
                    </Button>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <div className="flex gap-2">
                  <Button variant={telegramLinked ? 'default' : 'outline'} onClick={() => setStep(4)}>
                    {telegramLinked ? <>Continue <ArrowRight className="w-4 h-4 ml-1" /></> : <><SkipForward className="w-4 h-4 mr-1" /> Skip</>}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* All Set */}
          {step === 4 && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-success/10 flex items-center justify-center">
                <Rocket className="w-10 h-10 text-success" />
              </div>
              <div className="space-y-3">
                <h1 className="font-display text-3xl font-bold text-foreground">You're All Set!</h1>
                <p className="text-lg text-muted-foreground max-w-md mx-auto">
                  Your CitiSignal account is ready. Violations sync automatically — we'll notify you when anything needs attention.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <Button size="xl" variant="hero" onClick={handleFinish} disabled={saving}>
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Go to Dashboard <ArrowRight className="w-5 h-5 ml-1" /></>}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
