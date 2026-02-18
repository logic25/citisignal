/**
 * NYC Local Law Applicability Engine
 * Determines which Local Laws apply to a property based on its characteristics.
 * Covers 43 distinct violation-generating compliance obligations.
 */

export interface PropertyForCompliance {
  id: string;
  bbl?: string | null;
  stories?: number | null;
  gross_sqft?: number | null;
  building_area_sqft?: number | null;
  dwelling_units?: number | null;
  has_gas?: boolean | null;
  has_elevator?: boolean | null;
  has_boiler?: boolean | null;
  has_sprinkler?: boolean | null;
  has_retaining_wall?: boolean | null;
  has_parking_structure?: boolean | null;
  has_cooling_tower?: boolean | null;
  has_water_tank?: boolean | null;
  has_fire_alarm?: boolean | null;
  has_standpipe?: boolean | null;
  has_place_of_assembly?: boolean | null;
  is_food_establishment?: boolean | null;
  has_backflow_device?: boolean | null;
  burns_no4_oil?: boolean | null;
  building_class?: string | null;
  occupancy_group?: string | null;
  year_built?: number | null;
  height_ft?: number | null;
  is_landmark?: boolean | null;
  number_of_buildings?: number | null;
  primary_use_group?: string | null;
  use_type?: string | null;
}

export type ComplianceCategory =
  | 'DOB — Facade, Exterior & Structural'
  | 'DOB — Energy & Emissions'
  | 'DOB — Gas Safety'
  | 'DOB — Elevators & Mechanical'
  | 'DOB — Fire Safety & Sprinklers'
  | 'DOHMH — Cooling Towers & Water'
  | 'DEP — Water & Environmental'
  | 'HPD — Residential Housing'
  | 'FDNY — Fire Safety'
  | 'Multi-Agency & Other';

export interface LocalLawRequirement {
  local_law: string;
  requirement_name: string;
  description: string;
  applies: boolean;
  applicability_reason: string;
  cycle_year: number | null;
  next_due_date: string | null;
  filing_deadline: string | null;
  penalty_amount: number | null;
  penalty_description: string | null;
  status: 'pending' | 'compliant' | 'overdue' | 'exempt' | 'due_soon';
  learn_more_url: string;
  tooltip: string;
  category: ComplianceCategory;
}

// ============================================================
// HELPERS
// ============================================================

function getBlockLastDigit(bbl: string | null | undefined): number | null {
  if (!bbl || bbl.length < 6) return null;
  const block = parseInt(bbl.substring(1, 6), 10);
  return isNaN(block) ? null : block % 10;
}

function effectiveSqft(p: PropertyForCompliance): number {
  return p.building_area_sqft || p.gross_sqft || 0;
}

function isResidential(p: PropertyForCompliance): boolean {
  const bc = p.building_class?.charAt(0)?.toUpperCase();
  if (bc && ['A', 'B', 'C', 'D', 'R', 'S'].includes(bc)) return true;
  if (p.dwelling_units && p.dwelling_units > 0) return true;
  const use = (p.use_type || p.primary_use_group || '').toLowerCase();
  return use.includes('resid') || use.includes('dwelling');
}

function isCommercialOrOffice(p: PropertyForCompliance): boolean {
  const bc = p.building_class?.charAt(0)?.toUpperCase();
  if (bc && ['O', 'L', 'K', 'E'].includes(bc)) return true;
  const use = (p.use_type || p.primary_use_group || '').toLowerCase();
  return use.includes('office') || use.includes('commercial');
}

function isMultipleDwelling(p: PropertyForCompliance): boolean {
  // NYC MDL defines multiple dwelling as 3+ independent dwelling units
  return (p.dwelling_units ?? 0) >= 3;
}

function calcStatus(applies: boolean, nextDue: string | null, monthsThreshold = 12): LocalLawRequirement['status'] {
  if (!applies) return 'exempt';
  if (!nextDue) return 'pending';
  const now = new Date();
  const dueDate = new Date(nextDue);
  if (dueDate < now) return 'overdue';
  const monthsAway = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
  return monthsAway <= monthsThreshold ? 'due_soon' : 'pending';
}

function annualDue(month: number, day: number): string {
  const y = new Date().getFullYear();
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ============================================================
// CATEGORY 1: DOB — FACADE, EXTERIOR & STRUCTURAL
// ============================================================

function checkLL11(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Facade, Exterior & Structural';
  const stories = p.stories || 0;
  const applies = stories > 6;
  const blockDigit = getBlockLastDigit(p.bbl);

  let cycleYear: number | null = null;
  let nextDue: string | null = null;

  if (applies && blockDigit !== null) {
    // Cycle 10: 5-year sub-cycles based on block last digit
    if (blockDigit <= 3) { cycleYear = 2023; nextDue = '2023-02-21'; }
    else if (blockDigit <= 6) { cycleYear = 2026; nextDue = '2026-02-21'; }
    else { cycleYear = 2029; nextDue = '2029-02-21'; }
  }

  return {
    local_law: 'LL11', requirement_name: 'Facade Inspection (FISP)', category: CAT,
    description: 'Periodic facade inspection for buildings >6 stories. 5-year cycles within Cycle 10. Inspection by QEWI.',
    applies,
    applicability_reason: applies
      ? `Building has ${stories} stories (>6). Block digit ${blockDigit} → Sub-cycle ${blockDigit !== null && blockDigit <= 3 ? 'A' : blockDigit !== null && blockDigit <= 6 ? 'B' : 'C'}.`
      : `Building has ${stories || 'unknown'} stories. LL11 requires >6 stories.`,
    cycle_year: cycleYear, next_due_date: nextDue, filing_deadline: nextDue,
    penalty_amount: applies ? 1000 : null,
    penalty_description: applies ? '$1,000/month for late filing; $1,000/month for failure to correct unsafe conditions' : null,
    status: calcStatus(applies, nextDue),
    learn_more_url: 'https://www.nyc.gov/site/buildings/safety/facade-inspection-safety-program-fisp.page',
    tooltip: 'Buildings >6 stories must have facades inspected every 5 years as part of Cycle 10.',
  };
}

function checkLL126Parapet(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Facade, Exterior & Structural';
  // Parapets are relevant for buildings with street-facing facades; exclude small 1-2 family homes
  const applies = (p.stories ?? 0) >= 3 || (p.dwelling_units ?? 0) >= 3;
  const nextDue = annualDue(12, 31);

  return {
    local_law: 'LL126/21', requirement_name: 'Annual Parapet Inspection', category: CAT,
    description: 'All buildings with parapet walls facing a public right-of-way must perform annual observation. No filing required — retain records.',
    applies,
    applicability_reason: 'All buildings with parapet walls. Default applies to all buildings.',
    cycle_year: new Date().getFullYear(), next_due_date: nextDue, filing_deadline: null,
    penalty_amount: 10000,
    penalty_description: 'Min $1,250, max $10,000 for failure to provide report upon request',
    status: calcStatus(applies, nextDue, 3),
    learn_more_url: 'https://www.nyc.gov/site/buildings/safety/parapet-inspections.page',
    tooltip: 'Annual parapet observation required. Unsafe conditions must be corrected within 90 days.',
  };
}

function checkLL126PIPS(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Facade, Exterior & Structural';
  const applies = !!p.has_parking_structure;

  return {
    local_law: 'LL126/08', requirement_name: 'Parking Structure Inspection (PIPS)', category: CAT,
    description: 'Every 6 years (3 two-year sub-cycles by CD). Annual checklist after initial filing. Inspection by QPSI.',
    applies,
    applicability_reason: applies ? 'Building has a parking structure.' : 'No parking structure.',
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: applies ? 17000 : null,
    penalty_description: applies ? 'Up to $17,000/year for non-compliance' : null,
    status: !applies ? 'exempt' : 'pending',
    learn_more_url: 'https://www.nyc.gov/site/buildings/safety/parking-structures.page',
    tooltip: '6-year inspection cycle for parking structures with annual checklists.',
  };
}

function checkLL37(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Facade, Exterior & Structural';
  const applies = !!p.has_retaining_wall;

  return {
    local_law: 'LL37', requirement_name: 'Retaining Wall Inspection', category: CAT,
    description: 'Retaining walls ≥10 ft facing public right-of-way must be inspected every 5 years by QRWI.',
    applies,
    applicability_reason: applies ? 'Building has retaining wall.' : 'No retaining wall.',
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: applies ? 1000 : null,
    penalty_description: applies ? 'Up to $1,000/year for non-compliance' : null,
    status: !applies ? 'exempt' : 'pending',
    learn_more_url: 'https://www.nyc.gov/site/buildings/safety/retaining-wall-compliance-filings.page',
    tooltip: '5-year inspection cycle for retaining walls ≥10 ft facing public right-of-way.',
  };
}

// ============================================================
// CATEGORY 2: DOB — ENERGY & EMISSIONS
// ============================================================

function checkLL84(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Energy & Emissions';
  const sqft = effectiveSqft(p);
  const applies = sqft >= 25000;
  const nextDue = annualDue(5, 1);

  return {
    local_law: 'LL84', requirement_name: 'Energy Benchmarking', category: CAT,
    description: 'Annual energy and water benchmarking via EPA Portfolio Manager for buildings ≥25,000 SF.',
    applies,
    applicability_reason: applies ? `${sqft.toLocaleString()} SF (≥25,000).` : `${sqft.toLocaleString()} SF (<25,000).`,
    cycle_year: new Date().getFullYear(), next_due_date: nextDue, filing_deadline: nextDue,
    penalty_amount: applies ? 500 : null,
    penalty_description: applies ? '$500 first missed deadline; $500/quarter thereafter' : null,
    status: calcStatus(applies, nextDue, 3),
    learn_more_url: 'https://www.nyc.gov/site/buildings/codes/benchmarking.page',
    tooltip: 'Annual benchmarking due May 1 for buildings ≥25,000 SF.',
  };
}

function checkLL97(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Energy & Emissions';
  const sqft = effectiveSqft(p);
  const applies = sqft >= 25000;
  const currentYear = new Date().getFullYear();
  const cycleYear = currentYear <= 2029 ? 2025 : 2030;
  const nextDue = `${cycleYear}-05-01`;

  return {
    local_law: 'LL97', requirement_name: 'Carbon Emissions Limits', category: CAT,
    description: 'Building carbon emission limits. Period 1 (2024-2029): moderate limits. Period 2 (2030+): stricter limits.',
    applies,
    applicability_reason: applies ? `${sqft.toLocaleString()} SF (≥25,000).` : `${sqft.toLocaleString()} SF (<25,000).`,
    cycle_year: cycleYear, next_due_date: nextDue, filing_deadline: nextDue,
    penalty_amount: applies ? 268 : null,
    penalty_description: applies ? '$268/metric ton CO₂ over limit; $0.50/SF/month late reporting; up to $500,000 for false filings' : null,
    status: calcStatus(applies, nextDue),
    learn_more_url: 'https://www.nyc.gov/site/buildings/codes/ll97.page',
    tooltip: 'Carbon emission limits with $268/ton penalties. First report due May 2025.',
  };
}

function checkLL87(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Energy & Emissions';
  const sqft = effectiveSqft(p);
  const applies = sqft >= 25000;
  const blockDigit = getBlockLastDigit(p.bbl);
  let cycleYear: number | null = null;
  let nextDue: string | null = null;

  if (applies && blockDigit !== null) {
    const baseYear = 2020 + blockDigit;
    const currentYear = new Date().getFullYear();
    cycleYear = baseYear;
    while (cycleYear < currentYear - 1) cycleYear += 10;
    nextDue = `${cycleYear}-12-31`;
  }

  return {
    local_law: 'LL87', requirement_name: 'Energy Audit & Retro-Commissioning', category: CAT,
    description: 'Energy audit and retro-commissioning every 10 years for buildings ≥25,000 SF.',
    applies,
    applicability_reason: applies
      ? `${sqft.toLocaleString()} SF (≥25,000). Block digit ${blockDigit} → due year ${cycleYear}.`
      : `${sqft.toLocaleString()} SF (<25,000).`,
    cycle_year: cycleYear, next_due_date: nextDue, filing_deadline: nextDue,
    penalty_amount: applies ? 3000 : null,
    penalty_description: applies ? '$3,000 first year; $5,000/year thereafter' : null,
    status: calcStatus(applies, nextDue),
    learn_more_url: 'https://www.nyc.gov/site/buildings/codes/energy-audits.page',
    tooltip: '10-year energy audit cycle based on block number.',
  };
}

function checkLL88(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Energy & Emissions';
  const sqft = effectiveSqft(p);
  const applies = sqft >= 25000; // commercial spaces AND common areas of residential

  return {
    local_law: 'LL88', requirement_name: 'Lighting Upgrades & Sub-Metering', category: CAT,
    description: 'Buildings ≥25,000 SF must upgrade lighting in commercial spaces and common areas. Sub-meters for non-residential tenant spaces >5,000 SF.',
    applies,
    applicability_reason: applies
      ? `${sqft.toLocaleString()} SF (≥25,000). Lighting/sub-metering required.`
      : `${sqft.toLocaleString()} SF (<25,000).`,
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: applies ? 1500 : null,
    penalty_description: applies ? 'DOB violation; fines for non-compliance' : null,
    status: !applies ? 'exempt' : 'pending',
    learn_more_url: 'https://accelerator.nyc/building-laws',
    tooltip: 'Lighting upgrades and sub-metering for buildings ≥25,000 SF. Compliance deadline was Jan 1, 2025.',
  };
}

function checkLL33EnergyGrade(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Energy & Emissions';
  const sqft = effectiveSqft(p);
  const applies = sqft >= 25000;
  const nextDue = annualDue(10, 31);

  return {
    local_law: 'LL33/95', requirement_name: 'Energy Efficiency Grade Posting', category: CAT,
    description: 'Annual letter grade (A-D, F) based on ENERGY STAR score must be posted near each public entrance by Oct 31.',
    applies,
    applicability_reason: applies ? `${sqft.toLocaleString()} SF (≥25,000).` : `${sqft.toLocaleString()} SF (<25,000).`,
    cycle_year: new Date().getFullYear(), next_due_date: nextDue, filing_deadline: nextDue,
    penalty_amount: applies ? 1250 : null,
    penalty_description: applies ? '$1,250 per violation for failure to post' : null,
    status: calcStatus(applies, nextDue, 3),
    learn_more_url: 'https://www.nyc.gov/site/buildings/codes/ll33-faqs.page',
    tooltip: 'Post energy efficiency letter grade near each public entrance by Oct 31 annually.',
  };
}

function checkLL32(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Energy & Emissions';
  const applies = !!p.burns_no4_oil;

  return {
    local_law: 'LL32', requirement_name: 'No. 4 Oil Phaseout', category: CAT,
    description: 'All buildings burning No. 4 oil must convert to No. 2 oil, natural gas, or electric by July 1, 2027.',
    applies,
    applicability_reason: applies ? 'Building burns No. 4 oil.' : 'Building does not burn No. 4 oil.',
    cycle_year: 2027, next_due_date: applies ? '2027-07-01' : null, filing_deadline: applies ? '2027-07-01' : null,
    penalty_amount: applies ? 10000 : null,
    penalty_description: applies ? 'Up to $10,000 per violation' : null,
    status: calcStatus(applies, applies ? '2027-07-01' : null),
    learn_more_url: 'https://accelerator.nyc/no.4-phaseout',
    tooltip: 'No. 4 oil must be phased out by July 2027.',
  };
}

function checkLL92_94(_p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Energy & Emissions';
  return {
    local_law: 'LL92/94', requirement_name: 'Green Roof / Solar Requirements', category: CAT,
    description: 'New buildings and major roof renovations must include solar PV, green roof, or combination.',
    applies: false,
    applicability_reason: 'Event-triggered: applies only at time of new construction or major roof renovation.',
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: null, penalty_description: 'DOB violation for non-compliant roof at time of permit/CO',
    status: 'exempt',
    learn_more_url: 'https://www.nyc.gov/site/buildings/codes/ll92-solar-green-roofs.page',
    tooltip: 'Applies to new construction and major roof renovations only.',
  };
}

function checkLL85(_p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Energy & Emissions';
  return {
    local_law: 'LL85', requirement_name: 'Energy Code Compliance', category: CAT,
    description: 'All renovation/alteration projects must comply with NYCECC.',
    applies: false,
    applicability_reason: 'Event-triggered: applies at time of renovation/alteration.',
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: null, penalty_description: 'DOB violation for non-compliant work',
    status: 'exempt',
    learn_more_url: 'https://accelerator.nyc/building-laws',
    tooltip: 'Applies to renovation/alteration projects only.',
  };
}

function checkLL154(_p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Energy & Emissions';
  return {
    local_law: 'LL154', requirement_name: 'All-Electric Law (New Construction)', category: CAT,
    description: 'Bans gas/oil-fired appliances in new buildings. ≤7 stories: 2024; all others: 2027.',
    applies: false,
    applicability_reason: 'Event-triggered: applies to new construction only.',
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: null, penalty_description: 'DOB violation for non-compliant new construction',
    status: 'exempt',
    learn_more_url: 'https://accelerator.nyc/building-laws',
    tooltip: 'Applies to new construction only.',
  };
}

// ============================================================
// CATEGORY 3: DOB — GAS SAFETY
// ============================================================

function checkLL152(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Gas Safety';
  const applies = !!p.has_gas;
  const blockDigit = getBlockLastDigit(p.bbl);
  let cycleYear: number | null = null;
  let nextDue: string | null = null;

  if (applies && blockDigit !== null) {
    if (blockDigit <= 3) { cycleYear = 2025; }
    else if (blockDigit <= 6) { cycleYear = 2027; }
    else { cycleYear = 2029; }
    nextDue = `${cycleYear}-12-31`;
  }

  return {
    local_law: 'LL152', requirement_name: 'Gas Piping Inspection', category: CAT,
    description: 'Periodic inspection of gas piping by LMP every 4 years. Even buildings without gas must file "no gas piping" cert.',
    applies,
    applicability_reason: applies ? 'Building has gas service.' : 'No gas service.',
    cycle_year: cycleYear, next_due_date: nextDue, filing_deadline: nextDue,
    penalty_amount: applies ? 10000 : null,
    penalty_description: applies ? 'Up to $5,000–$10,000; hazardous conditions can trigger gas shutoff' : null,
    status: calcStatus(applies, nextDue),
    learn_more_url: 'https://www.nyc.gov/site/buildings/property-or-business-owner/gas-piping-inspections.page',
    tooltip: '4-year gas piping inspection cycle by Licensed Master Plumber.',
  };
}

function checkLL157(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Gas Safety';
  const applies = isResidential(p) && !!p.has_gas;

  return {
    local_law: 'LL157', requirement_name: 'Natural Gas Detector Installation', category: CAT,
    description: 'All residential buildings with gas must install natural gas detectors in every dwelling unit by May 1, 2025.',
    applies,
    applicability_reason: applies ? 'Residential building with gas service.' : 'Not a residential building with gas service.',
    cycle_year: 2025, next_due_date: applies ? '2025-05-01' : null, filing_deadline: applies ? '2025-05-01' : null,
    penalty_amount: applies ? 2500 : null,
    penalty_description: applies ? 'HPD/DOB violation' : null,
    status: calcStatus(applies, applies ? '2025-05-01' : null),
    learn_more_url: 'https://www.nyc.gov/site/hpd/services-and-information/natural-gas-detectors.page',
    tooltip: 'Gas detectors required in every dwelling unit. Deadline May 1, 2025.',
  };
}

function checkLL159(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Gas Safety';
  const applies = !!p.has_gas;

  return {
    local_law: 'LL159', requirement_name: 'Gas Leak Notice Posting', category: CAT,
    description: 'All buildings with gas must post a "Suspected Gas Leaks Notice" in a visible location at all times.',
    applies,
    applicability_reason: applies ? 'Building has gas service.' : 'No gas service.',
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: applies ? 1000 : null,
    penalty_description: applies ? 'DOB/HPD violation' : null,
    status: !applies ? 'exempt' : 'pending',
    learn_more_url: 'https://www.nyc.gov/site/buildings/safety/gas-piping-and-gas-safety.page',
    tooltip: 'Ongoing: post gas leak notice at all times.',
  };
}

function checkLL33PostGas(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Gas Safety';
  const applies = !!p.has_gas;

  return {
    local_law: 'LL33/95 Post', requirement_name: 'Post-Gas Incident Reporting', category: CAT,
    description: 'After any gas-related incident, must report to DOB and utility immediately and inspect piping within 90 days.',
    applies,
    applicability_reason: applies ? 'Building has gas service.' : 'No gas service.',
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: applies ? 10000 : null,
    penalty_description: applies ? 'DOB violation; potential criminal liability' : null,
    status: !applies ? 'exempt' : 'pending',
    learn_more_url: 'https://www.nyc.gov/site/buildings/safety/gas-piping-and-gas-safety.page',
    tooltip: 'Event-triggered: report gas incidents to DOB and utility immediately.',
  };
}

// ============================================================
// CATEGORY 4: DOB — ELEVATORS & MECHANICAL
// ============================================================

function checkLL62(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Elevators & Mechanical';
  const applies = !!p.has_elevator;
  const nextDue = annualDue(12, 31);

  return {
    local_law: 'LL62', requirement_name: 'Elevator Inspection & Testing', category: CAT,
    description: 'Annual CAT1 test + 5-year CAT5 test for traction; CAT3 every 3 years for hydraulic.',
    applies,
    applicability_reason: applies ? 'Building has elevator(s).' : 'No elevators.',
    cycle_year: new Date().getFullYear(), next_due_date: nextDue, filing_deadline: nextDue,
    penalty_amount: applies ? 5000 : null,
    penalty_description: applies ? 'DOB violation; potential shutdown order; civil penalties per device' : null,
    status: calcStatus(applies, nextDue, 3),
    learn_more_url: 'https://www.nyc.gov/site/buildings/safety/elevators.page',
    tooltip: 'Annual CAT1 and periodic CAT5 testing for elevators.',
  };
}

function checkBoilerInspection(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Elevators & Mechanical';
  const applies = !!p.has_boiler;
  const nextDue = annualDue(12, 31);

  return {
    local_law: 'Boiler', requirement_name: 'Boiler Inspection (Annual)', category: CAT,
    description: 'Annual inspection of high-pressure and low-pressure boilers by DOB-licensed inspector. Filed via DOB NOW.',
    applies,
    applicability_reason: applies ? 'Building has boiler(s).' : 'No boilers.',
    cycle_year: new Date().getFullYear(), next_due_date: nextDue, filing_deadline: nextDue,
    penalty_amount: applies ? 5000 : null,
    penalty_description: applies ? 'DOB violation; potential shutdown for unsafe conditions' : null,
    status: calcStatus(applies, nextDue, 3),
    learn_more_url: 'https://www.nyc.gov/site/buildings/safety/boilers.page',
    tooltip: 'Annual boiler inspection by DOB-licensed inspector.',
  };
}

// ============================================================
// CATEGORY 5: DOB — FIRE SAFETY & SPRINKLERS
// ============================================================

function checkLL26(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Fire Safety & Sprinklers';
  const stories = p.stories || 0;
  const applies = stories > 7 && isCommercialOrOffice(p);

  return {
    local_law: 'LL26', requirement_name: 'Sprinkler Retrofit', category: CAT,
    description: 'Pre-1973 non-fireproof commercial buildings ≥100 ft must be fully sprinklered.',
    applies,
    applicability_reason: applies ? `Commercial building with ${stories} stories.` : 'Not a qualifying high-rise commercial building.',
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: applies ? 5000 : null,
    penalty_description: applies ? 'DOB violation; potential vacate order' : null,
    status: !applies ? 'exempt' : (p.has_sprinkler ? 'compliant' : 'overdue'),
    learn_more_url: 'https://www.nyc.gov/site/buildings/safety/sprinkler-requirements.page',
    tooltip: 'Sprinkler retrofit for high-rise commercial buildings.',
  };
}

function checkLL77Crane(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Fire Safety & Sprinklers';
  const stories = p.stories || 0;
  const applies = stories > 15;

  return {
    local_law: 'LL77/17', requirement_name: 'Crane Wind Action Plan', category: CAT,
    description: 'Construction sites with cranes must have documented wind action plans.',
    applies,
    applicability_reason: applies
      ? `${stories} stories (>15). May require crane wind plan during construction.`
      : 'Typically applies to tall construction sites.',
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: applies ? 25000 : null,
    penalty_description: applies ? 'DOB violation; stop work order' : null,
    status: !applies ? 'exempt' : 'pending',
    learn_more_url: 'https://www.nyc.gov/site/buildings/safety/cranes-derricks.page',
    tooltip: 'Wind action plans for crane operations on construction sites.',
  };
}

function checkFireSafetyDoor(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOB — Fire Safety & Sprinklers';
  const applies = isResidential(p) && isMultipleDwelling(p);

  return {
    local_law: 'LL10/99', requirement_name: 'Fire Safety Door Notice', category: CAT,
    description: 'Fire safety notice decal required on inside of every apartment door. Annual confirmation/replacement.',
    applies,
    applicability_reason: applies ? 'Multiple dwelling (residential).' : 'Not a multiple dwelling.',
    cycle_year: new Date().getFullYear(), next_due_date: annualDue(12, 31), filing_deadline: null,
    penalty_amount: applies ? 1000 : null,
    penalty_description: applies ? 'HPD/DOB violation' : null,
    status: calcStatus(applies, annualDue(12, 31), 3),
    learn_more_url: 'https://www.nyc.gov/site/fdny/business/all-businesses/fire-safety-education-notice.page',
    tooltip: 'Annual fire safety notice on apartment doors.',
  };
}

// ============================================================
// CATEGORY 6: DOHMH — COOLING TOWERS & WATER
// ============================================================

function checkCoolingTower(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOHMH — Cooling Towers & Water';
  const applies = !!p.has_cooling_tower;
  const nextDue = annualDue(11, 1);

  return {
    local_law: 'LL77/15 CT', requirement_name: 'Cooling Tower Certification', category: CAT,
    description: 'Quarterly inspection + testing + twice-annual cleaning. Annual certification due Nov 1 to DOHMH.',
    applies,
    applicability_reason: applies ? 'Building has cooling tower(s).' : 'No cooling towers.',
    cycle_year: new Date().getFullYear(), next_due_date: nextDue, filing_deadline: nextDue,
    penalty_amount: applies ? 10000 : null,
    penalty_description: applies ? '$500–$2,000/violation/day; up to $10,000 for failure to certify' : null,
    status: calcStatus(applies, nextDue, 3),
    learn_more_url: 'https://www.nyc.gov/site/doh/business/permits-and-licenses/cooling-tower-registration.page',
    tooltip: 'Annual cooling tower certification due Nov 1. Quarterly inspections required.',
  };
}

function checkWaterTank(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DOHMH — Cooling Towers & Water';
  const applies = !!p.has_water_tank;
  const nextDue = annualDue(1, 15);

  return {
    local_law: 'LL76', requirement_name: 'Drinking Water Tank Inspection', category: CAT,
    description: 'Annual inspection of rooftop drinking water tanks. Filing with DOHMH by Jan 15.',
    applies,
    applicability_reason: applies ? 'Building has rooftop water tank.' : 'No water tank.',
    cycle_year: new Date().getFullYear(), next_due_date: nextDue, filing_deadline: nextDue,
    penalty_amount: applies ? 2000 : null,
    penalty_description: applies ? '$200–$2,000/violation/tank/year' : null,
    status: calcStatus(applies, nextDue, 3),
    learn_more_url: 'https://www.nyc.gov/site/doh/business/permits-and-licenses/rooftop-drinking-water-tank-inspection-results.page',
    tooltip: 'Annual water tank inspection with results posted publicly.',
  };
}

// ============================================================
// CATEGORY 7: DEP — WATER & ENVIRONMENTAL
// ============================================================

function checkBackflow(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DEP — Water & Environmental';
  const applies = !!p.has_backflow_device;
  const nextDue = annualDue(12, 31);

  return {
    local_law: 'DEP Backflow', requirement_name: 'Backflow Prevention Device Testing', category: CAT,
    description: 'Annual testing of backflow prevention devices by NYS DOH-certified tester. Report filed with DEP.',
    applies,
    applicability_reason: applies ? 'Building has backflow prevention device.' : 'No backflow device.',
    cycle_year: new Date().getFullYear(), next_due_date: nextDue, filing_deadline: nextDue,
    penalty_amount: applies ? 1000 : null,
    penalty_description: applies ? 'Up to $1,000 per ECB violation; potential water disconnection' : null,
    status: calcStatus(applies, nextDue, 3),
    learn_more_url: 'https://www.nyc.gov/site/dep/about/cross-connection-controls.page',
    tooltip: 'Annual backflow prevention device testing.',
  };
}

function checkGreaseTrap(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'DEP — Water & Environmental';
  const applies = !!p.is_food_establishment;

  return {
    local_law: 'DEP Grease', requirement_name: 'Grease Trap / Interceptor Maintenance', category: CAT,
    description: 'Must be cleaned/pumped before reaching 25% capacity (typically monthly to quarterly).',
    applies,
    applicability_reason: applies ? 'Food establishment.' : 'Not a food establishment.',
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: applies ? 10000 : null,
    penalty_description: applies ? 'DEP violation; ECB summons; $1,000–$10,000' : null,
    status: !applies ? 'exempt' : 'pending',
    learn_more_url: 'https://www.nyc.gov/site/dep/water/grease.page',
    tooltip: 'Ongoing grease trap maintenance for food establishments.',
  };
}

// ============================================================
// CATEGORY 8: HPD — RESIDENTIAL HOUSING
// ============================================================

function checkLL1LeadPaint(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'HPD — Residential Housing';
  const applies = isResidential(p) && (p.year_built ?? 2000) < 1960;
  const nextDue = annualDue(1, 16);

  return {
    local_law: 'LL1', requirement_name: 'Lead Paint (Childhood Lead Prevention)', category: CAT,
    description: 'Pre-1960 residential: annual inquiry to tenants re children <6. XRF inspection required.',
    applies,
    applicability_reason: applies
      ? `Residential, built ${p.year_built} (pre-1960).`
      : p.year_built ? `Built ${p.year_built} (post-1960) or not residential.` : 'Year built unknown or not residential.',
    cycle_year: new Date().getFullYear(), next_due_date: nextDue, filing_deadline: nextDue,
    penalty_amount: applies ? 5000 : null,
    penalty_description: applies ? 'HPD Class C (immediately hazardous) violations; civil penalties; litigation exposure' : null,
    status: calcStatus(applies, nextDue, 3),
    learn_more_url: 'https://www.nyc.gov/site/hpd/services-and-information/lead-based-paint.page',
    tooltip: 'Pre-1960 buildings: annual lead paint inquiry and XRF inspection.',
  };
}

function checkLL55(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'HPD — Residential Housing';
  const applies = isMultipleDwelling(p) && (p.dwelling_units ?? 0) >= 3;

  return {
    local_law: 'LL55', requirement_name: 'Indoor Allergen Hazards', category: CAT,
    description: 'Annual inspection of all units and common areas for mold, mice, cockroaches, rats. IPM practices required.',
    applies,
    applicability_reason: applies ? `Multiple dwelling (${p.dwelling_units} units ≥3).` : 'Not a qualifying multiple dwelling.',
    cycle_year: new Date().getFullYear(), next_due_date: annualDue(12, 31), filing_deadline: null,
    penalty_amount: applies ? 10000 : null,
    penalty_description: applies ? '$50–$150/violation + $125/violation/day; up to $10,000' : null,
    status: calcStatus(applies, annualDue(12, 31), 3),
    learn_more_url: 'https://www.nyc.gov/site/hpd/services-and-information/indoor-allergen-hazards-mold-and-pests.page',
    tooltip: 'Annual inspection for indoor allergens in multiple dwellings.',
  };
}

function checkBedbugReporting(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'HPD — Residential Housing';
  const applies = isMultipleDwelling(p);
  const nextDue = annualDue(12, 31);

  return {
    local_law: 'Admin Code', requirement_name: 'Bedbug Annual Reporting', category: CAT,
    description: 'Annual filing with HPD (December) reporting infestations and eradication measures for prior 12 months.',
    applies,
    applicability_reason: applies ? 'Multiple dwelling.' : 'Not a multiple dwelling.',
    cycle_year: new Date().getFullYear(), next_due_date: nextDue, filing_deadline: nextDue,
    penalty_amount: applies ? 1000 : null,
    penalty_description: applies ? 'HPD violation for failure to file' : null,
    status: calcStatus(applies, nextDue, 3),
    learn_more_url: 'https://www.nyc.gov/site/hpd/services-and-information/bed-bugs.page',
    tooltip: 'Annual bedbug report filed with HPD in December.',
  };
}

function checkWindowGuard(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'HPD — Residential Housing';
  const applies = isResidential(p) && (p.dwelling_units ?? 0) >= 3;
  const nextDue = annualDue(1, 16);

  return {
    local_law: 'Admin Code', requirement_name: 'Window Guard Annual Notice', category: CAT,
    description: 'Annual notice to all tenants about window guard rights (January 1–16).',
    applies,
    applicability_reason: applies ? `Residential with ${p.dwelling_units} units (≥3).` : 'Not qualifying residential.',
    cycle_year: new Date().getFullYear(), next_due_date: nextDue, filing_deadline: nextDue,
    penalty_amount: applies ? 500 : null,
    penalty_description: applies ? 'HPD violation' : null,
    status: calcStatus(applies, nextDue, 3),
    learn_more_url: 'https://www.nyc.gov/site/hpd/services-and-information/window-guards.page',
    tooltip: 'Annual window guard notice to tenants in January.',
  };
}

function checkHPDRegistration(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'HPD — Residential Housing';
  const applies = isMultipleDwelling(p);

  return {
    local_law: 'HPD Reg', requirement_name: 'HPD Property Registration', category: CAT,
    description: 'All multiple dwellings must maintain current registration with HPD including managing agent.',
    applies,
    applicability_reason: applies ? 'Multiple dwelling.' : 'Not a multiple dwelling.',
    cycle_year: new Date().getFullYear(), next_due_date: annualDue(9, 1), filing_deadline: annualDue(9, 1),
    penalty_amount: applies ? 500 : null,
    penalty_description: applies ? 'HPD violation; blocks certain filings; can trigger AEP' : null,
    status: calcStatus(applies, annualDue(9, 1), 3),
    learn_more_url: 'https://www.nyc.gov/site/hpd/services-and-information/register-your-property.page',
    tooltip: 'Annual HPD registration for multiple dwellings.',
  };
}

function checkHeatHotWater(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'HPD — Residential Housing';
  const applies = isResidential(p);

  return {
    local_law: 'MDL/HMC', requirement_name: 'Heat / Hot Water Requirements', category: CAT,
    description: 'Heat: 68°F when outdoor <55°F (day), 62°F at night (Oct 1–May 31). Hot water: 120°F minimum, 24/7/365.',
    applies,
    applicability_reason: applies ? 'Residential building.' : 'Not residential.',
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: applies ? 5000 : null,
    penalty_description: applies ? 'HPD Class C violation; $500–$5,000; emergency repairs billed back to owner' : null,
    status: !applies ? 'exempt' : 'pending',
    learn_more_url: 'https://www.nyc.gov/site/hpd/services-and-information/heat-and-hot-water.page',
    tooltip: 'Ongoing: heat season Oct 1–May 31. Hot water 120°F 24/7.',
  };
}

function checkSmokeCO(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'HPD — Residential Housing';
  const applies = isResidential(p);

  return {
    local_law: 'LL10/07', requirement_name: 'Smoke & CO Detector Compliance', category: CAT,
    description: 'Owners must install and maintain smoke and CO detectors in every unit. Replace upon expiration.',
    applies,
    applicability_reason: applies ? 'Residential building.' : 'Not residential.',
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: applies ? 1000 : null,
    penalty_description: applies ? 'HPD/FDNY violation' : null,
    status: !applies ? 'exempt' : 'pending',
    learn_more_url: 'https://www.nyc.gov/site/hpd/services-and-information/smoke-detectors.page',
    tooltip: 'Ongoing: maintain smoke and CO detectors in all dwelling units.',
  };
}

// ============================================================
// CATEGORY 9: FDNY — FIRE SAFETY
// ============================================================

function checkFireAlarm(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'FDNY — Fire Safety';
  const applies = !!p.has_fire_alarm;
  const nextDue = annualDue(12, 31);

  return {
    local_law: 'FDNY', requirement_name: 'Fire Alarm System Inspection', category: CAT,
    description: 'Annual inspection and testing by FDNY-approved company. COF holders required for monitoring.',
    applies,
    applicability_reason: applies ? 'Building has fire alarm system.' : 'No fire alarm system.',
    cycle_year: new Date().getFullYear(), next_due_date: nextDue, filing_deadline: nextDue,
    penalty_amount: applies ? 5000 : null,
    penalty_description: applies ? 'FDNY violation; potential closure order for places of assembly' : null,
    status: calcStatus(applies, nextDue, 3),
    learn_more_url: 'https://www.nyc.gov/site/fdny/business/all-businesses/fire-alarm-systems.page',
    tooltip: 'Annual fire alarm inspection by FDNY-approved company.',
  };
}

function checkStandpipe(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'FDNY — Fire Safety';
  const applies = !!p.has_standpipe;
  const nextDue = annualDue(12, 31);

  return {
    local_law: 'FDNY', requirement_name: 'Standpipe Inspection & Testing', category: CAT,
    description: 'Annual hydrostatic test + 5-year flow test. Inspected by FDNY-approved contractor.',
    applies,
    applicability_reason: applies ? 'Building has standpipe system.' : 'No standpipe system.',
    cycle_year: new Date().getFullYear(), next_due_date: nextDue, filing_deadline: nextDue,
    penalty_amount: applies ? 5000 : null,
    penalty_description: applies ? 'FDNY violation; ECB summons' : null,
    status: calcStatus(applies, nextDue, 3),
    learn_more_url: 'https://www.nyc.gov/site/fdny/business/all-businesses/standpipe-requirements.page',
    tooltip: 'Annual standpipe hydrostatic test plus 5-year flow test.',
  };
}

function checkSprinklerMaintenance(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'FDNY — Fire Safety';
  const applies = !!p.has_sprinkler;
  const nextDue = annualDue(12, 31);

  return {
    local_law: 'FDNY', requirement_name: 'Sprinkler System Maintenance', category: CAT,
    description: 'Annual inspection, testing, and maintenance per NFPA 25. Separate from LL26 retrofit.',
    applies,
    applicability_reason: applies ? 'Building has sprinkler system.' : 'No sprinkler system.',
    cycle_year: new Date().getFullYear(), next_due_date: nextDue, filing_deadline: nextDue,
    penalty_amount: applies ? 5000 : null,
    penalty_description: applies ? 'FDNY violation; DOB violation; ECB summons' : null,
    status: calcStatus(applies, nextDue, 3),
    learn_more_url: 'https://www.nyc.gov/site/fdny/business/all-businesses/sprinkler-requirements.page',
    tooltip: 'Annual sprinkler maintenance per NFPA 25.',
  };
}

function checkPlaceOfAssembly(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'FDNY — Fire Safety';
  const applies = !!p.has_place_of_assembly;

  return {
    local_law: 'FDNY PA', requirement_name: 'Place of Assembly Certificate', category: CAT,
    description: 'Spaces for 75+ persons require PA certificate before occupancy. Subject to periodic FDNY inspection.',
    applies,
    applicability_reason: applies ? 'Building has place of assembly.' : 'No place of assembly.',
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: applies ? 25000 : null,
    penalty_description: applies ? 'FDNY violation; closure; up to $25,000/offense' : null,
    status: !applies ? 'exempt' : 'pending',
    learn_more_url: 'https://www.nyc.gov/site/fdny/business/all-businesses/places-of-assembly.page',
    tooltip: 'PA certificate required for spaces with 75+ person capacity.',
  };
}

function checkFireExtinguisher(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'FDNY — Fire Safety';
  const applies = isCommercialOrOffice(p) || !!p.has_place_of_assembly;
  const nextDue = annualDue(12, 31);

  return {
    local_law: 'FDNY', requirement_name: 'Fire Extinguisher Maintenance', category: CAT,
    description: 'Annual inspection; 6-year maintenance; 12-year hydrostatic test. Tags must be current.',
    applies,
    applicability_reason: applies ? 'Commercial building or place of assembly.' : 'Not a qualifying commercial building.',
    cycle_year: new Date().getFullYear(), next_due_date: nextDue, filing_deadline: null,
    penalty_amount: applies ? 2500 : null,
    penalty_description: applies ? 'FDNY violation; ECB summons' : null,
    status: calcStatus(applies, nextDue, 3),
    learn_more_url: 'https://www.nyc.gov/site/fdny/business/all-businesses/portable-fire-extinguishers.page',
    tooltip: 'Annual fire extinguisher inspection for commercial buildings.',
  };
}

function checkEmergencyLighting(p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'FDNY — Fire Safety';
  // Only meaningful for commercial, multi-family (3+), or buildings with assembly
  const applies = isCommercialOrOffice(p) || (p.dwelling_units ?? 0) >= 3 || !!p.has_place_of_assembly;

  return {
    local_law: 'FDNY/DOB', requirement_name: 'Emergency / Exit Lighting', category: CAT,
    description: 'Exit signs and emergency lighting must be functional at all times. Battery backup tested periodically.',
    applies,
    applicability_reason: applies ? 'Commercial, multiple dwelling, or place of assembly.' : 'Small residential building — basic requirements only.',
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: applies ? 2500 : null,
    penalty_description: applies ? 'FDNY/DOB violation' : null,
    status: !applies ? 'exempt' : 'pending',
    learn_more_url: 'https://www.nyc.gov/site/fdny/business/all-businesses/exit-signs-and-emergency-lighting.page',
    tooltip: 'Ongoing: maintain emergency and exit lighting.',
  };
}

// ============================================================
// CATEGORY 10: MULTI-AGENCY & OTHER
// ============================================================

function checkLL196(_p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'Multi-Agency & Other';
  return {
    local_law: 'LL196', requirement_name: 'Construction Site Safety Training (SST)', category: CAT,
    description: 'All workers/supervisors on NYC construction sites need 40-hour SST card.',
    applies: false,
    applicability_reason: 'Event-triggered: applies only during active construction with workers.',
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: null, penalty_description: 'DOB violation; stop work order',
    status: 'exempt',
    learn_more_url: 'https://www.nyc.gov/site/buildings/safety/site-safety-training.page',
    tooltip: 'Construction site safety training. Applies during active construction.',
  };
}

function checkAsbestos(_p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'Multi-Agency & Other';
  return {
    local_law: 'ACP5/ACP7', requirement_name: 'Asbestos (Pre-Renovation/Demolition)', category: CAT,
    description: 'ACP5 investigation report and ACP7 project notification required before any work disturbing ACM.',
    applies: false,
    applicability_reason: 'Event-triggered: applies per renovation/demolition project.',
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: null, penalty_description: 'DOB/DEP violation; stop work order; criminal penalties',
    status: 'exempt',
    learn_more_url: 'https://www.nyc.gov/site/dep/environment/asbestos.page',
    tooltip: 'Per-project asbestos assessment before renovation or demolition.',
  };
}

function checkConstructionNoise(_p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'Multi-Agency & Other';
  return {
    local_law: 'DEP Noise', requirement_name: 'Construction Noise Mitigation', category: CAT,
    description: 'After-hours work requires AHV from DEP. Noise mitigation plan required.',
    applies: false,
    applicability_reason: 'Event-triggered: applies per construction project.',
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: null, penalty_description: 'DEP violation; ECB fines',
    status: 'exempt',
    learn_more_url: 'https://www.nyc.gov/site/dep/environment/noise.page',
    tooltip: 'Per-project noise mitigation for construction sites.',
  };
}

function checkCOCompliance(_p: PropertyForCompliance): LocalLawRequirement {
  const CAT: ComplianceCategory = 'Multi-Agency & Other';
  return {
    local_law: 'DOB CO', requirement_name: 'Certificate of Occupancy Compliance', category: CAT,
    description: 'Use must conform to CO. Illegal conversions trigger violations. Fines $5,000–$15,000.',
    applies: false,
    applicability_reason: 'Universal requirement — tracked via CO status on property overview.',
    cycle_year: null, next_due_date: null, filing_deadline: null,
    penalty_amount: null,
    penalty_description: 'DOB violation; potential vacate order; $5,000–$15,000',
    status: 'exempt',
    learn_more_url: 'https://www.nyc.gov/site/buildings/property-or-business-owner/certificate-of-occupancy.page',
    tooltip: 'Ongoing: building use must conform to Certificate of Occupancy. Tracked via CO status.',
  };
}

// ============================================================
// MAIN ENGINE
// ============================================================

export function getApplicableLaws(property: PropertyForCompliance): LocalLawRequirement[] {
  const allChecks = [
    // Cat 1: Facade, Exterior & Structural
    checkLL11(property),
    checkLL126Parapet(property),
    checkLL126PIPS(property),
    checkLL37(property),
    // Cat 2: Energy & Emissions
    checkLL84(property),
    checkLL97(property),
    checkLL87(property),
    checkLL88(property),
    checkLL33EnergyGrade(property),
    checkLL32(property),
    checkLL92_94(property),
    checkLL85(property),
    checkLL154(property),
    // Cat 3: Gas Safety
    checkLL152(property),
    checkLL157(property),
    checkLL159(property),
    checkLL33PostGas(property),
    // Cat 4: Elevators & Mechanical
    checkLL62(property),
    checkBoilerInspection(property),
    // Cat 5: Fire Safety & Sprinklers
    checkLL26(property),
    checkLL77Crane(property),
    checkFireSafetyDoor(property),
    // Cat 6: DOHMH
    checkCoolingTower(property),
    checkWaterTank(property),
    // Cat 7: DEP
    checkBackflow(property),
    checkGreaseTrap(property),
    // Cat 8: HPD Residential
    checkLL1LeadPaint(property),
    checkLL55(property),
    checkBedbugReporting(property),
    checkWindowGuard(property),
    checkHPDRegistration(property),
    checkHeatHotWater(property),
    checkSmokeCO(property),
    // Cat 9: FDNY
    checkFireAlarm(property),
    checkStandpipe(property),
    checkSprinklerMaintenance(property),
    checkPlaceOfAssembly(property),
    checkFireExtinguisher(property),
    checkEmergencyLighting(property),
    // Cat 10: Multi-Agency
    checkLL196(property),
    checkAsbestos(property),
    checkConstructionNoise(property),
    checkCOCompliance(property),
  ];

  const statusOrder: Record<string, number> = {
    overdue: 0, due_soon: 1, pending: 2, compliant: 3, exempt: 4,
  };

  return allChecks.sort((a, b) => {
    if (a.applies !== b.applies) return a.applies ? -1 : 1;
    return (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5);
  });
}

export function getComplianceSummary(requirements: LocalLawRequirement[]) {
  const applicable = requirements.filter(r => r.applies);
  return {
    total: applicable.length,
    overdue: applicable.filter(r => r.status === 'overdue').length,
    dueSoon: applicable.filter(r => r.status === 'due_soon').length,
    compliant: applicable.filter(r => r.status === 'compliant').length,
    pending: applicable.filter(r => r.status === 'pending').length,
    exempt: requirements.filter(r => !r.applies).length,
  };
}
