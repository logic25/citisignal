// NYC Building Data Sync Service
// Fetches comprehensive building data from PLUTO, DOB Jobs, E-Designations, and LPC datasets
import { loggedFetch } from '@/lib/api-logger';

export interface NYCBuildingData {
  // Basic identifiers
  bin: string;
  bbl: string;
  borough: string;
  block: string;
  lot: string;
  address: string;

  // Building dimensions
  stories: number | null;
  heightFt: number | null;
  grossSqft: number | null;
  dwellingUnits: number | null;
  lotAreaSqft: number | null;
  buildingAreaSqft: number | null;
  residentialAreaSqft: number | null;
  commercialAreaSqft: number | null;
  officeAreaSqft: number | null;
  retailAreaSqft: number | null;
  garageAreaSqft: number | null;
  factoryAreaSqft: number | null;
  storageAreaSqft: number | null;
  otherAreaSqft: number | null;

  // Zoning
  zoningDistrict: string | null;
  zoningDistrict2: string | null;
  zoningDistrict3: string | null;
  zoningMap: string | null;
  overlayDistrict: string | null;
  specialDistrict: string | null;
  commercialOverlay: string | null;
  floorAreaRatio: number | null;
  maxFloorAreaRatio: number | null;
  airRightsSqft: number | null;
  unusedFar: number | null;
  splitZone: boolean;
  limitedHeightDistrict: string | null;

  // Lot dimensions
  lotFrontage: number | null;
  lotDepth: number | null;

  // Building classification
  buildingClass: string | null;
  occupancyGroup: string | null;
  occupancyClassification: string | null;
  yearBuilt: number | null;
  yearAltered1: number | null;
  yearAltered2: number | null;
  landUse: string | null;
  totalUnits: number | null;

  // Location
  latitude: number | null;
  longitude: number | null;
  communityBoard: string | null;
  councilDistrict: string | null;
  censusTract: string | null;
  ntaName: string | null;

  // Neighborhood info
  schoolDistrict: string | null;
  policePrecinct: string | null;
  fireCompany: string | null;
  sanitationBorough: string | null;
  sanitationSubsection: string | null;

  // Landmark & special status
  isLandmark: boolean;
  landmarkStatus: string | null;
  historicDistrict: string | null;

  // Regulatory restrictions
  loftLaw: boolean;
  legalAdultUse: boolean;
  isCityOwned: boolean;
  professionalCertRestricted: boolean;
  environmentalRestrictions: string | null;

  // Additional info
  additionalBins: string[];
  hpdMultipleDwelling: boolean;
  numberOfBuildings: number | null;
  numberOfFloors: number | null;
  assessedLandValue: number | null;
  assessedTotalValue: number | null;
  exemptLandValue: number | null;
  exemptTotalValue: number | null;
}

// PLUTO dataset - Primary Land Use Tax Lot Output (same as ZoLa uses)
const PLUTO_API = 'https://data.cityofnewyork.us/resource/64uk-42ks.json';

// DOB Job Application Filings (for building info)
const DOB_JOBS_API = 'https://data.cityofnewyork.us/resource/ic3t-wcy2.json';

// E-Designations dataset
const E_DESIGNATIONS_API = 'https://data.cityofnewyork.us/resource/jsrs-ggnx.json';

// LPC Landmarks dataset
const LPC_LANDMARKS_API = 'https://data.cityofnewyork.us/resource/gpmc-yuvp.json';

// PAD dataset is no longer accessible (403 Forbidden as of Feb 2026)
export async function fetchPADData(houseNumber: string, streetName: string, borough: string): Promise<{
  bin: string;
  bbl: string;
} | null> {
  console.warn('PAD dataset no longer accessible - using DOB Jobs fallback');
  return null;
}

// Fetch building data from DOB Jobs by BIN — check multiple filings for Pro Cert
async function fetchDOBJobsByBin(bin: string): Promise<Partial<NYCBuildingData> | null> {
  try {
    const url = new URL(DOB_JOBS_API);
    url.searchParams.set('bin__', bin);
    url.searchParams.set('$limit', '10');
    url.searchParams.set('$order', 'latest_action_date DESC');

    console.log('Fetching DOB Jobs data for BIN:', bin);
    const response = await loggedFetch(url.toString());
    if (!response.ok) {
      console.error('DOB Jobs API error:', response.status);
      return null;
    }

    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) {
      console.log('No DOB Jobs found for BIN:', bin);
      return null;
    }

    // Use first (most recent) for building data
    const d = results[0] as Record<string, any>;
    console.log('DOB Jobs data found, records:', results.length);

    // Check ALL filings for professional cert (any Y = restricted)
    const professionalCertRestricted = results.some(
      (r: Record<string, any>) => parseYesNo(r.professional_cert)
    );

    return {
      stories: parseInt_(d.existingno_of_stories) || parseInt_(d.proposed_no_of_stories),
      heightFt: parseNumber(d.existing_height) || parseNumber(d.proposed_height),
      dwellingUnits: parseInt_(d.existing_dwelling_units) || parseInt_(d.proposed_dwelling_units),
      occupancyGroup: d.existing_occupancy || d.proposed_occupancy || null,
      occupancyClassification: d.proposed_occupancy || null,
      zoningDistrict: d.zoning_dist1 || null,
      buildingClass: d.building_class || null,
      latitude: parseNumber(d.gis_latitude),
      longitude: parseNumber(d.gis_longitude),
      councilDistrict: d.gis_council_district || null,
      censusTract: d.gis_census_tract || null,
      ntaName: d.gis_nta_name || null,
      communityBoard: d.community___board || null,
      isLandmark: parseYesNo(d.landmarked),
      loftLaw: parseYesNo(d.loft_board),
      isCityOwned: false,
      legalAdultUse: parseYesNo(d.adult_estab),
      professionalCertRestricted,
      specialDistrict: d.special_district_1 || null,
    };
  } catch (error) {
    console.error('Error fetching DOB Jobs data:', error);
    return null;
  }
}

// Helper to parse yes/no strings to boolean
const parseYesNo = (value: string | undefined | null): boolean => {
  if (!value) return false;
  const v = value.toUpperCase().trim();
  return v === 'YES' || v === 'Y' || v === '1' || v === 'TRUE';
};

// Helper to parse numeric values
const parseNumber = (value: string | number | undefined | null): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) ? null : num;
};

// Helper to parse integer values
const parseInt_ = (value: string | number | undefined | null): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'number' ? Math.floor(value) : parseInt(value, 10);
  return isNaN(num) ? null : num;
};

// Fetch E-Designation (environmental restriction) records by BBL
async function fetchEDesignations(bbl: string): Promise<string | null> {
  try {
    const cleanBbl = bbl.replace(/\D/g, '');
    const url = new URL(E_DESIGNATIONS_API);
    url.searchParams.set('$where', `bbl='${cleanBbl}'`);
    url.searchParams.set('$limit', '10');

    console.log('Fetching E-Designations for BBL:', cleanBbl);
    const response = await loggedFetch(url.toString());
    if (!response.ok) {
      console.error('E-Designations API error:', response.status);
      return null;
    }

    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    // Concatenate descriptions
    const descriptions = results
      .map((r: Record<string, any>) => {
        const num = r.e_designation_number || r.enumber || '';
        const desc = r.description || r.zoning_map_changes || '';
        return num && desc ? `${num}: ${desc}` : desc || num;
      })
      .filter(Boolean);

    return descriptions.length > 0 ? descriptions.join('; ') : null;
  } catch (error) {
    console.error('Error fetching E-Designations:', error);
    return null;
  }
}

// Fetch LPC Landmark details by BBL
async function fetchLPCLandmarkDetails(bbl: string): Promise<{ landmarkStatus: string | null; isLandmark: boolean } | null> {
  try {
    const cleanBbl = bbl.replace(/\D/g, '');
    const url = new URL(LPC_LANDMARKS_API);
    url.searchParams.set('$where', `bbl='${cleanBbl}'`);
    url.searchParams.set('$limit', '5');

    console.log('Fetching LPC Landmark details for BBL:', cleanBbl);
    const response = await loggedFetch(url.toString());
    if (!response.ok) {
      console.error('LPC API error:', response.status);
      return null;
    }

    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    const r = results[0] as Record<string, any>;
    const lmType = r.lm_type || r.type || '';
    const lmName = r.lm_name || r.name || '';
    const status = r.status || '';
    const lpcNumber = r.lpc_number || r.lp_number || '';

    let landmarkStatus = '';
    if (lmType) landmarkStatus += lmType;
    if (lmName) landmarkStatus += (landmarkStatus ? ' — ' : '') + lmName;
    if (lpcNumber) landmarkStatus += ` (${lpcNumber})`;

    return {
      landmarkStatus: landmarkStatus || status || 'Designated',
      isLandmark: true,
    };
  } catch (error) {
    console.error('Error fetching LPC Landmark details:', error);
    return null;
  }
}

// Fetch building data from PLUTO by BBL
export async function fetchPLUTOData(bbl: string): Promise<Partial<NYCBuildingData> | null> {
  try {
    const cleanBbl = bbl.replace(/\D/g, '');
    const url = new URL(PLUTO_API);
    url.searchParams.set('bbl', cleanBbl);
    url.searchParams.set('$limit', '1');

    console.log('Fetching PLUTO data for BBL:', cleanBbl);
    const response = await loggedFetch(url.toString());
    if (!response.ok) {
      console.error('PLUTO API error:', response.status);
      return null;
    }

    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) {
      console.log('No PLUTO results found for BBL:', cleanBbl);
      return null;
    }

    const p = results[0] as Record<string, any>;

    return {
      // Zoning — all districts
      zoningDistrict: p.zonedist1 || null,
      zoningDistrict2: p.zonedist2 || null,
      zoningDistrict3: p.zonedist3 || null,
      zoningMap: p.zonemap || null,
      overlayDistrict: p.overlay1 || null,
      specialDistrict: [p.spdist1, p.spdist2, p.spdist3].filter(Boolean).join(', ') || null,
      commercialOverlay: p.overlay2 || null,
      splitZone: p.splitzone === 'Y',
      limitedHeightDistrict: p.ltdheight || null,

      // Area fields
      lotAreaSqft: parseInt_(p.lotarea),
      buildingAreaSqft: parseInt_(p.bldgarea),
      residentialAreaSqft: parseInt_(p.resarea),
      commercialAreaSqft: parseInt_(p.comarea),
      officeAreaSqft: parseInt_(p.officearea),
      retailAreaSqft: parseInt_(p.retailarea),
      garageAreaSqft: parseInt_(p.garession),
      factoryAreaSqft: parseInt_(p.factryarea),
      storageAreaSqft: parseInt_(p.strgearea),
      otherAreaSqft: parseInt_(p.otherarea),
      floorAreaRatio: parseNumber(p.builtfar),
      maxFloorAreaRatio: parseNumber(p.residfar) || parseNumber(p.commfar),
      unusedFar: parseNumber(p.residfar) ? parseNumber(p.residfar)! - (parseNumber(p.builtfar) || 0) : null,

      // Lot dimensions
      lotFrontage: parseNumber(p.lotfront),
      lotDepth: parseNumber(p.lotdepth),

      // Building classification
      buildingClass: p.bldgclass || null,
      yearBuilt: parseInt_(p.yearbuilt),
      yearAltered1: parseInt_(p.yearalter1),
      yearAltered2: parseInt_(p.yearalter2),
      landUse: p.landuse || null,
      totalUnits: parseInt_(p.unitstotal),

      // Location
      latitude: parseNumber(p.latitude),
      longitude: parseNumber(p.longitude),
      communityBoard: p.cd || null,
      councilDistrict: p.council || null,
      censusTract: p.ct2010 || null,

      // Neighborhood
      schoolDistrict: p.schooldist || null,
      policePrecinct: p.policeprct || null,
      fireCompany: p.firecomp || null,
      sanitationBorough: p.sanitboro || null,
      sanitationSubsection: p.sanitsub || null,

      // Building dimensions from PLUTO
      stories: parseInt_(p.numfloors),
      dwellingUnits: parseInt_(p.unitsres),
      grossSqft: parseInt_(p.bldgarea),
      heightFt: parseInt_(p.heightroof),

      // Landmark & historic
      isLandmark: !!p.landmark,
      landmarkStatus: p.landmark || null,
      historicDistrict: p.histdist || null,

      // Assessed values
      assessedLandValue: parseNumber(p.assessland),
      assessedTotalValue: parseNumber(p.assesstot),
      exemptLandValue: parseNumber(p.exempttot) ? parseNumber(p.exemptland) : null,
      exemptTotalValue: parseNumber(p.exempttot),

      // Building count
      numberOfBuildings: parseInt_(p.numbldgs),
      
      // Address info from PLUTO
      address: p.address ? `${p.address}`.trim() : null,
    };
  } catch (error) {
    console.error('Error fetching PLUTO data:', error);
    return null;
  }
}

// Cross streets lookup - PAD no longer accessible
export async function fetchCrossStreets(bin: string): Promise<string | null> {
  console.warn('Cross streets lookup unavailable - PAD dataset inaccessible');
  return null;
}

// Fetch building data from DOB by address
export async function fetchDOBData(
  houseNumber: string,
  streetName: string
): Promise<Partial<NYCBuildingData> | null> {
  try {
    const url = new URL(DOB_JOBS_API);
    url.searchParams.set(
      '$where',
      `house__ LIKE '%${houseNumber}%' AND upper(street_name) LIKE '%${streetName.toUpperCase()}%'`
    );
    url.searchParams.set('$limit', '1');
    url.searchParams.set('$order', 'latest_action_date DESC');

    const response = await loggedFetch(url.toString());
    if (!response.ok) return null;

    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    const d = results[0] as Record<string, any>;

    return {
      bin: d.bin__ || d.gis_bin || '',
      borough: d.borough || '',
      block: (d.block || '').toString().replace(/^0+/, '') || '',
      lot: (d.lot || '').toString().replace(/^0+/, '') || '',
      address: `${d.house__ || ''} ${d.street_name || ''}`.trim(),

      // Building dimensions
      stories: parseInt_(d.existingno_of_stories),
      heightFt: parseNumber(d.existing_height),
      dwellingUnits: parseInt_(d.existing_dwelling_units),
      grossSqft: parseInt_(d.existing_zoning_sqft),

      // Occupancy
      occupancyGroup: d.existing_occupancy || null,
      occupancyClassification: d.proposed_occupancy || null,

      // Features
      loftLaw: parseYesNo(d.loft_board),
      isCityOwned: parseYesNo(d.city_owned),
      isLandmark: parseYesNo(d.landmarked),
      legalAdultUse: parseYesNo(d.adult_estab),
      professionalCertRestricted: parseYesNo(d.professional_cert),
      specialDistrict: d.special_district_1 || null,

      // Location
      latitude: parseNumber(d.gis_latitude),
      longitude: parseNumber(d.gis_longitude),
      councilDistrict: d.gis_council_district || null,
      censusTract: d.gis_census_tract || null,
      ntaName: d.gis_nta_name || null,
      communityBoard: d.community___board || null,
    };
  } catch (error) {
    console.error('Error fetching DOB data:', error);
    return null;
  }
}

// Helper to build a merged result with defaults for new fields
function buildMergedResult(
  bin: string,
  bbl: string,
  borough: string,
  block: string,
  lot: string,
  plutoData: Partial<NYCBuildingData> | null,
  dobJobsData: Partial<NYCBuildingData> | null,
  eDesignations: string | null,
  lpcData: { landmarkStatus: string | null; isLandmark: boolean } | null,
  addressFallback: string
): NYCBuildingData {
  return {
    // Identifiers
    bin,
    bbl,
    borough,
    block,
    lot,
    address: (plutoData as any)?.address || addressFallback || '',

    // Dimensions
    stories: plutoData?.stories ?? dobJobsData?.stories ?? null,
    heightFt: plutoData?.heightFt ?? dobJobsData?.heightFt ?? null,
    grossSqft: plutoData?.grossSqft ?? null,
    dwellingUnits: plutoData?.dwellingUnits ?? dobJobsData?.dwellingUnits ?? null,
    lotAreaSqft: plutoData?.lotAreaSqft ?? null,
    buildingAreaSqft: plutoData?.buildingAreaSqft ?? null,
    residentialAreaSqft: plutoData?.residentialAreaSqft ?? null,
    commercialAreaSqft: plutoData?.commercialAreaSqft ?? null,
    officeAreaSqft: plutoData?.officeAreaSqft ?? null,
    retailAreaSqft: plutoData?.retailAreaSqft ?? null,
    garageAreaSqft: plutoData?.garageAreaSqft ?? null,
    factoryAreaSqft: plutoData?.factoryAreaSqft ?? null,
    storageAreaSqft: plutoData?.storageAreaSqft ?? null,
    otherAreaSqft: plutoData?.otherAreaSqft ?? null,

    // Zoning
    zoningDistrict: plutoData?.zoningDistrict ?? dobJobsData?.zoningDistrict ?? null,
    zoningDistrict2: plutoData?.zoningDistrict2 ?? null,
    zoningDistrict3: plutoData?.zoningDistrict3 ?? null,
    zoningMap: plutoData?.zoningMap ?? null,
    overlayDistrict: plutoData?.overlayDistrict ?? null,
    specialDistrict: plutoData?.specialDistrict ?? dobJobsData?.specialDistrict ?? null,
    commercialOverlay: plutoData?.commercialOverlay ?? null,
    floorAreaRatio: plutoData?.floorAreaRatio ?? null,
    maxFloorAreaRatio: plutoData?.maxFloorAreaRatio ?? null,
    airRightsSqft: plutoData?.unusedFar && plutoData?.lotAreaSqft 
      ? Math.floor(plutoData.unusedFar * plutoData.lotAreaSqft) 
      : null,
    unusedFar: plutoData?.unusedFar ?? null,
    splitZone: plutoData?.splitZone ?? false,
    limitedHeightDistrict: plutoData?.limitedHeightDistrict ?? null,

    // Lot dimensions
    lotFrontage: plutoData?.lotFrontage ?? null,
    lotDepth: plutoData?.lotDepth ?? null,

    // Building classification
    buildingClass: plutoData?.buildingClass ?? dobJobsData?.buildingClass ?? null,
    occupancyGroup: dobJobsData?.occupancyGroup ?? null,
    occupancyClassification: dobJobsData?.occupancyClassification ?? null,
    yearBuilt: plutoData?.yearBuilt ?? null,
    yearAltered1: plutoData?.yearAltered1 ?? null,
    yearAltered2: plutoData?.yearAltered2 ?? null,
    landUse: plutoData?.landUse ?? null,
    totalUnits: plutoData?.totalUnits ?? null,

    // Location
    latitude: plutoData?.latitude ?? dobJobsData?.latitude ?? null,
    longitude: plutoData?.longitude ?? dobJobsData?.longitude ?? null,
    communityBoard: plutoData?.communityBoard ?? dobJobsData?.communityBoard ?? null,
    councilDistrict: plutoData?.councilDistrict ?? dobJobsData?.councilDistrict ?? null,
    censusTract: plutoData?.censusTract ?? dobJobsData?.censusTract ?? null,
    ntaName: dobJobsData?.ntaName ?? null,

    // Neighborhood
    schoolDistrict: plutoData?.schoolDistrict ?? null,
    policePrecinct: plutoData?.policePrecinct ?? null,
    fireCompany: plutoData?.fireCompany ?? null,
    sanitationBorough: plutoData?.sanitationBorough ?? null,
    sanitationSubsection: plutoData?.sanitationSubsection ?? null,

    // Landmark — LPC enrichment takes priority, then PLUTO, then DOB
    isLandmark: lpcData?.isLandmark ?? plutoData?.isLandmark ?? dobJobsData?.isLandmark ?? false,
    landmarkStatus: lpcData?.landmarkStatus ?? plutoData?.landmarkStatus ?? (dobJobsData?.isLandmark ? 'LANDMARK' : null),
    historicDistrict: plutoData?.historicDistrict ?? null,

    // Regulatory restrictions
    loftLaw: dobJobsData?.loftLaw ?? false,
    legalAdultUse: dobJobsData?.legalAdultUse ?? false,
    isCityOwned: dobJobsData?.isCityOwned ?? false,
    professionalCertRestricted: dobJobsData?.professionalCertRestricted ?? false,
    environmentalRestrictions: eDesignations,

    // Additional info
    additionalBins: [],
    hpdMultipleDwelling: false,
    numberOfBuildings: plutoData?.numberOfBuildings ?? 1,
    numberOfFloors: plutoData?.stories ?? dobJobsData?.stories ?? null,
    assessedLandValue: plutoData?.assessedLandValue ?? null,
    assessedTotalValue: plutoData?.assessedTotalValue ?? null,
    exemptLandValue: plutoData?.exemptLandValue ?? null,
    exemptTotalValue: plutoData?.exemptTotalValue ?? null,
  };
}

// Sync using existing BIN and BBL (preferred method when we already have identifiers)
export async function syncNYCBuildingDataByIdentifiers(
  bin: string | null,
  bbl: string | null
): Promise<NYCBuildingData | null> {
  console.log('Syncing by identifiers - BIN:', bin, 'BBL:', bbl);
  
  // Fetch all data sources in parallel
  const [plutoData, dobJobsData, eDesignations, lpcData] = await Promise.all([
    bbl ? fetchPLUTOData(bbl) : Promise.resolve(null),
    bin ? fetchDOBJobsByBin(bin) : Promise.resolve(null),
    bbl ? fetchEDesignations(bbl) : Promise.resolve(null),
    bbl ? fetchLPCLandmarkDetails(bbl) : Promise.resolve(null),
  ]);
  
  console.log('PLUTO data result:', plutoData);
  console.log('DOB Jobs data result:', dobJobsData);
  console.log('E-Designations:', eDesignations);
  console.log('LPC data:', lpcData);

  if (!plutoData && !dobJobsData) {
    console.error('No data found from PLUTO or DOB Jobs for BBL:', bbl, 'BIN:', bin);
    return null;
  }

  const cleanBbl = (bbl || '').replace(/\D/g, '');
  const borough = cleanBbl.length >= 1 ? cleanBbl.substring(0, 1) : '';
  const block = cleanBbl.length >= 6 ? cleanBbl.substring(1, 6).replace(/^0+/, '') || '0' : '';
  const lot = cleanBbl.length >= 10 ? cleanBbl.substring(6, 10).replace(/^0+/, '') || '0' : '';

  return buildMergedResult(
    bin || '', cleanBbl, borough, block, lot,
    plutoData, dobJobsData, eDesignations, lpcData, ''
  );
}

// Main sync function - combines PLUTO and DOB data (fallback for address-based lookup)
export async function syncNYCBuildingData(address: string): Promise<NYCBuildingData | null> {
  const parts = address.split(',')[0].trim().split(/\s+/);
  const houseNumber = parts[0];
  const streetName = parts.slice(1).join(' ');

  if (!houseNumber || !streetName) {
    console.error('Invalid address format:', address);
    return null;
  }

  const dobData = await fetchDOBData(houseNumber, streetName);

  if (!dobData || !dobData.bin) {
    console.error('No DOB data found for address:', address);
    return null;
  }

  const borough = dobData.borough || '';
  const block = (dobData.block || '').padStart(5, '0');
  const lot = (dobData.lot || '').padStart(4, '0');
  const bbl = borough && block && lot ? `${borough}${block}${lot}` : '';

  // Fetch all supplementary data in parallel
  const [plutoData, eDesignations, lpcData] = await Promise.all([
    bbl ? fetchPLUTOData(bbl) : Promise.resolve(null),
    bbl ? fetchEDesignations(bbl) : Promise.resolve(null),
    bbl ? fetchLPCLandmarkDetails(bbl) : Promise.resolve(null),
  ]);

  return buildMergedResult(
    dobData.bin || '', bbl,
    dobData.borough || '', dobData.block || '', dobData.lot || '',
    plutoData, dobData, eDesignations, lpcData, dobData.address || address
  );
}

// Infer building features from characteristics when not explicitly set
export function inferBuildingFeatures(data: NYCBuildingData): {
  has_gas: boolean;
  has_boiler: boolean;
  has_elevator: boolean;
  has_sprinkler: boolean;
} {
  const stories = data.stories ?? 0;
  const dwellingUnits = data.dwellingUnits ?? 0;
  const grossSqft = data.grossSqft ?? 0;
  const buildingClass = (data.buildingClass || '').toUpperCase();
  const isResidential = dwellingUnits > 0 || buildingClass.startsWith('R') || buildingClass.startsWith('D') || buildingClass.startsWith('C');

  const has_elevator = stories >= 6;
  const has_gas = isResidential || dwellingUnits > 0 || grossSqft > 10000;
  const has_boiler = dwellingUnits >= 6 || stories >= 3 || grossSqft > 25000;
  const has_sprinkler = stories >= 7 || grossSqft > 50000;

  return { has_gas, has_boiler, has_elevator, has_sprinkler };
}

// Convert sync result to database update format
export function toPropertyUpdate(data: NYCBuildingData): Record<string, any> {
  const inferredFeatures = inferBuildingFeatures(data);

  return {
    bin: data.bin || null,
    bbl: data.bbl || null,
    borough: data.borough || null,
    stories: data.stories,
    height_ft: data.heightFt,
    gross_sqft: data.grossSqft,
    dwelling_units: data.dwellingUnits,

    // Inferred building features
    has_gas: inferredFeatures.has_gas,
    has_boiler: inferredFeatures.has_boiler,
    has_elevator: inferredFeatures.has_elevator,
    has_sprinkler: inferredFeatures.has_sprinkler,
    
    // Zoning
    zoning_district: data.zoningDistrict,
    zoning_district_2: data.zoningDistrict2,
    zoning_district_3: data.zoningDistrict3,
    zoning_map: data.zoningMap,
    overlay_district: data.overlayDistrict,
    special_district: data.specialDistrict,
    commercial_overlay: data.commercialOverlay,
    split_zone: data.splitZone,
    limited_height_district: data.limitedHeightDistrict,
    lot_area_sqft: data.lotAreaSqft,
    building_area_sqft: data.buildingAreaSqft,
    residential_area_sqft: data.residentialAreaSqft,
    commercial_area_sqft: data.commercialAreaSqft,
    office_area_sqft: data.officeAreaSqft,
    retail_area_sqft: data.retailAreaSqft,
    garage_area_sqft: data.garageAreaSqft,
    factory_area_sqft: data.factoryAreaSqft,
    storage_area_sqft: data.storageAreaSqft,
    other_area_sqft: data.otherAreaSqft,
    floor_area_ratio: data.floorAreaRatio,
    max_floor_area_ratio: data.maxFloorAreaRatio,
    air_rights_sqft: data.airRightsSqft,
    unused_far: data.unusedFar,

    // Lot dimensions
    lot_frontage: data.lotFrontage,
    lot_depth: data.lotDepth,

    // Building classification
    building_class: data.buildingClass,
    occupancy_group: data.occupancyGroup,
    occupancy_classification: data.occupancyClassification,
    primary_use_group: data.occupancyGroup,
    year_built: data.yearBuilt,
    year_altered_1: data.yearAltered1,
    year_altered_2: data.yearAltered2,
    land_use: data.landUse,
    total_units: data.totalUnits,

    // Location
    latitude: data.latitude,
    longitude: data.longitude,
    community_board: data.communityBoard,
    council_district: data.councilDistrict,
    census_tract: data.censusTract,
    nta_name: data.ntaName,

    // Neighborhood
    school_district: data.schoolDistrict,
    police_precinct: data.policePrecinct,
    fire_company: data.fireCompany,
    sanitation_borough: data.sanitationBorough,
    sanitation_subsection: data.sanitationSubsection,

    // Landmark & special status
    is_landmark: data.isLandmark,
    landmark_status: data.landmarkStatus,
    historic_district: data.historicDistrict,

    // Regulatory restrictions
    loft_law: data.loftLaw,
    legal_adult_use: data.legalAdultUse,
    is_city_owned: data.isCityOwned,
    // professional_cert_restricted intentionally omitted — DOB Jobs data unreliable vs BIS; preserve manual value
    environmental_restrictions: data.environmentalRestrictions,

    // Additional info
    additional_bins: data.additionalBins.length > 0 ? data.additionalBins : null,
    hpd_multiple_dwelling: data.hpdMultipleDwelling,
    number_of_buildings: data.numberOfBuildings,
    number_of_floors: data.numberOfFloors,
    assessed_land_value: data.assessedLandValue,
    assessed_total_value: data.assessedTotalValue,
    exempt_land_value: data.exemptLandValue,
    exempt_total_value: data.exemptTotalValue,

    // Mark as synced
    last_synced_at: new Date().toISOString(),
  };
}
