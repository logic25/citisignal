import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, ThumbsUp, Loader2, ChevronDown, ChevronUp, Zap, AlertTriangle, ChevronRight, Sparkles, ScanSearch, PlusCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

function useFeatureRequests() {
  return useQuery({
    queryKey: ["feature-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_requests" as any)
        .select("*")
        .order("upvotes", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-muted text-muted-foreground",
  under_review: "bg-primary/10 text-primary border-primary/30",
  planned: "bg-success/10 text-success border-success/30",
  completed: "bg-success/10 text-success",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-warning/10 text-warning border-warning/30",
  low: "bg-success/10 text-success border-success/30",
};

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "violations", label: "Violations" },
  { value: "properties", label: "Properties" },
  { value: "work_orders", label: "Work Orders" },
  { value: "finance", label: "Finance" },
  { value: "notifications", label: "Notifications" },
  { value: "reports", label: "Reports" },
];

type AIResult = {
  title: string;
  description: string;
  category: string;
  priority: string;
  evidence: string;
  duplicate_warning: string | null;
  challenges: { problem: string; solution: string }[];
};

type FrictionSuggestion = {
  title: string;
  description: string;
  suggestion: string;
};

async function callAnalyzeTelemetry(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("analyze-telemetry", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

function AIResultCard({ result, onAddToRoadmap, adding }: { result: AIResult; onAddToRoadmap: () => void; adding: boolean }) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className="font-semibold text-foreground">{result.title}</p>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 capitalize ${PRIORITY_COLORS[result.priority] || ""}`}>
              {result.priority} priority
            </Badge>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{result.category}</Badge>
          </div>
        </div>

        {result.duplicate_warning && (
          <div className="flex items-start gap-1.5 text-xs text-warning bg-warning/10 rounded px-2 py-1.5">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            <span>Similar to existing: <em>{result.duplicate_warning}</em></span>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Why it matters</p>
          <p className="text-sm text-foreground">{result.evidence}</p>
        </div>

        {result.challenges?.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Challenges & solutions</p>
            {result.challenges.map((c, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs">
                <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                <span><span className="text-foreground">{c.problem}</span> → <span className="text-muted-foreground">{c.solution}</span></span>
              </div>
            ))}
          </div>
        )}

        <Button size="sm" onClick={onAddToRoadmap} disabled={adding} className="gap-1.5 w-full mt-1">
          {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
          {adding ? "Adding..." : "Add to Roadmap"}
        </Button>
      </CardContent>
    </Card>
  );
}

function AIRoadmapIntakePanel() {
  const [idea, setIdea] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [aiResult, setAIResult] = useState<AIResult | null>(null);
  const [frictionSuggestions, setFrictionSuggestions] = useState<FrictionSuggestion[]>([]);
  const [addingToRoadmap, setAddingToRoadmap] = useState(false);

  const handleAnalyze = async () => {
    if (!idea.trim()) return;
    setAnalyzing(true);
    setAIResult(null);
    try {
      const result = await callAnalyzeTelemetry({ mode: "idea", raw_idea: idea });
      setAIResult(result as AIResult);
    } catch (err: any) {
      toast.error("Analysis failed: " + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleTelemetryScan = async () => {
    setScanning(true);
    setFrictionSuggestions([]);
    try {
      const result = await callAnalyzeTelemetry({ mode: "telemetry" });
      setFrictionSuggestions((result as any).suggestions || []);
    } catch (err: any) {
      toast.error("Scan failed: " + err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleAddToRoadmap = async () => {
    if (!aiResult) return;
    setAddingToRoadmap(true);
    try {
      const { error } = await supabase
        .from("roadmap_items" as any)
        .insert({
          title: aiResult.title,
          description: aiResult.description,
          phase: "future",
          sort_order: 999,
        } as any);
      if (error) throw error;
      toast.success("Added to roadmap!");
      setAIResult(null);
      setIdea("");
    } catch (err: any) {
      toast.error("Failed to add: " + err.message);
    } finally {
      setAddingToRoadmap(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Idea Analyzer */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Idea Analyzer</h4>
        </div>
        <Textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="Describe your feature idea in plain English... e.g. 'I want to be able to bulk-export all violations to CSV with filters applied'"
          rows={3}
          className="resize-none"
        />
        <Button
          size="sm"
          onClick={handleAnalyze}
          disabled={analyzing || !idea.trim()}
          className="gap-1.5"
        >
          {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {analyzing ? "Analyzing..." : "Analyze with AI"}
        </Button>

        {aiResult && (
          <AIResultCard result={aiResult} onAddToRoadmap={handleAddToRoadmap} adding={addingToRoadmap} />
        )}
      </div>

      <div className="border-t border-border" />

      {/* Telemetry Scan */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ScanSearch className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Telemetry Scan</h4>
          <span className="text-xs text-muted-foreground">— AI scans usage patterns for friction points</span>
        </div>
        <Button size="sm" variant="outline" onClick={handleTelemetryScan} disabled={scanning} className="gap-1.5">
          {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5" />}
          {scanning ? "Scanning..." : "Scan for Friction Points"}
        </Button>

        {frictionSuggestions.length > 0 && (
          <div className="space-y-2">
            {frictionSuggestions.map((s, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-3">
                  <p className="font-medium text-sm text-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                  {s.suggestion && (
                    <p className="text-xs text-primary mt-1">💡 {s.suggestion}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function FeatureRequests() {
  const { data: requests, isLoading } = useFeatureRequests();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("feature_requests" as any).insert({
        user_id: user!.id,
        title,
        description,
        category,
        priority,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-requests"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      toast.success("Feature request submitted!");
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const upvoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const req = requests?.find((r: any) => r.id === id);
      if (!req) return;
      const { error } = await supabase
        .from("feature_requests" as any)
        .update({ upvotes: (req.upvotes || 0) + 1 } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-requests"] });
    },
  });

  return (
    <div className="space-y-4">
      {/* AI Roadmap Intake Panel */}
      <Collapsible open={intakeOpen} onOpenChange={setIntakeOpen}>
        <Card className={`border-primary/20 transition-colors ${intakeOpen ? "bg-primary/3" : "bg-muted/30 hover:bg-muted/50"}`}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">AI Roadmap Intake</CardTitle>
                    <p className="text-xs text-muted-foreground font-normal">Analyze ideas & scan for friction points</p>
                  </div>
                </div>
                {intakeOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 px-4 pb-4">
              <AIRoadmapIntakePanel />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Submit Request</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Submit Feature Request</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief description of the feature" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why do you need this? How would it help?" rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={!title.trim() || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : !requests || requests.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <p>No feature requests yet. Be the first to submit one!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.map((req: any) => (
            <Card key={req.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex flex-col items-center gap-0 h-auto py-1 px-2"
                  onClick={() => upvoteMutation.mutate(req.id)}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">{req.upvotes || 0}</span>
                </Button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="font-medium text-sm">{req.title}</p>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_STYLES[req.status] || ""}`}>
                      {(req.status || "submitted").replace("_", " ")}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{req.category}</Badge>
                  </div>
                  {req.description && <p className="text-xs text-muted-foreground line-clamp-2">{req.description}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {format(new Date(req.created_at), "MM/dd/yy")}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
