import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, Info, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format } from 'date-fns';
import { decodeComplaintCategory, getComplaintSeverityColor } from '@/lib/complaint-category-decoder';

interface Complaint {
  id: string;
  violation_number: string;
  issued_date: string;
  status: string;
  description_raw: string | null;
  complaint_category?: string | null;
  disposition_code?: string | null;
  disposition_comments?: string | null;
  priority?: string | null;
  source?: string | null;
  severity?: string | null;
}

interface PropertyComplaintsTabProps {
  complaints: Complaint[];
}

// Disposition code reference
const DISPOSITION_CODES: Record<string, string> = {
  'A1': 'Building vacated',
  'A2': 'Partial vacate',
  'A3': 'Precautionary vacate',
  'A4': 'Vacate rescinded',
  'A5': 'Vacate partially rescinded',
  'A8': 'Emergency declaration',
  'A9': 'Referred to Fire Dept',
  'C1': 'Condition corrected',
  'C2': 'No access — re-inspection needed',
  'C3': 'Summons issued',
  'C4': 'Work stopped',
  'C5': 'Referred to other agency',
  'D1': 'No violation warranted',
  'D2': 'No illegal conversion found',
  'D3': 'Duplicate complaint',
  'D4': 'No permit required',
  'H1': 'Hazardous — violation issued',
  'H5': 'Full Stop Work Order placed',
  'I1': 'Inspector unable to gain access',
  'I2': 'Inspector unable to gain access — re-inspection scheduled',
  'L1': 'Partial Stop Work Order placed',
  'L2': 'Stop Work Order fully rescinded',
  'L3': 'Stop Work Order partially rescinded',
  'L4': 'Full Stop Work Order placed',
};

const getDispositionLabel = (code: string | null): string | null => {
  if (!code) return null;
  return DISPOSITION_CODES[code.toUpperCase()] || null;
};

const getDispositionBadgeColor = (code: string | null): string => {
  if (!code) return 'bg-muted text-muted-foreground';
  const upper = code.toUpperCase();
  if (upper.startsWith('A')) return 'bg-destructive/10 text-destructive';
  if (upper.startsWith('C')) return 'bg-success/10 text-success';
  if (upper.startsWith('D')) return 'bg-muted text-muted-foreground';
  if (upper.startsWith('H') || upper.startsWith('L1') || upper.startsWith('L4')) return 'bg-destructive/10 text-destructive';
  if (upper.startsWith('L2') || upper.startsWith('L3')) return 'bg-success/10 text-success';
  if (upper.startsWith('I')) return 'bg-warning/10 text-warning';
  return 'bg-muted text-muted-foreground';
};

type SortField = 'issued_date' | 'status' | 'complaint_category';
type SortDirection = 'asc' | 'desc';

export const PropertyComplaintsTab = ({ complaints }: PropertyComplaintsTabProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('issued_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1" />
      : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const filtered = useMemo(() => {
    let result = complaints.filter(c => {
      const matchesSearch =
        c.violation_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description_raw?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.complaint_category?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'issued_date':
          cmp = new Date(a.issued_date).getTime() - new Date(b.issued_date).getTime();
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'complaint_category':
          cmp = (a.complaint_category || '').localeCompare(b.complaint_category || '');
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [complaints, searchQuery, statusFilter, sortField, sortDirection]);

  const openCount = complaints.filter(c => c.status === 'open').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span><strong>{complaints.length}</strong> total</span>
          <span><strong>{openCount}</strong> open</span>
          <span><strong>{complaints.length - openCount}</strong> closed</span>
        </div>

        {/* Disposition Legend */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Info className="w-3.5 h-3.5" />
                Disposition Codes
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-sm">
              <div className="space-y-1 text-xs">
                <p className="font-semibold mb-1">Common Disposition Codes</p>
                {Object.entries(DISPOSITION_CODES).slice(0, 12).map(([code, label]) => (
                  <div key={code} className="flex gap-2">
                    <span className="font-mono font-bold w-6">{code}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search complaints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No complaints found</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Complaint #</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('issued_date')}
                >
                  <div className="flex items-center">
                    Date {getSortIcon('issued_date')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('complaint_category')}
                >
                  <div className="flex items-center">
                    Category {getSortIcon('complaint_category')}
                  </div>
                </TableHead>
                <TableHead>Priority</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status {getSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead>Disposition</TableHead>
                <TableHead className="max-w-[300px]">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const catInfo = decodeComplaintCategory(c.complaint_category);
                const dispLabel = getDispositionLabel(c.disposition_code);
                const complaintNum = c.violation_number.replace(/^COMP-/, '');

                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm">{complaintNum}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(c.issued_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {catInfo ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className={`text-xs ${getComplaintSeverityColor(catInfo.severity)}`}>
                                {c.complaint_category} — {catInfo.name}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs max-w-[250px]">{catInfo.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-xs text-muted-foreground">{c.complaint_category || '—'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.priority ? (
                        <Badge variant="outline" className={`text-xs ${
                          c.priority === 'A' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                          c.priority === 'B' ? 'bg-warning/10 text-warning border-warning/20' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {c.priority}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${
                        c.status === 'open' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                      }`}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.disposition_code ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className={`text-xs ${getDispositionBadgeColor(c.disposition_code)}`}>
                                {c.disposition_code}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">{dispLabel || 'Unknown disposition code'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {c.description_raw || '—'}
                      </p>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
