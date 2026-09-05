export const PRIMARY_REGISTRATION_AREAS = [
  "Dhaka",
  "Gazipur",
  "Narayanganj",
  "Chattogram",
  "Sylhet",
  "Rajshahi",
  "Khulna",
  "Barishal",
  "Rangpur",
  "Mymensingh",
  "Cumilla",
  "Bagerhat",
  "Bandarban",
  "Barguna",
  "Bhola",
  "Bogura",
  "Brahmanbaria",
  "Chandpur",
  "Chapainawabganj",
  "Chuadanga",
  "Cox's Bazar",
  "Dinajpur",
  "Faridpur",
  "Feni",
  "Gaibandha",
  "Gopalganj",
  "Habiganj",
  "Jamalpur",
  "Jashore",
  "Jhalokathi",
  "Jhenaidah",
  "Joypurhat",
  "Khagrachhari",
  "Kishoreganj",
  "Kurigram",
  "Kushtia",
  "Lakshmipur",
  "Lalmonirhat",
  "Madaripur",
  "Magura",
  "Manikganj",
  "Meherpur",
  "Moulvibazar",
  "Munshiganj",
  "Naogaon",
  "Narail",
  "Narsingdi",
  "Natore",
  "Netrokona",
  "Nilphamari",
  "Noakhali",
  "Pabna",
  "Panchagarh",
  "Patuakhali",
  "Pirojpur",
  "Rajbari",
  "Rangamati",
  "Satkhira",
  "Shariatpur",
  "Sherpur",
  "Sirajganj",
  "Sunamganj",
  "Tangail",
  "Thakurgaon",
];

export const REGISTRATION_AREAS = [
  ...PRIMARY_REGISTRATION_AREAS,
  "Chittagong",
  "Comilla",
  "Bogra",
  "Jessore",
  "Barisal",
];

export const REGISTRATION_CATEGORIES = [
  "Ka",
  "Kha",
  "Ga",
  "Gha",
  "Cha",
  "Chha",
  "Ja",
  "Jha",
  "Ta",
  "Tha",
  "Da",
  "Dha",
  "Na",
  "Pa",
  "Pha",
  "Ba",
  "Bha",
  "Ma",
  "Sha",
  "Sa",
  "Ha",
];

export const CANONICAL_REG_REGEX = /^([A-Za-z' ]+?)(?: ([Mm]etro))?-([A-Za-z]+) (\d{2})-(\d{4})$/i;
export const LEGACY_REG_REGEX = /^(\d{2}-\d{4}|\d{6})$/;

export const findCanonicalArea = (areaStr) => {
  if (!areaStr || typeof areaStr !== "string") return null;
  const clean = areaStr.trim().toLowerCase();
  const found = REGISTRATION_AREAS.find((a) => a.toLowerCase() === clean);
  return found || null;
};

export const findCanonicalCategory = (catStr) => {
  if (!catStr || typeof catStr !== "string") return null;
  const clean = catStr.trim().toLowerCase();
  const found = REGISTRATION_CATEGORIES.find((c) => c.toLowerCase() === clean);
  return found || null;
};

export const formatRegistrationPlate = ({ area, isMetro, category, digits }) => {
  const canonicalArea = findCanonicalArea(area) || (area ? String(area).trim() : "");
  const canonicalCat = findCanonicalCategory(category) || (category ? String(category).trim() : "");
  const cleanDigits = String(digits || "").replace(/\D/g, "").slice(0, 6);
  if (!canonicalArea || !canonicalCat || cleanDigits.length !== 6) return "";
  const prefix = cleanDigits.slice(0, 2);
  const suffix = cleanDigits.slice(2, 6);
  const metroStr = isMetro ? " Metro" : "";
  return `${canonicalArea}${metroStr}-${canonicalCat} ${prefix}-${suffix}`;
};

export const parseRegistrationPlate = (rawStr) => {
  if (!rawStr || typeof rawStr !== "string") return null;
  const trimmed = rawStr.trim();
  const m = trimmed.match(CANONICAL_REG_REGEX);
  if (!m) return null;
  const area = findCanonicalArea(m[1]);
  const category = findCanonicalCategory(m[3]);
  if (!area || !category) return null;
  const isMetro = Boolean(m[2]);
  const digits = `${m[4]}${m[5]}`;
  const formattedDigits = `${m[4]}-${m[5]}`;
  return {
    area,
    isMetro,
    category,
    digits,
    formattedDigits,
    canonical: `${area}${isMetro ? " Metro" : ""}-${category} ${formattedDigits}`,
  };
};

export const validateRegistrationPlate = (rawStr) => {
  if (!rawStr || typeof rawStr !== "string") {
    return {
      valid: false,
      message: "Vehicle registration number is required",
    };
  }
  const trimmed = rawStr.trim();
  if (LEGACY_REG_REGEX.test(trimmed)) {
    return {
      valid: false,
      message: "Enter a valid Bangladesh vehicle registration number (e.g. Dhaka Metro-Ga 12-3456 or Gazipur-Ga 11-2456).",
    };
  }
  const parsed = parseRegistrationPlate(trimmed);
  if (!parsed) {
    return {
      valid: false,
      message: "Enter a valid Bangladesh vehicle registration number (e.g. Dhaka Metro-Ga 12-3456 or Gazipur-Ga 11-2456).",
    };
  }
  return {
    valid: true,
    canonical: parsed.canonical,
    area: parsed.area,
    isMetro: parsed.isMetro,
    category: parsed.category,
    digits: parsed.digits,
    formattedDigits: parsed.formattedDigits,
  };
};

export const isValidCanonicalRegistration = (str) => {
  return validateRegistrationPlate(str).valid;
};

export const isValidLegacyRegistration = (str) => {
  if (!str || typeof str !== "string") return false;
  return LEGACY_REG_REGEX.test(str.trim());
};

export const isValidRegistrationForModel = (str) => {
  return isValidCanonicalRegistration(str) || isValidLegacyRegistration(str);
};

export const generateCanonicalDummyRegistration = () => {
  const prefix = Math.floor(10 + Math.random() * 90);
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `Dhaka Metro-Ga ${prefix}-${suffix}`;
};
