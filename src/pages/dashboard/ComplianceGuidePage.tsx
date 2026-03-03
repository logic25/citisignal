import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Scale, ChevronDown, ExternalLink, Search } from 'lucide-react';

interface LawGuide {
  id: string;
  name: string;
  whoApplies: string;
  whatRequired: string;
  deadline: string;
  penalty: string;
  howToComply: string;
  officialLink: string;
  filingPortal?: string;
  category: string;
}

const COMPLIANCE_LAWS: LawGuide[] = [
  // DOB — Facade, Exterior & Structural
  { id: 'll11', name: 'LL11 — Facade Inspection (FISP)', category: 'DOB — Facade, Exterior & Structural', whoApplies: 'Buildings over 6 stories', whatRequired: 'Periodic facade inspection by a Qualified Exterior Wall Inspector (QEWI). Report conditions as Safe, SWARMP, or Unsafe.', deadline: 'Based on FISP Cycle 10 sub-cycle — depends on block last digit. Sub-cycles A/B/C with 5-year intervals.', penalty: '$1,000/month for late filing; $1,000/month for failure to correct unsafe conditions', howToComply: 'Hire a QEWI, conduct inspection, file report via DOB NOW Safety.', officialLink: 'https://www.nyc.gov/assets/buildings/pdf/facadecycle-sn.pdf', filingPortal: 'https://a810-dobnow.nyc.gov/publish/#!/' },
  { id: 'll126-parapet', name: 'LL126/21 — Annual Parapet Inspection', category: 'DOB — Facade, Exterior & Structural', whoApplies: 'All buildings with parapets facing public right-of-way', whatRequired: 'Annual observation of parapet walls. No filing required — retain records.', deadline: 'Annually by December 31', penalty: 'Min $1,250, max $10,000 for failure to provide report', howToComply: 'Conduct annual visual inspection, document findings, retain records.', officialLink: 'https://www.nyc.gov/site/buildings/safety/parapets.page' },
  { id: 'll126-pips', name: 'LL126/08 — Parking Structure Inspection (PIPS)', category: 'DOB — Facade, Exterior & Structural', whoApplies: 'Buildings with parking structures', whatRequired: 'Every 6 years (3 two-year sub-cycles). Annual checklist after initial filing.', deadline: 'Based on community district sub-cycle', penalty: 'Up to $17,000/year for non-compliance', howToComply: 'Hire a Qualified Parking Structure Inspector (QPSI), file via DOB NOW Safety.', officialLink: 'https://www.nyc.gov/site/buildings/safety/parking-structure.page' },
  { id: 'll37', name: 'LL37 — Retaining Wall Inspection', category: 'DOB — Facade, Exterior & Structural', whoApplies: 'Buildings with retaining walls ≥10 ft facing public right-of-way', whatRequired: 'Inspection every 5 years by Qualified Retaining Wall Inspector (QRWI).', deadline: '5-year cycle', penalty: 'Up to $1,000/year', howToComply: 'Hire QRWI, inspect retaining wall, file report.', officialLink: 'https://www.nyc.gov/site/buildings/safety/retaining-wall.page' },

  // DOB — Energy & Emissions
  { id: 'll84', name: 'LL84 — Energy Benchmarking', category: 'DOB — Energy & Emissions', whoApplies: 'Buildings ≥25,000 SF', whatRequired: 'Annual energy and water benchmarking via EPA Portfolio Manager.', deadline: 'May 1 annually', penalty: '$500 first missed deadline; $500/quarter thereafter', howToComply: 'Set up EPA Portfolio Manager account, enter utility data, submit benchmarking report.', officialLink: 'https://www.nyc.gov/site/buildings/codes/benchmarking.page' },
  { id: 'll97', name: 'LL97 — Carbon Emissions Limits', category: 'DOB — Energy & Emissions', whoApplies: 'Buildings ≥25,000 SF', whatRequired: 'Building carbon emission limits. Period 1 (2024-2029): moderate limits. Period 2 (2030+): stricter.', deadline: 'May 1 — first report due May 2025', penalty: '$268/metric ton CO₂ over limit', howToComply: 'Calculate emissions, implement efficiency measures, file annual emissions report.', officialLink: 'https://www.nyc.gov/site/buildings/codes/ll97-greenhouse-gas-emissions-reductions.page' },
  { id: 'll87', name: 'LL87 — Energy Audit & Retro-Commissioning', category: 'DOB — Energy & Emissions', whoApplies: 'Buildings ≥25,000 SF', whatRequired: 'Energy audit and retro-commissioning every 10 years.', deadline: '10-year cycle based on block last digit', penalty: '$3,000 first year; $5,000/year thereafter', howToComply: 'Hire registered energy auditor, conduct audit and retro-cx, file report via DOB NOW.', officialLink: 'https://www.nyc.gov/site/buildings/codes/ll87-energy-audits-retro-commissioning.page' },
  { id: 'll33-energy', name: 'LL33/95 — Energy Efficiency Grade', category: 'DOB — Energy & Emissions', whoApplies: 'Buildings ≥25,000 SF', whatRequired: 'Annual letter grade (A-D, F) based on ENERGY STAR score posted near each public entrance.', deadline: 'October 31 annually', penalty: '$1,250 per violation for failure to post', howToComply: 'Obtain ENERGY STAR score, generate letter grade, post near all public entrances.', officialLink: 'https://www.nyc.gov/site/buildings/codes/ll33-faqs.page' },

  // DOB — Gas Safety
  { id: 'll152', name: 'LL152 — Gas Piping Inspection', category: 'DOB — Gas Safety', whoApplies: 'All buildings with gas service', whatRequired: 'Periodic inspection of gas piping by Licensed Master Plumber every 4 years.', deadline: '4-year cycle based on community district', penalty: 'Up to $5,000–$10,000; hazardous conditions can trigger gas shutoff', howToComply: 'Hire LMP, inspect all gas piping, file report via DOB NOW Safety.', officialLink: 'https://www.nyc.gov/site/buildings/property-or-business-owner/gas-piping-inspections.page', filingPortal: 'https://a810-dobnow.nyc.gov/publish/#!/' },
  { id: 'll157', name: 'LL157 — Natural Gas Detector Installation', category: 'DOB — Gas Safety', whoApplies: 'Residential buildings with gas service', whatRequired: 'Install natural gas detectors in every dwelling unit.', deadline: 'May 1, 2025 (deadline passed)', penalty: 'HPD/DOB violation', howToComply: 'Purchase and install natural gas detectors in all dwelling units.', officialLink: 'https://www.nyc.gov/site/hpd/services-and-information/natural-gas-detectors.page' },

  // DOB — Elevators & Mechanical
  { id: 'll62', name: 'LL62 — Elevator Safety', category: 'DOB — Elevators & Mechanical', whoApplies: 'Buildings with elevators', whatRequired: 'Annual periodic and category tests. Monthly maintenance contracts required.', deadline: 'Annually by December 31', penalty: '$1,000–$5,000 per device', howToComply: 'Maintain elevator inspection contract, ensure all tests completed, file compliance reports.', officialLink: 'https://www.nyc.gov/site/buildings/safety/elevator-devices.page' },
  { id: 'boiler', name: 'Boiler Inspection', category: 'DOB — Elevators & Mechanical', whoApplies: 'Buildings with boilers', whatRequired: 'Annual boiler inspection and filing by licensed professional.', deadline: 'Annually', penalty: '$1,000–$5,000', howToComply: 'Schedule annual boiler inspection, file compliance report.', officialLink: 'https://www.nyc.gov/site/buildings/safety/boilers.page' },

  // DOB — Fire Safety
  { id: 'll26', name: 'LL26 — Sprinkler System Inspection', category: 'DOB — Fire Safety & Sprinklers', whoApplies: 'Buildings with sprinkler systems', whatRequired: '5-year sprinkler inspection and filing by licensed professional.', deadline: '5-year cycle', penalty: 'DOB violation', howToComply: 'Hire sprinkler contractor, conduct inspection, file report via DOB NOW Safety.', officialLink: 'https://www.nyc.gov/site/buildings/safety/sprinklers.page' },

  // DOHMH
  { id: 'cooling-tower', name: 'Cooling Tower Compliance', category: 'DOHMH — Cooling Towers & Water', whoApplies: 'Buildings with cooling towers', whatRequired: 'Quarterly Legionella sampling, annual certification, maintenance plan.', deadline: 'Quarterly sampling; annual certification', penalty: 'Up to $10,000/violation; criminal liability', howToComply: 'Register cooling tower, implement maintenance plan, conduct quarterly sampling, file annual certification.', officialLink: 'https://www.nyc.gov/site/doh/health/health-topics/cooling-towers.page' },
  { id: 'water-tank', name: 'Water Tank Inspection', category: 'DOHMH — Cooling Towers & Water', whoApplies: 'Buildings with rooftop or indoor water tanks', whatRequired: 'Annual inspection and cleaning.', deadline: 'Annually', penalty: 'DOHMH violation', howToComply: 'Schedule annual inspection and cleaning by licensed tank company.', officialLink: 'https://www.nyc.gov/site/doh/health/health-topics/drinking-water.page' },

  // DEP
  { id: 'backflow', name: 'Backflow Prevention', category: 'DEP — Water & Environmental', whoApplies: 'Buildings with backflow prevention devices', whatRequired: 'Annual testing by licensed professional, report to DEP.', deadline: 'Annually', penalty: 'DEP violation; potential water shutoff', howToComply: 'Schedule annual backflow test, submit results to DEP.', officialLink: 'https://www.nyc.gov/site/dep/water/backflow-prevention.page' },
  { id: 'grease-trap', name: 'Grease Trap Compliance', category: 'DEP — Water & Environmental', whoApplies: 'Food service establishments', whatRequired: 'Install and maintain grease interceptor. Quarterly pump-out and manifests.', deadline: 'Quarterly maintenance', penalty: 'DEP violation; up to $10,000', howToComply: 'Install compliant grease trap, schedule quarterly pump-outs, maintain manifests.', officialLink: 'https://www.nyc.gov/site/dep/water/grease.page' },

  // HPD — Residential
  { id: 'll1', name: 'LL1 — Lead Paint (LL31)', category: 'HPD — Residential Housing', whoApplies: 'Pre-1960 residential buildings with children under 6', whatRequired: 'Annual lead paint visual assessment and XRF testing of apartments with children under 6. Remediate hazards.', deadline: 'Annually and upon vacancy', penalty: 'HPD Class C violation; $1,000–$5,000/day', howToComply: 'Conduct annual visual assessment, XRF test when child under 6, remediate hazards immediately.', officialLink: 'https://www.nyc.gov/site/hpd/services-and-information/lead-based-paint.page' },
  { id: 'll55', name: 'LL55 — Window Guard', category: 'HPD — Residential Housing', whoApplies: 'Multiple dwellings (3+ units) with children 10 or under', whatRequired: 'Install and maintain window guards on all windows (except fire escape).', deadline: 'Ongoing obligation', penalty: 'HPD violation; $500–$5,000', howToComply: 'Survey tenants annually, install approved window guards, maintain records.', officialLink: 'https://www.nyc.gov/site/hpd/services-and-information/window-guards.page' },
  { id: 'hpd-reg', name: 'HPD Registration', category: 'HPD — Residential Housing', whoApplies: 'Multiple dwellings (3+ units)', whatRequired: 'Annual registration with HPD listing owners, managing agents, and emergency contacts.', deadline: 'Annually (September)', penalty: '$250–$500 per year non-compliance', howToComply: 'Register online at HPD website, update ownership and management info annually.', officialLink: 'https://www.nyc.gov/site/hpd/services-and-information/property-registration.page' },

  // FDNY
  { id: 'fire-alarm', name: 'Fire Alarm Inspection', category: 'FDNY — Fire Safety', whoApplies: 'Buildings with fire alarm systems', whatRequired: 'Annual inspection and testing by FDNY-certified company.', deadline: 'Annually', penalty: 'FDNY violation; up to $10,000', howToComply: 'Contract with FDNY-certified fire alarm company for annual inspection.', officialLink: 'https://www.nyc.gov/site/fdny/business/all-certifications/cof-fire-alarm.page' },
  { id: 'standpipe', name: 'Standpipe Inspection', category: 'FDNY — Fire Safety', whoApplies: 'Buildings with standpipe systems', whatRequired: 'Annual inspection and hydrostatic testing.', deadline: 'Annually', penalty: 'FDNY violation', howToComply: 'Contract with licensed standpipe company for annual inspection and test.', officialLink: 'https://www.nyc.gov/site/fdny/business/all-certifications/cof-standpipe.page' },
];

const CATEGORIES = [
  'DOB — Facade, Exterior & Structural',
  'DOB — Energy & Emissions',
  'DOB — Gas Safety',
  'DOB — Elevators & Mechanical',
  'DOB — Fire Safety & Sprinklers',
  'DOHMH — Cooling Towers & Water',
  'DEP — Water & Environmental',
  'HPD — Residential Housing',
  'FDNY — Fire Safety',
];

export default function ComplianceGuidePage() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return COMPLIANCE_LAWS;
    const q = search.toLowerCase();
    return COMPLIANCE_LAWS.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.whoApplies.toLowerCase().includes(q) ||
      l.whatRequired.toLowerCase().includes(q) ||
      l.category.toLowerCase().includes(q)
    );
  }, [search]);

  const grouped = useMemo(() => {
    return CATEGORIES.map(cat => ({
      category: cat,
      laws: filtered.filter(l => l.category === cat),
    })).filter(g => g.laws.length > 0);
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Scale className="w-6 h-6" />
          NYC Compliance Guide
        </h1>
        <p className="text-muted-foreground">Reference for all 43 NYC Local Law compliance requirements</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by law name, requirement, or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-4">
        {grouped.map(group => (
          <Card key={group.category}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{group.category}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-0">
              {group.laws.map(law => (
                <Collapsible key={law.id}>
                  <CollapsibleTrigger className="w-full" id={law.id}>
                    <div className="flex items-center justify-between py-2.5 px-3 hover:bg-muted/50 rounded-lg transition-colors">
                      <div className="flex items-center gap-2 text-left">
                        <span className="text-sm font-medium">{law.name}</span>
                        <Badge variant="secondary" className="text-[10px]">{law.whoApplies}</Badge>
                      </div>
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 pb-3 space-y-3 text-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">What's Required</p>
                          <p className="text-foreground">{law.whatRequired}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Filing Deadline</p>
                          <p className="text-foreground">{law.deadline}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Penalty</p>
                          <p className="text-destructive font-medium">{law.penalty}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">How to Comply</p>
                          <p className="text-foreground">{law.howToComply}</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <a href={law.officialLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          Official Source <ExternalLink className="w-3 h-3" />
                        </a>
                        {law.filingPortal && (
                          <a href={law.filingPortal} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            Filing Portal <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
