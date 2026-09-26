/**
 * Genera ilustraciones SVG para los vehículos de demostración (5-6 vistas por vehículo).
 * Los vehículos que publiquen los usuarios usan fotografías reales (JPG/PNG/WEBP).
 */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (pct < 0 ? c : 255 - c) * pct)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// Siluetas laterales (lienzo 800x450, suelo en y=382)
const BODIES = {
  sedan: {
    body: 'M80 330 C80 300 95 285 130 280 L260 268 C300 225 340 200 400 196 L520 196 C565 198 600 225 640 262 L700 272 C722 278 728 300 725 330 Z',
    windows: ['M285 266 C320 232 350 212 400 210 L455 210 L455 266 Z', 'M470 210 L515 210 C550 212 580 235 610 264 L470 266 Z'],
    wheels: [215, 590], r: 48, door: 462,
  },
  suv: {
    body: 'M78 335 L80 280 C82 262 95 255 125 252 L235 245 L290 180 C298 170 308 166 325 166 L600 166 C625 166 640 176 650 195 L690 250 C715 256 725 270 725 295 L725 335 Z',
    windows: ['M305 245 L340 184 L450 184 L450 245 Z', 'M465 184 L590 184 C605 184 615 190 622 200 L655 245 L465 245 Z'],
    wheels: [220, 590], r: 52, door: 457,
  },
  pickup: {
    body: 'M75 335 L78 282 C80 262 92 256 120 254 L225 248 L275 185 C283 176 293 172 308 172 L440 172 C455 172 462 180 463 195 L465 250 L720 250 L722 335 Z',
    windows: ['M290 246 L322 190 L372 190 L372 246 Z', 'M385 190 L440 190 C446 190 448 194 448 200 L448 246 L385 246 Z'],
    wheels: [205, 600], r: 52, door: 378, bed: true,
  },
  hatch: {
    body: 'M95 335 L98 290 C102 272 118 265 150 262 L250 255 C295 212 330 192 380 190 L570 190 C595 190 610 205 625 235 L655 285 C662 300 662 315 660 335 Z',
    windows: ['M272 252 C305 220 335 204 380 204 L440 204 L440 252 Z', 'M455 204 L565 204 C580 204 590 214 598 232 L608 252 L455 252 Z'],
    wheels: [215, 560], r: 46, door: 447,
  },
  coupe: {
    body: 'M80 335 C80 305 95 292 135 288 L290 276 C345 225 390 208 450 208 C520 208 570 235 630 272 L705 282 C725 288 730 310 726 335 Z',
    windows: ['M318 272 C360 236 395 222 450 222 L470 222 L470 272 Z', 'M485 222 C525 224 560 244 590 270 L485 272 Z'],
    wheels: [220, 600], r: 48, door: 478,
  },
  van: {
    body: 'M80 335 L82 205 C84 175 100 162 135 162 L600 162 C630 162 648 175 660 200 L700 262 C718 270 725 285 725 305 L725 335 Z',
    windows: ['M140 178 L250 178 L250 240 L140 240 Z', 'M265 178 L420 178 L420 240 L265 240 Z', 'M435 178 L590 178 C610 178 622 186 632 202 L655 240 L435 240 Z'],
    wheels: [200, 600], r: 48, door: 428,
  },
  truck: {
    body: 'M525 330 L525 190 C525 178 533 172 545 172 L640 172 C660 172 672 182 682 200 L718 262 C726 275 728 290 728 330 Z',
    box: 'M70 330 L70 120 L515 120 L515 330 Z',
    windows: ['M560 188 L640 188 C652 188 660 196 666 208 L690 250 L560 250 Z'],
    wheels: [170, 330, 630], r: 50, door: 600,
  },
};

function defs(color) {
  return `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCEBFF"/><stop offset="1" stop-color="#F7FAFF"/></linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E7ECF4"/><stop offset="1" stop-color="#D5DCE7"/></linearGradient>
    <linearGradient id="paint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(color, 0.25)}"/><stop offset="0.55" stop-color="${color}"/><stop offset="1" stop-color="${shade(color, -0.25)}"/></linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#CFE4FA"/><stop offset="1" stop-color="#7FA6CF"/></linearGradient>
    <radialGradient id="rim"><stop offset="0" stop-color="#F2F4F8"/><stop offset="1" stop-color="#9AA3B2"/></radialGradient>
  </defs>`;
}

function frame(inner, { title, view, lot, color }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="1200" height="750">
  ${defs(color)}
  <rect width="800" height="500" fill="url(#sky)"/>
  <rect y="360" width="800" height="140" fill="url(#floor)"/>
  ${inner}
  <rect x="0" y="448" width="800" height="52" fill="#FFFFFF" opacity="0.92"/>
  <text x="22" y="480" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#1F2A44">${esc(title)}</text>
  <text x="778" y="480" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="16" fill="#5B6B8C">${esc(view)}</text>
  <rect x="16" y="14" rx="8" width="150" height="30" fill="#FFFFFF" opacity="0.9"/>
  <text x="30" y="35" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="800" fill="#1D64F2">AutoPuja<tspan fill="#F5A524"> GT</tspan></text>
  <rect x="654" y="14" rx="8" width="130" height="30" fill="#1D64F2"/>
  <text x="719" y="35" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" fill="#FFFFFF">LOTE ${esc(lot)}</text>
</svg>`;
}

function wheel(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r + 7}" fill="#1F232B" opacity="0.18"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#2B2F38"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="url(#rim)"/>
    ${[0, 72, 144, 216, 288].map((a) => `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos((a * Math.PI) / 180) * r * 0.5}" y2="${cy + Math.sin((a * Math.PI) / 180) * r * 0.5}" stroke="#8791A3" stroke-width="5"/>`).join('')}
    <circle cx="${cx}" cy="${cy}" r="${r * 0.14}" fill="#5B6475"/>`;
}

function damageSide(level, frontX) {
  if (level === 'AMARILLO') {
    return `<g stroke="#6B4E16" stroke-width="3" fill="none" opacity="0.75">
      <path d="M${frontX - 110} 292 q 18 -14 36 0 q 18 14 36 0"/>
      <path d="M${frontX - 100} 305 l 60 -6"/><path d="M${frontX - 96} 312 l 44 -3"/>
      <ellipse cx="${frontX - 70}" cy="300" rx="34" ry="14" fill="#000" opacity="0.12" stroke="none"/>
    </g>`;
  }
  if (level === 'ROJO') {
    return `<g>
      <path d="M${frontX - 80} 255 L${frontX - 40} 262 L${frontX - 60} 280 L${frontX - 20} 290 L${frontX - 45} 305 L${frontX + 5} 318 L${frontX + 5} 336 L${frontX - 120} 336 L${frontX - 100} 300 Z" fill="#4A4F5C" opacity="0.55"/>
      <g stroke="#2B2F38" stroke-width="3" fill="none">
        <path d="M${frontX - 90} 262 l 25 18 l -15 12 l 30 14 l -12 16"/>
        <path d="M${frontX - 150} 250 l 20 30 l -10 20"/>
        <path d="M${frontX - 210} 230 l 30 18 l 20 -6 l 18 22"/>
      </g>
      <ellipse cx="${frontX - 30}" cy="200" rx="60" ry="28" fill="#9AA3B2" opacity="0.35"/>
      <ellipse cx="${frontX - 70}" cy="175" rx="45" ry="20" fill="#9AA3B2" opacity="0.25"/>
    </g>`;
  }
  return '';
}

function sideView(o) {
  if (o.body === 'moto') return motoSide(o);
  const b = BODIES[o.body] || BODIES.sedan;
  const wy = 382 - b.r;
  const lastWheel = b.wheels[b.wheels.length - 1];
  return `<ellipse cx="400" cy="384" rx="330" ry="16" fill="#1F2A44" opacity="0.14"/>
    ${b.box ? `<path d="${b.box}" fill="#F4F6FA" stroke="#C9D2E0" stroke-width="3"/><rect x="70" y="250" width="445" height="22" fill="${o.color}"/>` : ''}
    <path d="${b.body}" fill="url(#paint)" stroke="${shade(o.color, -0.35)}" stroke-width="2"/>
    ${b.bed ? `<path d="M470 262 L716 262" stroke="${shade(o.color, -0.4)}" stroke-width="4"/>` : ''}
    ${b.windows.map((w) => `<path d="${w}" fill="url(#glass)" stroke="${shade(o.color, -0.45)}" stroke-width="3"/>`).join('')}
    <line x1="${b.door}" y1="${b.box ? 190 : 250}" x2="${b.door}" y2="325" stroke="${shade(o.color, -0.35)}" stroke-width="2"/>
    <rect x="${b.door - 42}" y="${b.box ? 268 : 282}" width="26" height="7" rx="3" fill="${shade(o.color, -0.4)}"/>
    <ellipse cx="${b.box ? 718 : 712}" cy="${b.box ? 280 : 288}" rx="12" ry="8" fill="#FFF6C8" stroke="#C9A43A" stroke-width="2"/>
    ${b.box ? '' : `<rect x="82" y="${o.body === 'hatch' ? 280 : 290}" width="14" height="16" rx="3" fill="#E5484D"/>`}
    ${b.wheels.map((x) => wheel(x, wy, b.r)).join('')}
    ${damageSide(o.damage, b.box ? 715 : lastWheel + 120)}`;
}

function motoSide(o) {
  return `<ellipse cx="405" cy="384" rx="250" ry="12" fill="#1F2A44" opacity="0.14"/>
    ${wheel(250, 312, 70)}${wheel(565, 312, 70)}
    <g stroke="#3A404D" stroke-width="10" stroke-linecap="round" fill="none">
      <path d="M250 312 L360 290 L430 250"/><path d="M565 312 L515 190"/><path d="M360 290 L470 292 L520 230"/>
    </g>
    <path d="M495 190 L540 172" stroke="#3A404D" stroke-width="8" stroke-linecap="round"/>
    <rect x="370" y="262" width="80" height="50" rx="10" fill="#8791A3"/>
    <path d="M345 230 C380 190 450 185 495 205 L505 232 L470 250 L360 250 Z" fill="url(#paint)" stroke="${shade(o.color, -0.35)}" stroke-width="2"/>
    <path d="M250 232 C280 220 320 222 350 232 L345 248 L262 250 Z" fill="#2B2F38"/>
    <ellipse cx="528" cy="205" rx="12" ry="10" fill="#FFF6C8" stroke="#C9A43A" stroke-width="2"/>
    ${damageSide(o.damage, 600)}`;
}

function frontView(o, rear = false) {
  const c = o.color;
  const lights = rear
    ? `<rect x="215" y="232" width="70" height="24" rx="8" fill="#E5484D"/><rect x="515" y="232" width="70" height="24" rx="8" fill="#E5484D"/>`
    : `<ellipse cx="250" cy="245" rx="38" ry="18" fill="#FFF6C8" stroke="#C9A43A" stroke-width="3"/><ellipse cx="550" cy="245" rx="38" ry="18" fill="#FFF6C8" stroke="#C9A43A" stroke-width="3"/>`;
  const center = rear
    ? `<rect x="345" y="262" width="110" height="36" rx="5" fill="#FFFFFF" stroke="#8791A3" stroke-width="3"/><text x="400" y="287" text-anchor="middle" font-family="Consolas, monospace" font-size="18" font-weight="700" fill="#1F2A44">P-${esc(String(o.lot).slice(-3))}ABC</text>`
    : `<rect x="325" y="248" width="150" height="40" rx="12" fill="#3A404D"/>${[0, 1, 2, 3].map((i) => `<line x1="335" y1="${256 + i * 8}" x2="465" y2="${256 + i * 8}" stroke="#8791A3" stroke-width="2"/>`).join('')}`;
  let dmg = '';
  if (o.damage === 'AMARILLO') {
    dmg = `<g stroke="#6B4E16" stroke-width="3" fill="none" opacity="0.8"><path d="M${rear ? 470 : 520} 300 q 20 -12 40 0 q 20 12 40 0"/><path d="M${rear ? 480 : 530} 312 l 50 -4"/></g>`;
  } else if (o.damage === 'ROJO') {
    dmg = `<path d="M470 215 L520 240 L500 262 L560 280 L540 330 L440 330 L455 285 Z" fill="#4A4F5C" opacity="0.55"/>
      <g stroke="#2B2F38" stroke-width="3" fill="none"><path d="M360 175 l 30 20 l -12 15 l 25 12"/><path d="M430 170 l -18 25 l 20 10"/><path d="M500 245 l 30 10 l -10 25 l 25 20"/></g>`;
  }
  return `<ellipse cx="400" cy="384" rx="240" ry="14" fill="#1F2A44" opacity="0.14"/>
    <rect x="202" y="320" width="56" height="62" rx="12" fill="#2B2F38"/><rect x="542" y="320" width="56" height="62" rx="12" fill="#2B2F38"/>
    <path d="M190 335 L195 250 C200 225 215 215 240 212 L285 160 C295 148 305 145 320 145 L480 145 C495 145 505 148 515 160 L560 212 C585 215 600 225 605 250 L610 335 Z" fill="url(#paint)" stroke="${shade(c, -0.35)}" stroke-width="2"/>
    <path d="M300 208 L325 162 L475 162 L500 208 Z" fill="url(#glass)" stroke="${shade(c, -0.45)}" stroke-width="3"/>
    <rect x="198" y="300" width="404" height="22" rx="8" fill="${shade(c, -0.3)}"/>
    ${lights}${center}${dmg}`;
}

function interiorView(o) {
  return `<rect x="0" y="0" width="800" height="448" fill="#F3EEE6"/>
    <path d="M0 250 C200 180 600 180 800 250 L800 448 L0 448 Z" fill="#D9D3C9"/>
    <path d="M60 260 C250 200 550 200 740 260 L740 300 C550 245 250 245 60 300 Z" fill="#B9B2A6"/>
    <rect x="345" y="235" width="110" height="70" rx="10" fill="#2B2F38"/>
    <rect x="352" y="242" width="96" height="56" rx="6" fill="#4F8FEA"/>
    <circle cx="220" cy="300" r="95" fill="none" stroke="#3A404D" stroke-width="22"/>
    <circle cx="220" cy="300" r="26" fill="#3A404D"/>
    <path d="M130 300 L194 300 M246 300 L310 300 M220 326 L220 390" stroke="#3A404D" stroke-width="18"/>
    <circle cx="185" cy="232" r="24" fill="#FFFFFF" stroke="#8791A3" stroke-width="4"/><circle cx="255" cy="232" r="24" fill="#FFFFFF" stroke="#8791A3" stroke-width="4"/>
    <line x1="185" y1="232" x2="198" y2="220" stroke="#E5484D" stroke-width="3"/><line x1="255" y1="232" x2="244" y2="218" stroke="#E5484D" stroke-width="3"/>
    <rect x="520" y="300" width="160" height="140" rx="30" fill="${shade(o.color, -0.15)}" opacity="0.55"/>
    <text x="600" y="385" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#1F2A44">${esc(o.transmission)}</text>
    ${o.damage === 'ROJO' ? '<g stroke="#9AA3B2" stroke-width="3" fill="none" opacity="0.8"><path d="M420 40 l 40 50 l -20 30 l 50 40"/><path d="M470 60 l -30 60 l 40 20"/></g>' : ''}`;
}

function engineView(o) {
  const cyl = Math.min(o.cylinders || 0, 8);
  const electric = cyl === 0;
  const rows = cyl > 4 ? 2 : 1;
  const perRow = Math.ceil(cyl / rows);
  let caps = '';
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < perRow && r * perRow + i < cyl; i++) {
      caps += `<circle cx="${320 + i * (160 / Math.max(perRow - 1, 1))}" cy="${rows === 1 ? 250 : 222 + r * 58}" r="18" fill="#D5DCE7" stroke="#5B6475" stroke-width="4"/>`;
    }
  }
  return `<rect x="0" y="0" width="800" height="448" fill="#EEF2F8"/>
    <path d="M110 110 L690 110 L730 400 L70 400 Z" fill="${shade(o.color, -0.1)}" opacity="0.35"/>
    <path d="M150 140 L650 140 L680 380 L120 380 Z" fill="#C9D0DC"/>
    ${electric
      ? `<rect x="250" y="170" width="300" height="160" rx="16" fill="#4F8FEA"/><text x="400" y="265" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="48" font-weight="800" fill="#FFFFFF">EV</text>`
      : `<rect x="280" y="180" width="240" height="${rows === 1 ? 140 : 150}" rx="18" fill="#8791A3" stroke="#5B6475" stroke-width="4"/>${caps}`}
    <rect x="570" y="190" width="70" height="55" rx="6" fill="#2B2F38"/><rect x="582" y="182" width="12" height="10" fill="#E5484D"/><rect x="614" y="182" width="12" height="10" fill="#3A404D"/>
    <circle cx="190" cy="250" r="38" fill="#9AA3B2" stroke="#5B6475" stroke-width="4"/>
    <text x="400" y="365" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" fill="#1F2A44">${esc(o.engine)}</text>
    ${o.damage === 'ROJO' ? '<path d="M600 280 L660 300 L640 340 L690 360" stroke="#2B2F38" stroke-width="4" fill="none"/><ellipse cx="560" cy="120" rx="80" ry="30" fill="#9AA3B2" opacity="0.4"/>' : ''}`;
}

function detailView(o) {
  const yellow = o.damage === 'AMARILLO';
  return `<rect x="0" y="0" width="800" height="448" fill="url(#paint)"/>
    <rect x="0" y="0" width="800" height="448" fill="#FFFFFF" opacity="0.08"/>
    ${yellow
      ? `<ellipse cx="400" cy="230" rx="170" ry="80" fill="#000" opacity="0.14"/><g stroke="#3B2B0B" stroke-width="5" fill="none" opacity="0.7"><path d="M250 220 q 50 -40 100 0 q 50 40 100 0 q 40 -30 80 0"/><path d="M280 270 l 240 -20"/><path d="M300 290 l 170 -12"/></g>`
      : `<path d="M180 80 L300 150 L260 220 L380 260 L330 340 L520 400 L620 300 L560 220 L640 150 L500 120 L420 60 Z" fill="#3A404D" opacity="0.6"/><g stroke="#1F232B" stroke-width="5" fill="none"><path d="M300 150 l 60 60 l -40 50 l 90 40"/><path d="M500 120 l -30 90 l 70 40 l -20 70"/><path d="M420 60 l 10 80 l -60 30"/></g>`}
    <rect x="24" y="60" rx="10" width="260" height="44" fill="#FFFFFF" opacity="0.92"/>
    <circle cx="50" cy="82" r="10" fill="${yellow ? '#F5A524' : '#EF4444'}"/>
    <text x="70" y="89" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="#1F2A44">${yellow ? 'Daño medio / Reparable' : 'Daño severo / Salvamento'}</text>`;
}

/** Devuelve un arreglo de { contentType, buffer } para un vehículo demo. */
function buildDemoImages(o) {
  const views = [
    ['Vista lateral', sideView(o)],
    ['Vista frontal', frontView(o)],
    ['Vista trasera', frontView(o, true)],
    ['Interior', interiorView(o)],
    ['Motor', engineView(o)],
  ];
  if (o.damage !== 'VERDE') views.splice(1, 0, ['Detalle del daño', detailView(o)]);
  return views.map(([view, inner]) => ({
    contentType: 'image/svg+xml',
    buffer: Buffer.from(frame(inner, { title: o.title, view, lot: o.lot, color: o.color }), 'utf8'),
  }));
}

module.exports = { buildDemoImages };
