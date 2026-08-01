export type PackageLifecycleStatus = 'active' | 'expired' | 'pending' | 'cancelled';

type SpotRuleInput = {
  spotNumber: string;
  spotType?: string | null;
  zone?: {
    name?: string | null;
    description?: string | null;
  } | null;
};

function normalizeText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function startOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function normalizeLicensePlate(licensePlate: string) {
  return licensePlate.replace(/[-.\s]/g, '').toUpperCase().trim();
}

export function areLicensePlatesEqual(left: string, right: string) {
  return normalizeLicensePlate(left) === normalizeLicensePlate(right);
}

export function getPackageLifecycleStatus(
  status: string,
  startDate: Date,
  endDate: Date,
  now = new Date()
): PackageLifecycleStatus {
  if (status === 'cancelled') {
    return 'cancelled';
  }

  const today = startOfDay(now);

  if (new Date(endDate) < today) {
    return 'expired';
  }

  if (new Date(startDate) > today) {
    return 'pending';
  }

  return 'active';
}

function getSpotCategory(spot: SpotRuleInput) {
  const zoneText = `${spot.zone?.name || ''} ${spot.zone?.description || ''} ${spot.spotNumber || ''} ${spot.spotType || ''}`;
  const normalized = normalizeText(zoneText);

  if (normalized.includes('vip')) {
    return 'any';
  }

  if (
    normalized.includes('xe may') ||
    normalized.includes('motor') ||
    normalized.startsWith('khu a') ||
    normalized.startsWith('a')
  ) {
    return 'two-wheel';
  }

  if (
    normalized.includes('o to lon') ||
    normalized.includes('xe tai') ||
    normalized.includes('bus') ||
    normalized.startsWith('khu c') ||
    normalized.startsWith('c')
  ) {
    return 'large-car';
  }

  if (
    normalized.includes('o to con') ||
    normalized.includes('o to') ||
    normalized.includes('car') ||
    normalized.startsWith('khu b') ||
    normalized.startsWith('b')
  ) {
    return 'car';
  }

  return 'any';
}

function getVehicleCategory(vehicleTypeName: string) {
  const normalized = normalizeText(vehicleTypeName);

  if (normalized.includes('xe dap') || normalized.includes('bicycle')) {
    return 'two-wheel';
  }

  if (normalized.includes('xe may') || normalized.includes('motor')) {
    return 'two-wheel';
  }

  if (
    normalized.includes('o to lon') ||
    normalized.includes('xe tai') ||
    normalized.includes('bus')
  ) {
    return 'large-car';
  }

  if (normalized.includes('o to') || normalized.includes('car')) {
    return 'car';
  }

  return 'any';
}

export function isSpotCompatibleWithVehicleType(spot: SpotRuleInput, vehicleTypeName: string) {
  const spotCategory = getSpotCategory(spot);
  const vehicleCategory = getVehicleCategory(vehicleTypeName);

  if (spotCategory === 'any' || vehicleCategory === 'any') {
    return true;
  }

  return spotCategory === vehicleCategory;
}
