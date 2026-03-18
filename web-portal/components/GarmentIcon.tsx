'use client';

/**
 * GarmentIcon - SVG garment silhouettes for product placeholders
 *
 * Replaces emoji placeholders with elegant, Lucide-style SVG icons.
 * Uses stroke="currentColor" fill="none" for consistent theming.
 * All icons use viewBox="0 0 64 64" for uniform sizing.
 */

const GARMENT_MATCHERS: Array<{ keywords: string[]; type: string }> = [
  { keywords: ['camisa', 'camiseta'], type: 'shirt' },
  { keywords: ['blusa'], type: 'blouse' },
  { keywords: ['pantalon', 'jean'], type: 'pants' },
  { keywords: ['falda'], type: 'skirt' },
  { keywords: ['sudadera', 'buzo', 'chompa'], type: 'hoodie' },
  { keywords: ['zapato', 'tennis'], type: 'sneaker' },
  { keywords: ['media', 'calcet'], type: 'socks' },
  { keywords: ['correa', 'cinturon'], type: 'belt' },
  { keywords: ['yomber'], type: 'measuring-tape' },
];

/**
 * Returns the garment category key for a given product name.
 * Matches case-insensitively against known keywords.
 */
export function getGarmentType(productName: string): string {
  const name = productName.toLowerCase();
  for (const matcher of GARMENT_MATCHERS) {
    if (matcher.keywords.some((kw) => name.includes(kw))) {
      return matcher.type;
    }
  }
  return 'default';
}

const STROKE_WIDTH = 1.8;

const svgProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 64 64',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: STROKE_WIDTH,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/**
 * Polo shirt / camisa silhouette
 * Clean collar, short sleeves, straight body
 */
function ShirtIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Collar */}
      <polyline points="28,10 32,16 36,10" />
      {/* Neckline / shoulders */}
      <path d="M28,10 L20,14 L14,22 L18,24 L22,18 L22,52 L42,52 L42,18 L46,24 L50,22 L44,14 L36,10" />
      {/* Collar detail */}
      <line x1="28" y1="10" x2="25" y2="14" />
      <line x1="36" y1="10" x2="39" y2="14" />
      {/* Sleeve hems */}
      <line x1="14" y1="22" x2="18" y2="24" />
      <line x1="46" y1="24" x2="50" y2="22" />
      {/* Hem line */}
      <line x1="22" y1="52" x2="42" y2="52" />
      {/* Placket */}
      <line x1="32" y1="16" x2="32" y2="30" />
      {/* Button dots */}
      <circle cx="32" cy="20" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="32" cy="25" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Blouse silhouette
 * Rounded collar, slight waist taper, cap sleeves
 */
function BlouseIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Rounded collar */}
      <path d="M27,11 C29,14 35,14 37,11" />
      {/* Body with waist */}
      <path d="M27,11 L19,15 L13,24 L17,26 L21,19 L20,34 L22,36 L22,52 L42,52 L42,36 L44,34 L43,19 L47,26 L51,24 L45,15 L37,11" />
      {/* Collar curves */}
      <path d="M27,11 C25,13 24,15 25,17" />
      <path d="M37,11 C39,13 40,15 39,17" />
      {/* Waist seam */}
      <path d="M22,36 C28,34 36,34 42,36" />
      {/* Hem */}
      <line x1="22" y1="52" x2="42" y2="52" />
    </svg>
  );
}

/**
 * Pants / trousers silhouette
 * Waistband, two legs, front crease lines
 */
function PantsIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Waistband */}
      <rect x="18" y="8" width="28" height="4" rx="1" />
      {/* Pants body */}
      <path d="M18,12 L16,54 L28,54 L31,30 L32,30 L33,30 L36,54 L48,54 L46,12" />
      {/* Belt loops */}
      <line x1="23" y1="8" x2="23" y2="12" />
      <line x1="32" y1="8" x2="32" y2="12" />
      <line x1="41" y1="8" x2="41" y2="12" />
      {/* Front creases */}
      <line x1="22" y1="16" x2="22" y2="50" strokeDasharray="2 4" strokeWidth="1" />
      <line x1="42" y1="16" x2="42" y2="50" strokeDasharray="2 4" strokeWidth="1" />
      {/* Hem lines */}
      <line x1="16" y1="54" x2="28" y2="54" />
      <line x1="36" y1="54" x2="48" y2="54" />
    </svg>
  );
}

/**
 * Skirt silhouette
 * Waistband, A-line flare
 */
function SkirtIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Waistband */}
      <rect x="20" y="10" width="24" height="4" rx="1" />
      {/* A-line body */}
      <path d="M20,14 L12,54 L52,54 L44,14" />
      {/* Pleats / folds */}
      <line x1="26" y1="14" x2="22" y2="54" strokeWidth="1" strokeDasharray="3 4" />
      <line x1="32" y1="14" x2="32" y2="54" strokeWidth="1" strokeDasharray="3 4" />
      <line x1="38" y1="14" x2="42" y2="54" strokeWidth="1" strokeDasharray="3 4" />
      {/* Hem */}
      <line x1="12" y1="54" x2="52" y2="54" />
    </svg>
  );
}

/**
 * Hoodie / sudadera silhouette
 * Hood, kangaroo pocket, long sleeves, ribbed hem
 */
function HoodieIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Hood */}
      <path d="M26,14 C24,8 28,4 32,4 C36,4 40,8 38,14" />
      {/* Neckline */}
      <path d="M26,14 C29,17 35,17 38,14" />
      {/* Body and long sleeves */}
      <path d="M26,14 L18,18 L8,30 L10,32 L16,28 L16,52 L48,52 L48,28 L54,32 L56,30 L46,18 L38,14" />
      {/* Sleeve cuffs */}
      <line x1="8" y1="30" x2="10" y2="32" />
      <line x1="54" y1="32" x2="56" y2="30" />
      {/* Kangaroo pocket */}
      <path d="M24,36 L24,44 L40,44 L40,36" />
      <path d="M24,36 C28,34 36,34 40,36" />
      {/* Drawstrings */}
      <line x1="30" y1="17" x2="29" y2="22" />
      <line x1="34" y1="17" x2="35" y2="22" />
      {/* Ribbed hem */}
      <line x1="16" y1="52" x2="48" y2="52" />
      <line x1="17" y1="54" x2="47" y2="54" />
    </svg>
  );
}

/**
 * Sneaker / zapato silhouette
 * Athletic shoe profile, sole, laces
 */
function SneakerIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Shoe upper */}
      <path d="M14,36 L14,26 C14,20 20,16 26,16 L30,16 C32,16 34,18 34,20 L34,28 L50,28 C54,28 58,32 58,36 L58,40 C58,44 54,46 50,46 L14,46 C10,46 8,44 8,40 L8,38 C8,36 10,36 14,36 Z" />
      {/* Sole */}
      <path d="M8,44 C8,48 10,50 14,50 L50,50 C54,50 58,48 58,44" />
      <line x1="8" y1="46" x2="58" y2="46" />
      {/* Toe cap detail */}
      <path d="M50,28 C52,28 54,30 54,32" strokeWidth="1.2" />
      {/* Lace area */}
      <line x1="24" y1="18" x2="28" y2="22" strokeWidth="1.2" />
      <line x1="26" y1="17" x2="30" y2="21" strokeWidth="1.2" />
      <line x1="28" y1="16.5" x2="32" y2="20.5" strokeWidth="1.2" />
      {/* Ankle opening */}
      <path d="M14,26 C14,22 18,18 22,16" strokeWidth="1.2" />
      {/* Sole tread */}
      <line x1="14" y1="50" x2="14" y2="48" strokeWidth="1" />
      <line x1="22" y1="50" x2="22" y2="48" strokeWidth="1" />
      <line x1="30" y1="50" x2="30" y2="48" strokeWidth="1" />
      <line x1="38" y1="50" x2="38" y2="48" strokeWidth="1" />
      <line x1="46" y1="50" x2="46" y2="48" strokeWidth="1" />
    </svg>
  );
}

/**
 * Socks silhouette
 * Ankle sock with ribbed cuff, heel and toe shaping
 */
function SocksIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Cuff ribbing */}
      <line x1="22" y1="8" x2="40" y2="8" />
      <line x1="22" y1="10" x2="40" y2="10" />
      {/* Sock body */}
      <path d="M22,10 L22,38 C22,44 18,48 14,50 C10,52 10,56 16,56 L40,56 C46,56 48,52 48,48 C48,44 44,40 40,38 L40,10" />
      {/* Heel reinforcement */}
      <path d="M22,32 C20,36 20,40 22,44" strokeWidth="1.2" strokeDasharray="2 3" />
      {/* Toe line */}
      <path d="M20,54 C24,52 36,52 42,54" strokeWidth="1.2" />
      {/* Ribbing detail lines */}
      <line x1="26" y1="8" x2="26" y2="10" strokeWidth="1" />
      <line x1="30" y1="8" x2="30" y2="10" strokeWidth="1" />
      <line x1="34" y1="8" x2="34" y2="10" strokeWidth="1" />
      <line x1="38" y1="8" x2="38" y2="10" strokeWidth="1" />
    </svg>
  );
}

/**
 * Belt / correa silhouette
 * Belt strap with buckle, prong, and holes
 */
function BeltIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Belt strap */}
      <rect x="4" y="26" width="56" height="12" rx="2" />
      {/* Buckle frame */}
      <rect x="8" y="23" width="12" height="18" rx="2" />
      {/* Buckle prong */}
      <line x1="14" y1="24" x2="22" y2="32" strokeWidth="2" />
      {/* Belt holes */}
      <circle cx="30" cy="32" r="1.5" />
      <circle cx="36" cy="32" r="1.5" />
      <circle cx="42" cy="32" r="1.5" />
      <circle cx="48" cy="32" r="1.5" />
      {/* Keeper loop */}
      <rect x="22" y="25" width="4" height="14" rx="1" strokeWidth="1.2" />
      {/* Tip */}
      <path d="M56,26 L60,32 L56,38" strokeWidth="1.2" />
    </svg>
  );
}

/**
 * Measuring tape / yomber silhouette
 * Rolled tape measure with markings
 */
function MeasuringTapeIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Tape roll body */}
      <circle cx="24" cy="32" r="16" />
      <circle cx="24" cy="32" r="8" />
      {/* Extended tape */}
      <path d="M40,28 L56,20 L58,24 L42,32" />
      {/* Tape markings on roll */}
      <line x1="24" y1="16" x2="24" y2="19" strokeWidth="1" />
      <line x1="33" y1="19" x2="31" y2="21" strokeWidth="1" />
      <line x1="37" y1="26" x2="35" y2="27" strokeWidth="1" />
      {/* Tape markings on extended part */}
      <line x1="44" y1="28" x2="44" y2="26" strokeWidth="1" />
      <line x1="47" y1="27" x2="47" y2="25" strokeWidth="1" />
      <line x1="50" y1="25.5" x2="50" y2="23.5" strokeWidth="1" />
      <line x1="53" y1="24" x2="53" y2="22" strokeWidth="1" />
      {/* Center dot */}
      <circle cx="24" cy="32" r="2" fill="currentColor" stroke="none" />
      {/* Tape end hook */}
      <path d="M56,20 L58,19 L59,21 L58,24" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Default garment icon - clothes hanger silhouette
 * Clean hanger shape, universal garment placeholder
 */
function DefaultGarmentIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Hook */}
      <path d="M32,6 C30,6 28,8 28,10 C28,12 30,14 32,14" />
      {/* Hook top curl */}
      <path d="M32,6 C34,4 36,5 36,7" />
      {/* Hanger arms */}
      <path d="M32,14 L10,30 C8,31 8,34 10,35 L12,35" />
      <path d="M32,14 L54,30 C56,31 56,34 54,35 L52,35" />
      {/* Hanger bar */}
      <line x1="12" y1="35" x2="52" y2="35" />
      {/* Garment suggestion - simple drape */}
      <path d="M14,35 L12,52 L52,52 L50,35" strokeDasharray="3 2" strokeWidth="1.2" />
      {/* Bottom hem */}
      <line x1="12" y1="52" x2="52" y2="52" strokeWidth="1.2" />
    </svg>
  );
}

// Component map for garment types
const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  shirt: ShirtIcon,
  blouse: BlouseIcon,
  pants: PantsIcon,
  skirt: SkirtIcon,
  hoodie: HoodieIcon,
  sneaker: SneakerIcon,
  socks: SocksIcon,
  belt: BeltIcon,
  'measuring-tape': MeasuringTapeIcon,
  default: DefaultGarmentIcon,
};

interface GarmentIconProps {
  productName: string;
  className?: string;
}

/**
 * GarmentIcon component
 *
 * Renders an SVG garment silhouette based on the product name.
 * Uses case-insensitive keyword matching to determine the garment type.
 * All SVGs use currentColor for stroke, making them themeable via text-color classes.
 *
 * @example
 * <GarmentIcon productName="Camisa Polo Escolar" className="w-16 h-16 text-gray-400" />
 * <GarmentIcon productName="Pantalon Azul" className="w-12 h-12 text-brand-600" />
 */
export default function GarmentIcon({ productName, className }: GarmentIconProps) {
  const type = getGarmentType(productName);
  const IconComponent = ICON_MAP[type] || ICON_MAP.default;
  return <IconComponent className={className} />;
}
