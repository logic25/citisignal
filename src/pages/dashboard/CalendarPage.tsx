import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertTriangle, FileStack, ClipboardList, FileText, Plus, Star } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek, isPast, isBefore, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface CalendarEvent {
  id: string;
  date: Date;
  title: string;
  subtitle: string;
  type: 'hearing' | 'cure_deadline' | 'certification' | 'permit_expiration' | 'document_expiration' | 'work_order' | 'custom';
  propertyId: string;
  propertyAddress: string;
  urgent: boolean;
  description?: string;
  time?: string;
}

const EVENT_COLORS: Record<CalendarEvent['type'], string> = {
  hearing: 'bg-destructive/15 text-destructive border-destructive/30',
  cure_deadline: 'bg-warning/15 text-warning border-warning/30',
  certification: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300/30',
  permit_expiration: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300/30',
  document_expiration: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300/30',
  work_order: 'bg-muted text-muted-foreground border-muted',
  custom: 'bg-primary/15 text-primary border-primary/30',
};

const EVENT_LABELS: Record<CalendarEvent['type'], string> = {
  hearing: 'Hearing',
  cure_deadline: 'Cure Deadline',
  certification: 'Certification Due',
  permit_expiration: 'Permit Expires',
  document_expiration: 'Doc Expires',
  work_order: 'Work Order',
  custom: 'Custom',
};

const EVENT_ICONS: Record<CalendarEvent['type'], typeof AlertTriangle> = {
  hearing: AlertTriangle,
  cure_deadline: AlertTriangle,
  certification: AlertTriangle,
  permit_expiration: FileStack,
  document_expiration: FileText,
  work_order: ClipboardList,
  custom: Star,
};

const CalendarPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const navigate = useNavigate();

  const [newEvent, setNewEvent] = useState({
    title: '', description: '', event_date: format(new Date(), 'yyyy-MM-dd'),
    event_time: '', property_id: '', event_type: 'custom',
  });

  // Fetch properties
  const { data: properties } = useQuery({
    queryKey: ['calendar-properties'],
    queryFn: async () => {
      const { data, error } = await supabase.from('properties').select('id, address').order('address');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch custom events
  const { data: customEvents } = useQuery({
    queryKey: ['calendar-custom-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, properties(address)')
        .order('event_date');
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  // Fetch violations with dates
  const { data: violations } = useQuery({
    queryKey: ['calendar-violations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('violations')
        .select('id, hearing_date, cure_due_date, certification_due_date, violation_number, agency, status, property_id, properties!inner(address)')
        .or('hearing_date.not.is.null,cure_due_date.not.is.null,certification_due_date.not.is.null');
      if (error) throw error;
      return data;
    },
  });

  // Fetch applications with expiration dates
  const { data: applications } = useQuery({
    queryKey: ['calendar-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select('id, application_number, expiration_date, application_type, status, property_id, properties!inner(address)')
        .not('expiration_date', 'is', null);
      if (error) throw error;
      return data;
    },
  });

  // Fetch documents with expiration dates
  const { data: documents } = useQuery({
    queryKey: ['calendar-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_documents')
        .select('id, document_name, document_type, expiration_date, property_id, properties!inner(address)')
        .not('expiration_date', 'is', null);
      if (error) throw error;
      return data;
    },
  });

  // Create custom event
  const createEvent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('calendar_events').insert({
        user_id: user!.id,
        title: newEvent.title,
        description: newEvent.description || null,
        event_date: newEvent.event_date,
        event_time: newEvent.event_time || null,
        property_id: newEvent.property_id || null,
        event_type: newEvent.event_type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-custom-events'] });
      setShowCreateEvent(false);
      setNewEvent({ title: '', description: '', event_date: format(new Date(), 'yyyy-MM-dd'), event_time: '', property_id: '', event_type: 'custom' });
      toast.success('Event created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Build events
  const events = useMemo<CalendarEvent[]>(() => {
    const result: CalendarEvent[] = [];
    const sevenDaysFromNow = addDays(new Date(), 7);

    // Custom events
    (customEvents || []).forEach((ce: any) => {
      const d = new Date(ce.event_date);
      const addr = ce.properties?.address || '';
      result.push({
        id: `custom-${ce.id}`, date: d, title: ce.title, subtitle: ce.description || '',
        type: 'custom', propertyId: ce.property_id || '', propertyAddress: addr,
        urgent: false, description: ce.description, time: ce.event_time,
      });
    });

    (violations || []).forEach((v: any) => {
      const addr = (v.properties as any)?.address || 'Unknown';
      if (v.hearing_date) {
        const d = new Date(v.hearing_date);
        result.push({
          id: `hearing-${v.id}`, date: d, title: `${v.agency} Hearing`, subtitle: `#${v.violation_number}`,
          type: 'hearing', propertyId: v.property_id, propertyAddress: addr,
          urgent: isBefore(d, sevenDaysFromNow) && !isPast(d),
        });
      }
      if (v.cure_due_date) {
        const d = new Date(v.cure_due_date);
        result.push({
          id: `cure-${v.id}`, date: d, title: `Cure Deadline`, subtitle: `${v.agency} #${v.violation_number}`,
          type: 'cure_deadline', propertyId: v.property_id, propertyAddress: addr,
          urgent: isBefore(d, sevenDaysFromNow) && !isPast(d),
        });
      }
      if (v.certification_due_date) {
        const d = new Date(v.certification_due_date);
        result.push({
          id: `cert-${v.id}`, date: d, title: `Certification Due`, subtitle: `${v.agency} #${v.violation_number}`,
          type: 'certification', propertyId: v.property_id, propertyAddress: addr,
          urgent: isBefore(d, sevenDaysFromNow) && !isPast(d),
        });
      }
    });

    (applications || []).forEach((a: any) => {
      if (a.expiration_date) {
        const d = new Date(a.expiration_date);
        const addr = (a.properties as any)?.address || 'Unknown';
        result.push({
          id: `permit-${a.id}`, date: d, title: `Permit Expires`, subtitle: `${a.application_type} ${a.application_number}`,
          type: 'permit_expiration', propertyId: a.property_id, propertyAddress: addr,
          urgent: isBefore(d, sevenDaysFromNow) && !isPast(d),
        });
      }
    });

    (documents || []).forEach((doc: any) => {
      if (doc.expiration_date) {
        const d = new Date(doc.expiration_date);
        const addr = (doc.properties as any)?.address || 'Unknown';
        result.push({
          id: `doc-${doc.id}`, date: d, title: `${doc.document_type} Expires`, subtitle: doc.document_name,
          type: 'document_expiration', propertyId: doc.property_id, propertyAddress: addr,
          urgent: isBefore(d, sevenDaysFromNow) && !isPast(d),
        });
      }
    });

    return result;
  }, [violations, applications, documents, customEvents]);

  const filteredEvents = useMemo(() => {
    if (typeFilter === 'all') return events;
    return events.filter(e => e.type === typeFilter);
  }, [events, typeFilter]);

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const eventsForDay = (day: Date) => filteredEvents.filter(e => isSameDay(e.date, day));
  const selectedDayEvents = selectedDay ? eventsForDay(selectedDay) : [];

  // Upcoming events (next 30 days)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const thirtyDays = addDays(now, 30);
    return filteredEvents
      .filter(e => !isPast(e.date) || isToday(e.date))
      .filter(e => isBefore(e.date, thirtyDays))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [filteredEvents]);

  // Stats
  const totalEvents = filteredEvents.length;
  const overdueEvents = filteredEvents.filter(e => isPast(e.date) && !isToday(e.date)).length;
  const urgentEvents = filteredEvents.filter(e => e.urgent).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Compliance Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track hearings, deadlines, permit expirations, and certifications across all properties
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showCreateEvent} onOpenChange={setShowCreateEvent}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" />Create Event</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Calendar Event</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Title *</Label>
                  <Input value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Inspection scheduled" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date *</Label>
                    <Input type="date" value={newEvent.event_date} onChange={e => setNewEvent(p => ({ ...p, event_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Time (optional)</Label>
                    <Input type="time" value={newEvent.event_time} onChange={e => setNewEvent(p => ({ ...p, event_time: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Event Type</Label>
                  <Select value={newEvent.event_type} onValueChange={v => setNewEvent(p => ({ ...p, event_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom</SelectItem>
                      <SelectItem value="hearing">Hearing</SelectItem>
                      <SelectItem value="inspection">Inspection</SelectItem>
                      <SelectItem value="deadline">Deadline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Property (optional)</Label>
                  <Select value={newEvent.property_id} onValueChange={v => setNewEvent(p => ({ ...p, property_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {(properties || []).map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Textarea value={newEvent.description} onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))} rows={2} />
                </div>
                <Button onClick={() => createEvent.mutate()} disabled={!newEvent.title || !newEvent.event_date} className="w-full">
                  Create Event
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="hearing">Hearings</SelectItem>
              <SelectItem value="cure_deadline">Cure Deadlines</SelectItem>
              <SelectItem value="certification">Certifications</SelectItem>
              <SelectItem value="permit_expiration">Permit Expirations</SelectItem>
              <SelectItem value="document_expiration">Document Expirations</SelectItem>
              <SelectItem value="custom">Custom Events</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold">{totalEvents}</p>
            <p className="text-xs text-muted-foreground">Total Events</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold">{urgentEvents}</p>
            <p className="text-xs text-muted-foreground">Due Within 7 Days</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold">{overdueEvents}</p>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-4">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()); }} className="text-xs">
                Today
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <h2 className="font-display text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
            <div className="w-24" />
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {calDays.map(day => {
              const dayEvents = eventsForDay(day);
              const inMonth = isSameMonth(day, currentMonth);
              const today = isToday(day);
              const isSelected = selectedDay && isSameDay(day, selectedDay);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`
                    min-h-[80px] p-1.5 text-left transition-colors bg-card hover:bg-muted/50
                    ${!inMonth ? 'opacity-40' : ''}
                    ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}
                  `}
                >
                  <div className={`
                    text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full
                    ${today ? 'bg-primary text-primary-foreground' : 'text-foreground'}
                  `}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => (
                      <div
                        key={ev.id}
                        className={`text-[10px] leading-tight px-1 py-0.5 rounded border truncate ${EVENT_COLORS[ev.type]}`}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar: selected day or upcoming */}
        <div className="space-y-4">
          {selectedDay ? (
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-1">
                {format(selectedDay, 'EEEE, MMM d, yyyy')}
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''}
              </p>
              {selectedDayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No events on this day.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayEvents.map(ev => {
                    const Icon = EVENT_ICONS[ev.type];
                    const daysAway = Math.ceil((ev.date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    const isOverdue = daysAway < 0;
                    return (
                      <div
                        key={ev.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/30 ${
                          isOverdue ? 'border-destructive/40 bg-destructive/5' :
                          ev.urgent ? 'border-warning/40 bg-warning/5' : 'border-border'
                        }`}
                        onClick={() => setSelectedEvent(ev)}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isOverdue ? 'text-destructive' : ev.urgent ? 'text-warning' : 'text-muted-foreground'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-foreground">{ev.title}</span>
                              {isOverdue && <Badge variant="destructive" className="text-[10px] py-0">Overdue</Badge>}
                            </div>
                            <Badge variant="outline" className={`text-[10px] mb-1 ${EVENT_COLORS[ev.type]}`}>
                              {EVENT_LABELS[ev.type]}
                            </Badge>
                            <p className="text-xs text-muted-foreground truncate">{ev.subtitle}</p>
                            {ev.propertyAddress && <p className="text-xs text-muted-foreground truncate mt-0.5">{ev.propertyAddress}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {/* Upcoming events */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Upcoming (30 days)
            </h3>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {upcomingEvents.map(ev => {
                  const Icon = EVENT_ICONS[ev.type];
                  return (
                    <div
                      key={ev.id}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-colors hover:bg-muted/30 ${ev.urgent ? 'border-destructive/40 bg-destructive/5' : 'border-border'}`}
                      onClick={() => setSelectedEvent(ev)}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${ev.urgent ? 'text-destructive' : 'text-muted-foreground'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-foreground truncate">{ev.title}</span>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{format(ev.date, 'MMM d')}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{ev.propertyAddress}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event Detail Sheet */}
      <Sheet open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <SheetContent>
          {selectedEvent && (() => {
            const Icon = EVENT_ICONS[selectedEvent.type];
            const daysAway = Math.ceil((selectedEvent.date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            return (
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Icon className="w-5 h-5" />
                  {selectedEvent.title}
                </SheetTitle>
                <div className="space-y-3 pt-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={EVENT_COLORS[selectedEvent.type]}>{EVENT_LABELS[selectedEvent.type]}</Badge>
                    {daysAway < 0 && <Badge variant="destructive">Overdue by {Math.abs(daysAway)} days</Badge>}
                    {daysAway >= 0 && daysAway <= 7 && <Badge className="bg-warning/10 text-warning border-warning/20">In {daysAway} days</Badge>}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{format(selectedEvent.date, 'EEEE, MMMM d, yyyy')}</span></div>
                    {selectedEvent.time && <div><span className="text-muted-foreground">Time:</span> <span className="font-medium">{selectedEvent.time}</span></div>}
                    {selectedEvent.propertyAddress && <div><span className="text-muted-foreground">Property:</span> <span className="font-medium">{selectedEvent.propertyAddress}</span></div>}
                    {selectedEvent.subtitle && <div><span className="text-muted-foreground">Details:</span> <span className="font-medium">{selectedEvent.subtitle}</span></div>}
                    {selectedEvent.description && <div><span className="text-muted-foreground">Description:</span> <p className="mt-1">{selectedEvent.description}</p></div>}
                  </div>
                  {selectedEvent.propertyId && (
                    <Button variant="outline" size="sm" onClick={() => { setSelectedEvent(null); navigate(`/dashboard/properties/${selectedEvent.propertyId}`); }}>
                      View Property →
                    </Button>
                  )}
                </div>
              </SheetHeader>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default CalendarPage;
