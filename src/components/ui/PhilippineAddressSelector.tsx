import React, { useMemo, useState } from 'react';
import { PSGC_REGIONS, type PsgcRegion, type PsgcProvince, type PsgcCity } from '../../data/psgc';

export interface PhilippineAddressData {
  region: string;
  province: string;
  city: string;
  barangay: string;
  streetAddress: string;
  zipCode: string;
  formattedAddress: string;
}

export interface PhilippineAddressSelectorProps {
  readonly value: Partial<PhilippineAddressData>;
  readonly onChange: (next: PhilippineAddressData) => void;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly labelClass?: string;
  readonly inputClass?: string;
}

export const PhilippineAddressSelector: React.FC<PhilippineAddressSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  labelClass = 'ox-label',
  inputClass = 'ox-input',
}) => {
  const [customCityMode, setCustomCityMode] = useState(false);
  const [customBrgyMode, setCustomBrgyMode] = useState(false);

  const selectedRegion = useMemo<PsgcRegion | undefined>(() => {
    if (!value.region) return undefined;
    return PSGC_REGIONS.find((r) => r.name === value.region || r.shortName === value.region);
  }, [value.region]);

  const availableProvinces = useMemo<readonly PsgcProvince[]>(() => {
    return selectedRegion?.provinces ?? [];
  }, [selectedRegion]);

  const selectedProvince = useMemo<PsgcProvince | undefined>(() => {
    if (!value.province) return undefined;
    return availableProvinces.find((p) => p.name === value.province);
  }, [availableProvinces, value.province]);

  const availableCities = useMemo<readonly PsgcCity[]>(() => {
    return selectedProvince?.cities ?? [];
  }, [selectedProvince]);

  const selectedCity = useMemo<PsgcCity | undefined>(() => {
    if (!value.city) return undefined;
    return availableCities.find((c) => c.name === value.city);
  }, [availableCities, value.city]);

  const availableBarangays = useMemo<readonly string[]>(() => {
    return selectedCity?.barangays ?? [];
  }, [selectedCity]);

  const buildFormatted = (
    street: string,
    brgy: string,
    city: string,
    prov: string,
    zip: string
  ): string => {
    const parts = [
      street.trim(),
      brgy.trim() ? `Brgy. ${brgy.trim().replace(/^Brgy\.?\s*/i, '')}` : '',
      city.trim(),
      prov.trim(),
      zip.trim(),
    ].filter(Boolean);
    return parts.join(', ');
  };

  const handleRegionChange = (regionName: string) => {
    setCustomCityMode(false);
    setCustomBrgyMode(false);

    onChange({
      region: regionName,
      province: '',
      city: '',
      barangay: '',
      streetAddress: value.streetAddress || '',
      zipCode: '',
      formattedAddress: buildFormatted(value.streetAddress || '', '', '', '', ''),
    });
  };

  const handleProvinceChange = (provinceName: string) => {
    setCustomCityMode(false);
    setCustomBrgyMode(false);

    onChange({
      region: value.region || '',
      province: provinceName,
      city: '',
      barangay: '',
      streetAddress: value.streetAddress || '',
      zipCode: '',
      formattedAddress: buildFormatted(value.streetAddress || '', '', '', provinceName, ''),
    });
  };

  const handleCityChange = (cityName: string) => {
    if (cityName === '__CUSTOM__') {
      setCustomCityMode(true);
      setCustomBrgyMode(true);
      onChange({
        region: value.region || '',
        province: value.province || '',
        city: '',
        barangay: '',
        streetAddress: value.streetAddress || '',
        zipCode: value.zipCode || '',
        formattedAddress: buildFormatted(value.streetAddress || '', '', '', value.province || '', value.zipCode || ''),
      });
      return;
    }

    const cityObj = availableCities.find((c) => c.name === cityName);
    const zip = cityObj?.zipCode || value.zipCode || '';
    setCustomCityMode(false);
    setCustomBrgyMode(false);

    onChange({
      region: value.region || '',
      province: value.province || '',
      city: cityName,
      barangay: '',
      streetAddress: value.streetAddress || '',
      zipCode: zip,
      formattedAddress: buildFormatted(value.streetAddress || '', '', cityName, value.province || '', zip),
    });
  };

  const handleCustomCityChange = (customCityName: string) => {
    onChange({
      region: value.region || '',
      province: value.province || '',
      city: customCityName,
      barangay: value.barangay || '',
      streetAddress: value.streetAddress || '',
      zipCode: value.zipCode || '',
      formattedAddress: buildFormatted(value.streetAddress || '', value.barangay || '', customCityName, value.province || '', value.zipCode || ''),
    });
  };

  const handleBarangayChange = (barangayName: string) => {
    if (barangayName === '__CUSTOM__') {
      setCustomBrgyMode(true);
      return;
    }

    onChange({
      region: value.region || '',
      province: value.province || '',
      city: value.city || '',
      barangay: barangayName,
      streetAddress: value.streetAddress || '',
      zipCode: value.zipCode || '',
      formattedAddress: buildFormatted(value.streetAddress || '', barangayName, value.city || '', value.province || '', value.zipCode || ''),
    });
  };

  const handleCustomBarangayChange = (customBrgyName: string) => {
    onChange({
      region: value.region || '',
      province: value.province || '',
      city: value.city || '',
      barangay: customBrgyName,
      streetAddress: value.streetAddress || '',
      zipCode: value.zipCode || '',
      formattedAddress: buildFormatted(value.streetAddress || '', customBrgyName, value.city || '', value.province || '', value.zipCode || ''),
    });
  };

  const handleStreetChange = (street: string) => {
    onChange({
      region: value.region || '',
      province: value.province || '',
      city: value.city || '',
      barangay: value.barangay || '',
      streetAddress: street,
      zipCode: value.zipCode || '',
      formattedAddress: buildFormatted(street, value.barangay || '', value.city || '', value.province || '', value.zipCode || ''),
    });
  };

  const handleZipChange = (zip: string) => {
    onChange({
      region: value.region || '',
      province: value.province || '',
      city: value.city || '',
      barangay: value.barangay || '',
      streetAddress: value.streetAddress || '',
      zipCode: zip,
      formattedAddress: buildFormatted(value.streetAddress || '', value.barangay || '', value.city || '', value.province || '', zip),
    });
  };

  return (
    <div className={`philippine-address-selector ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Row 1: Region & Province */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        <div className="landing-auth-field">
          <label className={labelClass}>Region *</label>
          <select
            className={inputClass}
            value={value.region || ''}
            onChange={(e) => handleRegionChange(e.target.value)}
            disabled={disabled}
          >
            <option value="">Select Region…</option>
            {PSGC_REGIONS.map((r) => (
              <option key={r.code} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className="landing-auth-field">
          <label className={labelClass}>Province / District *</label>
          <select
            className={inputClass}
            value={value.province || ''}
            onChange={(e) => handleProvinceChange(e.target.value)}
            disabled={disabled || availableProvinces.length === 0}
          >
            <option value="">{value.region ? 'Select Province / District…' : 'Select Region first…'}</option>
            {availableProvinces.map((p) => (
              <option key={p.code} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: City & Barangay */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        <div className="landing-auth-field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className={labelClass}>City / Municipality *</label>
            {customCityMode && availableCities.length > 0 && (
              <button
                type="button"
                onClick={() => setCustomCityMode(false)}
                style={{ fontSize: '0.75rem', color: '#0f766e', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                ‹ Choose from list
              </button>
            )}
          </div>

          {!customCityMode && availableCities.length > 0 ? (
            <select
              className={inputClass}
              value={value.city || ''}
              onChange={(e) => handleCityChange(e.target.value)}
              disabled={disabled || !value.province}
            >
              <option value="">{value.province ? 'Select City / Municipality…' : 'Select Province first…'}</option>
              {availableCities.map((c) => (
                <option key={c.code} value={c.name}>{c.name}</option>
              ))}
              <option value="__CUSTOM__">Other (Type manually)…</option>
            </select>
          ) : (
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. City / Municipality name"
              value={value.city || ''}
              onChange={(e) => handleCustomCityChange(e.target.value)}
              disabled={disabled || !value.province}
            />
          )}
        </div>

        <div className="landing-auth-field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className={labelClass}>Barangay *</label>
            {customBrgyMode && availableBarangays.length > 0 && (
              <button
                type="button"
                onClick={() => setCustomBrgyMode(false)}
                style={{ fontSize: '0.75rem', color: '#0f766e', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                ‹ Choose from list
              </button>
            )}
          </div>

          {!customBrgyMode && availableBarangays.length > 0 ? (
            <select
              className={inputClass}
              value={value.barangay || ''}
              onChange={(e) => handleBarangayChange(e.target.value)}
              disabled={disabled || !value.city}
            >
              <option value="">{value.city ? 'Select Barangay…' : 'Select City first…'}</option>
              {availableBarangays.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
              <option value="__CUSTOM__">Other (Type manually)…</option>
            </select>
          ) : (
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. Barangay name"
              value={value.barangay || ''}
              onChange={(e) => handleCustomBarangayChange(e.target.value)}
              disabled={disabled || !value.city}
            />
          )}
        </div>
      </div>

      {/* Row 3: Street Address & Zip Code */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: '0.75rem' }}>
        <div className="landing-auth-field">
          <label className={labelClass}>House / Unit No., Street, Subdivision *</label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. #14 Dahlia St., Phase 2"
            value={value.streetAddress || ''}
            onChange={(e) => handleStreetChange(e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="landing-auth-field">
          <label className={labelClass}>Postal Code *</label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. 8000"
            value={value.zipCode || ''}
            onChange={(e) => handleZipChange(e.target.value)}
            disabled={disabled}
            maxLength={6}
          />
        </div>
      </div>

      {value.formattedAddress && (
        <div style={{ padding: '0.65rem 0.85rem', background: '#f0fdfa', borderRadius: '8px', border: '1px solid #ccfbf1', fontSize: '0.82rem', color: '#0f766e' }}>
          <strong style={{ color: '#065f46' }}>Philippine Domicile: </strong>
          {value.formattedAddress}
        </div>
      )}
    </div>
  );
};
