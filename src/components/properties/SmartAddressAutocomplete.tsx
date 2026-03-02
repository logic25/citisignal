import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, MapPin, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBoroughCode, getBoroughName } from '@/lib/property-utils';

// Security Fix 7: Sanitize input for SoQL queries — allow only safe characters
function sanitizeSoQL(input: string): string {
  return input.replace(/[^a-zA-Z0-9\s\-\.]/g, '').trim();
}

// Street suffix normalization for NYC dataset matching
const STREET_SUFFIX_MAP: Record<string, string> = {
  'ROAD': 'RD', 'AVENUE': 'AVE', 'STREET': 'ST', 'BOULEVARD': 'BLVD',
  'DRIVE': 'DR', 'PLACE': 'PL', 'COURT': 'CT', 'LANE': 'LN',
  'TERRACE': 'TER', 'CIRCLE': 'CIR', 'HIGHWAY': 'HWY', 'PARKWAY': 'PKWY',
  'EXPRESSWAY': 'EXPY', 'TURNPIKE': 'TPKE', 'SQUARE': 'SQ',
};

function normalizeStreetSuffix(street: string): string {
  const parts = street.split(' ');
  const lastPart = parts[parts.length - 1];
  if (STREET_SUFFIX_MAP[lastPart]) {
    parts[parts.length - 1] = STREET_SUFFIX_MAP[lastPart];
  }
  return parts.join(' ');
}

interface NYCBuildingData {
  bin__: string;
  house__: string;
  street_name: string;
  borough: string;
  block: string;
  lot: string;
  existingno_of_stories: string;
  existing_height: string;
  existing_zoning_sqft: string;
  existing_occupancy: string;
  existing_dwelling_units: string;
}

interface PLUTOData {
  bbl: string;
  borough: string;
  block: string;
  lot: string;
  address: string;
  numfloors: string;
  unitsres: string;
  unitstotal: string;
  bldgarea: string;
  lotarea: string;
  bldgclass: string;
  landuse: string;
  yearbuilt: string;
  ownername: string;
}

interface AutocompleteResult {
  bin: string;
  address: string;
  borough: string;
  bbl: string;
  block: string;
  lot: string;
  stories: number | null;
  heightFt: number | null;
  grossSqft: number | null;
  primaryUseGroup: string | null;
  dwellingUnits: number | null;
}

interface SmartAddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: AutocompleteResult) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const SmartAddressAutocomplete = ({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing a NYC address...",
  disabled = false,
}: SmartAddressAutocompleteProps) => {
  const [nycResults, setNycResults] = useState<AutocompleteResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch PLUTO data by BBL for accurate building characteristics
  const fetchPLUTODataByBBL = async (bbl: string): Promise<PLUTOData | null> => {
    if (!bbl || bbl.length < 10) return null;

    try {
      const url = new URL('https://data.cityofnewyork.us/resource/64uk-42ks.json');
      url.searchParams.set('bbl', bbl);
      url.searchParams.set('$limit', '1');

      const response = await fetch(url.toString());
      if (!response.ok) return null;

      const data: PLUTOData[] = await response.json();
      return data[0] || null;
    } catch (error) {
      console.error('Error fetching PLUTO data:', error);
      return null;
    }
  };

  // Fallback: search PLUTO dataset directly
  const searchPLUTO = async (query: string): Promise<AutocompleteResult[]> => {
    if (query.length < 3) return [];

    try {
      const parts = query.trim().split(/\s+/);
      const houseNumber = parts[0];
      let streetParts = parts.slice(1).map(p => p.toUpperCase().replace(/^(\d+)(ST|ND|RD|TH)$/g, '$1'));

      const streetAbbreviations = new Set(['ST', 'AVE', 'AV', 'RD', 'DR', 'PL', 'CT', 'LN', 'BLVD', 'WAY']);
      const boroughMap: Record<string, string> = {
        'BK': 'BK', 'BX': 'BX', 'MN': 'MN', 'QN': 'QN', 'SI': 'SI',
      };
      const boroughPrefixMap: [string, string, number][] = [
        ['MANHATTAN', 'MN', 3], ['BRONX', 'BX', 3], ['BROOKLYN', 'BK', 3],
        ['QUEENS', 'QN', 3], ['STATEN', 'SI', 5],
      ];
      let boroughCode = '';
      streetParts = streetParts.filter(p => {
        if (streetAbbreviations.has(p)) return true;
        if (boroughMap[p]) { boroughCode = boroughMap[p]; return false; }
        const match = boroughPrefixMap.find(([name, , minLen]) => name.startsWith(p) && p.length >= minLen);
        if (match) { boroughCode = match[1]; return false; }
        if (p === 'ISLAND' && boroughCode === 'SI') return false;
        if (['NY', 'NEW', 'YORK', 'NYC'].includes(p)) return false;
        return true;
      });

      const streetQuery = normalizeStreetSuffix(streetParts.join(' '));
      const url = new URL('https://data.cityofnewyork.us/resource/64uk-42ks.json');
      const safeHouse = sanitizeSoQL(houseNumber);
      const safeStreet = sanitizeSoQL(streetQuery);
      let whereClause = `upper(address) LIKE '%${safeHouse} ${safeStreet}%'`;
      if (boroughCode) {
        const safeBoro = sanitizeSoQL(boroughCode);
        whereClause += ` AND borough = '${safeBoro}'`;
      }
      url.searchParams.set('$where', whereClause);
      url.searchParams.set('$limit', '10');
      url.searchParams.set('$select', 'bbl,borough,block,lot,address,numfloors,unitsres,unitstotal,bldgarea,lotarea,bldgclass,landuse,yearbuilt,ownername');

      const response = await fetch(url.toString());
      if (!response.ok) return [];

      const data: PLUTOData[] = await response.json();

      const seenBbls = new Set<string>();
      return data.filter(p => {
        if (!p.bbl || seenBbls.has(p.bbl)) return false;
        seenBbls.add(p.bbl);
        return true;
      }).map(p => {
        const bc = getBoroughCode(p.borough || '');
        const bbl = p.bbl ? p.bbl.replace(/\.0+$/, '') : '';
        return {
          bin: '',
          address: p.address || '',
          borough: bc,
          bbl,
          block: p.block || '',
          lot: p.lot || '',
          stories: p.numfloors ? parseInt(p.numfloors) : null,
          heightFt: null,
          grossSqft: p.bldgarea ? parseFloat(p.bldgarea) : null,
          primaryUseGroup: p.bldgclass || null,
          dwellingUnits: p.unitsres ? parseInt(p.unitsres) : null,
        };
      });
    } catch (error) {
      console.error('Error searching PLUTO:', error);
      return [];
    }
  };

  // Primary: NYC GeoSearch API (same as ZoLa) for reliable BIN/BBL resolution
  const searchNYCGeoSearch = async (query: string): Promise<AutocompleteResult[]> => {
    if (query.length < 3) return [];

    try {
      const url = `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('GeoSearch failed');

      const data = await response.json();
      const features = data.features || [];

      const seenBins = new Set<string>();
      const results: AutocompleteResult[] = [];

      for (const feature of features) {
        const props = feature.properties || {};
        const pad = props.addendum?.pad || {};
        const bin = pad.bin || '';
        const bbl = pad.bbl || '';

        if (!bin || bin === '1000000' || seenBins.has(bin)) continue;
        seenBins.add(bin);

        const boroughCode = bbl ? bbl.charAt(0) : '';
        const block = bbl.length >= 6 ? bbl.substring(1, 6) : '';
        const lot = bbl.length >= 10 ? bbl.substring(6, 10) : '';

        results.push({
          bin,
          address: props.name || '',
          borough: boroughCode,
          bbl,
          block,
          lot,
          stories: null,
          heightFt: null,
          grossSqft: null,
          primaryUseGroup: null,
          dwellingUnits: null,
        });
      }

      // Enrich top results with PLUTO data
      const enriched = await Promise.all(
        results.slice(0, 5).map(async (result) => {
          if (result.bbl) {
            const plutoData = await fetchPLUTODataByBBL(result.bbl);
            if (plutoData) {
              return {
                ...result,
                stories: plutoData.numfloors ? parseInt(plutoData.numfloors) : null,
                grossSqft: plutoData.bldgarea ? parseFloat(plutoData.bldgarea) : null,
                primaryUseGroup: plutoData.bldgclass || null,
                dwellingUnits: plutoData.unitsres ? parseInt(plutoData.unitsres) : null,
              };
            }
          }
          return result;
        })
      );

      return enriched;
    } catch (error) {
      console.error('GeoSearch error, falling back to DOB Jobs:', error);
      return searchNYCBuildingsFallback(query);
    }
  };

  // Fallback: Search NYC DOB buildings database (with PLUTO fallback)
  const searchNYCBuildingsFallback = async (query: string): Promise<AutocompleteResult[]> => {
    if (query.length < 3) return [];

    try {
      const parts = query.trim().split(/\s+/);
      const houseNumber = parts[0];
      let streetParts = parts.slice(1).map(p => p.toUpperCase().replace(/^(\d+)(ST|ND|RD|TH)$/g, '$1'));

      const streetAbbreviations = new Set(['ST', 'AVE', 'AV', 'RD', 'DR', 'PL', 'CT', 'LN', 'BLVD', 'WAY']);
      const boroughPrefixes: [string, string, number][] = [
        ['MANHATTAN', 'MANHATTAN', 3], ['BRONX', 'BRONX', 3], ['BROOKLYN', 'BROOKLYN', 3],
        ['QUEENS', 'QUEENS', 3], ['STATEN', 'STATEN ISLAND', 5],
      ];
      const boroughExact: Record<string, string> = {
        'BK': 'BROOKLYN', 'BX': 'BRONX', 'MN': 'MANHATTAN', 'QN': 'QUEENS', 'SI': 'STATEN ISLAND',
      };
      let boroughFilter = '';
      streetParts = streetParts.filter(p => {
        if (streetAbbreviations.has(p)) return true;
        if (boroughExact[p]) { boroughFilter = boroughExact[p]; return false; }
        const match = boroughPrefixes.find(([name, , minLen]) => name.startsWith(p) && p.length >= minLen);
        if (match) { boroughFilter = match[1]; return false; }
        if (p === 'ISLAND' && boroughFilter === '5') return false;
        if (['NY', 'NEW', 'YORK', 'NYC'].includes(p)) return false;
        return true;
      });

      const streetQuery = normalizeStreetSuffix(streetParts.join(' '));
      const url = new URL('https://data.cityofnewyork.us/resource/ic3t-wcy2.json');
      const safeHouse = sanitizeSoQL(houseNumber);
      let whereClause = `house__ LIKE '%${safeHouse}%'`;
      if (streetQuery) {
        const safeStreet = sanitizeSoQL(streetQuery);
        whereClause += ` AND upper(street_name) LIKE '%${safeStreet}%'`;
      }
      if (boroughFilter) {
        const safeBoro = sanitizeSoQL(boroughFilter);
        whereClause += ` AND borough = '${safeBoro}'`;
      }
      url.searchParams.set('$where', whereClause);
      url.searchParams.set('$limit', '25');

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to search NYC buildings');

      const data: NYCBuildingData[] = await response.json();

      const seenBins = new Set<string>();
      const uniqueBuildings = data.filter(building => {
        const bin = building.bin__ || '';
        if (!bin || seenBins.has(bin)) return false;
        seenBins.add(bin);
        return true;
      });

      const results = await Promise.all(
        uniqueBuildings.slice(0, 10).map(async building => {
          const boroughCode = getBoroughCode(building.borough || '');
          const bin = building.bin__ || '';
          const bbl = (building.block && building.lot)
            ? `${boroughCode}${building.block.padStart(5, '0').slice(-5)}${building.lot.padStart(4, '0').slice(-4)}`
            : '';

          const plutoData = bbl ? await fetchPLUTODataByBBL(bbl) : null;

          return {
            bin,
            address: `${building.house__ || ''} ${building.street_name || ''}`.trim(),
            borough: boroughCode,
            bbl,
            block: bbl.length >= 6 ? bbl.substring(1, 6) : building.block || '',
            lot: bbl.length >= 10 ? bbl.substring(6, 10) : building.lot || '',
            stories: plutoData?.numfloors
              ? parseInt(plutoData.numfloors)
              : (building.existingno_of_stories ? parseInt(building.existingno_of_stories) : null),
            heightFt: building.existing_height ? parseFloat(building.existing_height) : null,
            grossSqft: plutoData?.bldgarea
              ? parseFloat(plutoData.bldgarea)
              : (building.existing_zoning_sqft ? parseFloat(building.existing_zoning_sqft) : null),
            primaryUseGroup: plutoData?.bldgclass || building.existing_occupancy || null,
            dwellingUnits: plutoData?.unitsres
              ? parseInt(plutoData.unitsres)
              : (building.existing_dwelling_units ? parseInt(building.existing_dwelling_units) : null),
          };
        })
      );

      // Run DOB Jobs and PLUTO searches in parallel, merge results
      const [dobResults, plutoResults] = await Promise.all([
        Promise.resolve(results),
        searchPLUTO(query),
      ]);

      if (dobResults.length > 0) {
        const dobAddresses = new Set(dobResults.map(r => r.address.toUpperCase()));
        const uniquePluto = plutoResults.filter(r => !dobAddresses.has(r.address.toUpperCase()));
        return [...dobResults, ...uniquePluto].slice(0, 10);
      }

      return plutoResults;
    } catch (error) {
      console.error('Error searching NYC buildings:', error);
      return [];
    }
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setSelectedIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (newValue.length >= 3) {
        setIsSearching(true);
        searchNYCGeoSearch(newValue).then(results => {
          setNycResults(results);
          setShowDropdown(results.length > 0);
          setIsSearching(false);
        });
      } else {
        setNycResults([]);
        setShowDropdown(false);
      }
    }, 300);
  };

  // Handle NYC result selection
  const handleNYCSelect = (result: AutocompleteResult) => {
    onChange(result.address);
    onSelect(result);
    setShowDropdown(false);
    setNycResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || nycResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, nycResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && nycResults[selectedIndex]) {
          handleNYCSelect(nycResults[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        break;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => nycResults.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10 pr-10"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* NYC DOB + PLUTO dropdown */}
      {showDropdown && nycResults.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
          {nycResults.map((result, index) => (
            <button
              key={`${result.bin || result.bbl}-${index}`}
              type="button"
              className={cn(
                "w-full px-4 py-3 text-left hover:bg-accent transition-colors flex items-start gap-3",
                index === selectedIndex && "bg-accent",
                index !== nycResults.length - 1 && "border-b border-border"
              )}
              onClick={() => handleNYCSelect(result)}
            >
              <Building2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground text-sm">
                  {result.address}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                  <span>{getBoroughName(result.borough)}</span>
                  {result.bin && <span>BIN: {result.bin}</span>}
                  {result.stories && <span>{result.stories} stories</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {value.length >= 3 && !isSearching &&
       nycResults.length === 0 && showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-4 text-center text-sm text-muted-foreground">
          No addresses found. You can enter the address manually.
        </div>
      )}
    </div>
  );
};
