import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from '@mui/material';
import { useTranslation } from './LocalizationProvider';
import { formatAddress } from '../util/formatter';
import { usePreference } from '../util/preferences';

// XMart: addresses are looked up automatically (no "Show address" link).
// Results are cached per ~10 m grid cell so moving through the list or map
// does not repeat requests to the geocoding service.
const cache = new Map();
const pending = new Map();

const cacheKey = (latitude, longitude) => `${latitude.toFixed(4)},${longitude.toFixed(4)}`;

const lookup = (latitude, longitude) => {
  const key = cacheKey(latitude, longitude);
  if (cache.has(key)) {
    return Promise.resolve(cache.get(key));
  }
  if (!pending.has(key)) {
    const query = new URLSearchParams({ latitude, longitude });
    pending.set(
      key,
      fetch(`api/server/geocode?${query.toString()}`)
        .then((response) => (response.ok ? response.text() : null))
        .then((text) => {
          if (text) {
            cache.set(key, text);
          }
          return text;
        })
        .catch(() => null)
        .finally(() => pending.delete(key)),
    );
  }
  return pending.get(key);
};

const AddressValue = ({ latitude, longitude, originalAddress, auto = false }) => {
  const t = useTranslation();
  const addressEnabled = useSelector((state) => state.session.server.geocoderEnabled);
  const coordinateFormat = usePreference('coordinateFormat');

  const [address, setAddress] = useState(originalAddress);

  useEffect(() => {
    let active = true;
    if (originalAddress) {
      setAddress(originalAddress);
    } else if (addressEnabled && latitude != null && longitude != null) {
      const cached = cache.get(cacheKey(latitude, longitude));
      setAddress(cached);
      if (!cached && auto) {
        lookup(latitude, longitude).then((text) => {
          if (active && text) {
            setAddress(text);
          }
        });
      }
    } else {
      setAddress(null);
    }
    return () => {
      active = false;
    };
  }, [latitude, longitude, originalAddress, addressEnabled, auto]);

  if (address) {
    return address;
  }
  if (addressEnabled && !auto) {
    return (
      <Link
        href="#"
        onClick={(event) => {
          event.preventDefault();
          lookup(latitude, longitude).then((text) => text && setAddress(text));
        }}
      >
        {t('sharedShowAddress')}
      </Link>
    );
  }
  return formatAddress({ latitude, longitude }, coordinateFormat);
};

export default AddressValue;
