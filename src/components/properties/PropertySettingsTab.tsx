import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Phone, 
  Bell, 
  Users, 
  UserPlus, 
  Loader2, 
  Mail,
  Trash2,
  Check,
  Clock,
  AlertTriangle,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';

interface PropertyMember {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_at: string;
  accepted_at: string | null;
}

interface PropertySettingsTabProps {
  propertyId: string;
  ownerName: string | null;
  ownerPhone: string | null;
  smsEnabled: boolean | null;
  hasGas: boolean | null;
  hasBoiler: boolean | null;
  hasElevator: boolean | null;
  hasSprinkler: boolean | null;
  hasRetainingWall?: boolean | null;
  hasParkingStructure?: boolean | null;
  hasCoolingTower?: boolean | null;
  hasWaterTank?: boolean | null;
  hasFireAlarm?: boolean | null;
  hasStandpipe?: boolean | null;
  hasPlaceOfAssembly?: boolean | null;
  isFoodEstablishment?: boolean | null;
  hasBackflowDevice?: boolean | null;
  burnsNo4Oil?: boolean | null;
  onUpdate: () => void;
}

export const PropertySettingsTab = ({
  propertyId,
  ownerName,
  ownerPhone,
  smsEnabled,
  hasGas,
  hasBoiler,
  hasElevator,
  hasSprinkler,
  hasRetainingWall,
  hasParkingStructure,
  hasCoolingTower,
  hasWaterTank,
  hasFireAlarm,
  hasStandpipe,
  hasPlaceOfAssembly,
  isFoodEstablishment,
  hasBackflowDevice,
  burnsNo4Oil,
  onUpdate,
}: PropertySettingsTabProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [members, setMembers] = useState<PropertyMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);

  // Form state — original
  const [formOwnerName, setFormOwnerName] = useState(ownerName || '');
  const [formOwnerPhone, setFormOwnerPhone] = useState(ownerPhone || '');
  const [formSmsEnabled, setFormSmsEnabled] = useState(smsEnabled || false);

  // Form state — building features
  const [formHasGas, setFormHasGas] = useState(hasGas || false);
  const [formHasBoiler, setFormHasBoiler] = useState(hasBoiler || false);
  const [formHasElevator, setFormHasElevator] = useState(hasElevator || false);
  const [formHasSprinkler, setFormHasSprinkler] = useState(hasSprinkler || false);
  const [formHasRetainingWall, setFormHasRetainingWall] = useState(hasRetainingWall || false);
  const [formHasParkingStructure, setFormHasParkingStructure] = useState(hasParkingStructure || false);
  const [formHasCoolingTower, setFormHasCoolingTower] = useState(hasCoolingTower || false);
  const [formHasWaterTank, setFormHasWaterTank] = useState(hasWaterTank || false);
  const [formHasFireAlarm, setFormHasFireAlarm] = useState(hasFireAlarm || false);
  const [formHasStandpipe, setFormHasStandpipe] = useState(hasStandpipe || false);
  const [formHasPlaceOfAssembly, setFormHasPlaceOfAssembly] = useState(hasPlaceOfAssembly || false);
  const [formIsFoodEstablishment, setFormIsFoodEstablishment] = useState(isFoodEstablishment || false);
  const [formHasBackflowDevice, setFormHasBackflowDevice] = useState(hasBackflowDevice || false);
  const [formBurnsNo4Oil, setFormBurnsNo4Oil] = useState(burnsNo4Oil || false);
  const [savingFeatures, setSavingFeatures] = useState(false);

  useEffect(() => { fetchMembers(); }, [propertyId]);

  useEffect(() => {
    setFormOwnerName(ownerName || '');
    setFormOwnerPhone(ownerPhone || '');
    setFormSmsEnabled(smsEnabled || false);
    setFormHasGas(hasGas || false);
    setFormHasBoiler(hasBoiler || false);
    setFormHasElevator(hasElevator || false);
    setFormHasSprinkler(hasSprinkler || false);
    setFormHasRetainingWall(hasRetainingWall || false);
    setFormHasParkingStructure(hasParkingStructure || false);
    setFormHasCoolingTower(hasCoolingTower || false);
    setFormHasWaterTank(hasWaterTank || false);
    setFormHasFireAlarm(hasFireAlarm || false);
    setFormHasStandpipe(hasStandpipe || false);
    setFormHasPlaceOfAssembly(hasPlaceOfAssembly || false);
    setFormIsFoodEstablishment(isFoodEstablishment || false);
    setFormHasBackflowDevice(hasBackflowDevice || false);
    setFormBurnsNo4Oil(burnsNo4Oil || false);
  }, [ownerName, ownerPhone, smsEnabled, hasGas, hasBoiler, hasElevator, hasSprinkler,
      hasRetainingWall, hasParkingStructure, hasCoolingTower, hasWaterTank, hasFireAlarm,
      hasStandpipe, hasPlaceOfAssembly, isFoodEstablishment, hasBackflowDevice, burnsNo4Oil]);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('property_members')
        .select('*')
        .eq('property_id', propertyId)
        .neq('status', 'removed')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSaveOwnerSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('properties')
        .update({
          owner_name: formOwnerName || null,
          owner_phone: formOwnerPhone || null,
          sms_enabled: formSmsEnabled,
        })
        .eq('id', propertyId);
      if (error) throw error;
      toast.success('Settings saved');
      onUpdate();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBuildingFeatures = async () => {
    setSavingFeatures(true);
    try {
      const { error } = await supabase
        .from('properties')
        .update({
          has_gas: formHasGas,
          has_boiler: formHasBoiler,
          has_elevator: formHasElevator,
          has_sprinkler: formHasSprinkler,
          has_retaining_wall: formHasRetainingWall,
          has_parking_structure: formHasParkingStructure,
          has_cooling_tower: formHasCoolingTower,
          has_water_tank: formHasWaterTank,
          has_fire_alarm: formHasFireAlarm,
          has_standpipe: formHasStandpipe,
          has_place_of_assembly: formHasPlaceOfAssembly,
          is_food_establishment: formIsFoodEstablishment,
          has_backflow_device: formHasBackflowDevice,
          burns_no4_oil: formBurnsNo4Oil,
        } as any)
        .eq('id', propertyId);
      if (error) throw error;
      toast.success('Building features saved');
      onUpdate();
    } catch (error) {
      console.error('Error saving building features:', error);
      toast.error('Failed to save building features');
    } finally {
      setSavingFeatures(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail || !user) return;
    setInviting(true);
    try {
      const { error } = await supabase.from('property_members').insert({
        property_id: propertyId,
        user_id: user.id,
        email: inviteEmail.toLowerCase().trim(),
        role: inviteRole,
        invited_by: user.id,
        status: 'pending',
      });
      if (error) {
        if (error.code === '23505') { toast.error('This person has already been invited'); }
        else { throw error; }
        return;
      }
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('viewer');
      setInviteOpen(false);
      fetchMembers();
    } catch (error) {
      console.error('Error inviting member:', error);
      toast.error('Failed to invite member');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('property_members')
        .update({ status: 'removed' })
        .eq('id', memberId);
      if (error) throw error;
      toast.success('Member removed');
      fetchMembers();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    }
  };

  const handleDeleteProperty = async () => {
    setDeleting(true);
    try {
      await Promise.all([
        supabase.from('applications').delete().eq('property_id', propertyId),
        supabase.from('violations').delete().eq('property_id', propertyId),
        supabase.from('work_orders').delete().eq('property_id', propertyId),
        supabase.from('property_documents').delete().eq('property_id', propertyId),
        supabase.from('property_activity_log').delete().eq('property_id', propertyId),
        supabase.from('property_members').delete().eq('property_id', propertyId),
      ]);
      const { data: convos } = await supabase.from('property_ai_conversations').select('id').eq('property_id', propertyId);
      if (convos && convos.length > 0) {
        const convoIds = convos.map(c => c.id);
        await supabase.from('property_ai_messages').delete().in('conversation_id', convoIds);
        await supabase.from('property_ai_conversations').delete().eq('property_id', propertyId);
      }
      const { data: leaseConvos } = await supabase.from('lease_conversations').select('id').eq('property_id', propertyId);
      if (leaseConvos && leaseConvos.length > 0) {
        const leaseIds = leaseConvos.map(c => c.id);
        await supabase.from('lease_messages').delete().in('conversation_id', leaseIds);
        await supabase.from('lease_conversations').delete().eq('property_id', propertyId);
      }
      const { error } = await supabase.from('properties').delete().eq('id', propertyId);
      if (error) throw error;
      toast.success('Property deleted');
      navigate('/dashboard/properties');
    } catch (error) {
      console.error('Error deleting property:', error);
      toast.error('Failed to delete property');
    } finally {
      setDeleting(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-primary/10 text-primary border-primary/20';
      case 'manager': return 'bg-accent/10 text-accent border-accent/20';
      case 'super': return 'bg-warning/10 text-warning border-warning/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const FeatureToggle = ({ label, sublabel, checked, onChange }: { label: string; sublabel: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Owner & Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="w-5 h-5 text-primary" />
            Owner & Contact
          </CardTitle>
          <CardDescription>
            Owner information for this property. This info is used for SMS alerts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="owner_name">Owner / Entity Name</Label>
              <Input id="owner_name" placeholder="e.g., ABC Realty LLC" value={formOwnerName} onChange={(e) => setFormOwnerName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_phone">Owner Phone</Label>
              <Input id="owner_phone" type="tel" placeholder="+1 (555) 123-4567" value={formOwnerPhone} onChange={(e) => setFormOwnerPhone(e.target.value)} />
              <p className="text-xs text-muted-foreground">This number receives SMS alerts for new violations</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Building Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wrench className="w-5 h-5 text-primary" />
            Building Features
          </CardTitle>
          <CardDescription>
            These features determine which Local Law requirements apply to this property.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Mechanical Systems */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Mechanical Systems</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FeatureToggle label="Gas Piping" sublabel="LL152, LL157, LL159 gas inspections" checked={formHasGas} onChange={setFormHasGas} />
              <FeatureToggle label="Boiler" sublabel="Annual boiler inspection (Admin Code)" checked={formHasBoiler} onChange={setFormHasBoiler} />
              <FeatureToggle label="Elevator" sublabel="LL62 elevator inspections" checked={formHasElevator} onChange={setFormHasElevator} />
              <FeatureToggle label="Sprinkler System" sublabel="LL26 retrofit + FDNY maintenance" checked={formHasSprinkler} onChange={setFormHasSprinkler} />
              <FeatureToggle label="Standpipe System" sublabel="FDNY standpipe inspections" checked={formHasStandpipe} onChange={setFormHasStandpipe} />
              <FeatureToggle label="Fire Alarm System" sublabel="FDNY fire alarm inspections" checked={formHasFireAlarm} onChange={setFormHasFireAlarm} />
            </div>
          </div>

          {/* Structural Features */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Structural Features</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FeatureToggle label="Retaining Wall" sublabel="LL37 retaining wall inspections" checked={formHasRetainingWall} onChange={setFormHasRetainingWall} />
              <FeatureToggle label="Parking Structure" sublabel="LL126/08 PIPS inspections" checked={formHasParkingStructure} onChange={setFormHasParkingStructure} />
              <FeatureToggle label="Cooling Tower" sublabel="LL77/15 DOHMH certification" checked={formHasCoolingTower} onChange={setFormHasCoolingTower} />
              <FeatureToggle label="Rooftop Water Tank" sublabel="LL76 DOHMH inspections" checked={formHasWaterTank} onChange={setFormHasWaterTank} />
            </div>
          </div>

          {/* Use & Operations */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Use & Operations</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FeatureToggle label="Place of Assembly" sublabel="FDNY PA certificate (75+ persons)" checked={formHasPlaceOfAssembly} onChange={setFormHasPlaceOfAssembly} />
              <FeatureToggle label="Food Establishment" sublabel="DEP grease trap maintenance" checked={formIsFoodEstablishment} onChange={setFormIsFoodEstablishment} />
              <FeatureToggle label="Backflow Prevention Device" sublabel="DEP annual testing" checked={formHasBackflowDevice} onChange={setFormHasBackflowDevice} />
              <FeatureToggle label="Burns No. 4 Oil" sublabel="LL32 oil phaseout (deadline 2027)" checked={formBurnsNo4Oil} onChange={setFormBurnsNo4Oil} />
            </div>
          </div>

          <Button onClick={handleSaveBuildingFeatures} disabled={savingFeatures}>
            {savingFeatures && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Building Features
          </Button>
        </CardContent>
      </Card>

      {/* SMS Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="w-5 h-5 text-primary" />
            SMS Alerts
          </CardTitle>
          <CardDescription>Get instant text messages when new violations are detected</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
            <div>
              <p className="font-medium">Enable SMS Alerts</p>
              <p className="text-sm text-muted-foreground">
                {formOwnerPhone ? `Alerts will be sent to ${formOwnerPhone}` : 'Add an owner phone number above to enable'}
              </p>
            </div>
            <Switch checked={formSmsEnabled} onCheckedChange={setFormSmsEnabled} disabled={!formOwnerPhone} />
          </div>
          <Button onClick={handleSaveOwnerSettings} className="mt-4" disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5 text-primary" />
                Team Members
              </CardTitle>
              <CardDescription>Invite property managers, supers, or other team members</CardDescription>
            </div>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><UserPlus className="w-4 h-4 mr-2" />Invite</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite_email">Email Address</Label>
                    <Input id="invite_email" type="email" placeholder="team@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite_role">Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="super">Super / Maintenance</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleInviteMember} className="w-full" disabled={!inviteEmail || inviting}>
                    {inviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Send Invitation
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMembers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : members.length > 0 ? (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{member.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className={getRoleBadgeColor(member.role)}>{member.role}</Badge>
                        {member.status === 'pending' ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />Pending</span>
                        ) : (
                          <span className="text-xs text-success flex items-center gap-1"><Check className="w-3 h-3" />Active</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleRemoveMember(member.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No team members yet</p>
              <p className="text-xs">Invite managers or supers to collaborate</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions for this property</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
            <div>
              <p className="font-medium">Delete this property</p>
              <p className="text-sm text-muted-foreground">
                Permanently remove this property and all its violations, applications, documents, and work orders.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm"><Trash2 className="w-4 h-4 mr-2" />Delete Property</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this property and all associated data including violations, applications, documents, work orders, and activity logs. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteProperty} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleting}>
                    {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Delete Property
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
