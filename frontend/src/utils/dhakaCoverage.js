export const DHAKA_SERVICE_AREA = [
  [23.915, 90.335],
  [23.915, 90.390],
  [23.900, 90.430],
  [23.875, 90.460],
  [23.835, 90.470],
  [23.790, 90.465],
  [23.745, 90.455],
  [23.705, 90.435],
  [23.685, 90.390],
  [23.695, 90.345],
  [23.735, 90.320],
  [23.790, 90.315],
  [23.850, 90.320],
  [23.895, 90.325],
];

export const GAZIPUR_SERVICE_AREA = [
  [24.050, 90.340],
  [24.050, 90.440],
  [24.010, 90.460],
  [23.960, 90.450],
  [23.900, 90.430],
  [23.900, 90.380],
  [23.930, 90.330],
  [23.990, 90.330],
];

export const NARAYANGANJ_SERVICE_AREA = [
  [23.710, 90.450],
  [23.710, 90.530],
  [23.670, 90.550],
  [23.610, 90.550],
  [23.580, 90.530],
  [23.580, 90.480],
  [23.620, 90.450],
  [23.670, 90.440],
];

export const SERVICE_AREAS = [
  DHAKA_SERVICE_AREA,
  GAZIPUR_SERVICE_AREA,
  NARAYANGANJ_SERVICE_AREA,
];

const isPointInPolygon = (lat, lng, polygon) => {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect =
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

export const isInsideServiceArea = (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  return (
    isPointInPolygon(lat, lng, DHAKA_SERVICE_AREA) ||
    isPointInPolygon(lat, lng, GAZIPUR_SERVICE_AREA) ||
    isPointInPolygon(lat, lng, NARAYANGANJ_SERVICE_AREA)
  );
};
