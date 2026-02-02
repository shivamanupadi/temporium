const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Brand colors
const BRAND_COLOR = '#7c5cff'; // Primary purple
const WHITE = '#ffffff';
const BLACK = '#000000';

// Output directory
const OUTPUT_DIR = path.join(__dirname, '../public');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Generate the Temporium icon SVG
 * An abstract temporal wave - representing flow of time
 * Designed to work across all Temporium apps (Gateway, Node Manager, Playground)
 */
function generateIconSvg(size, options = {}) {
  const { bgColor = BRAND_COLOR, iconColor = WHITE, rounded = true } = options;

  const padding = size * 0.15;
  const iconSize = size - padding * 2;
  const cornerRadius = rounded ? size * 0.15 : 0;
  const cx = size / 2;
  const cy = size / 2;

  // Scale factor for the Temporium icon
  const scale = iconSize / 100;

  // Abstract temporal wave - three flowing curves representing past, present, future
  const wavePath = `
    M 15 50
    Q 30 25, 50 50
    Q 70 75, 85 50
  `;

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="${size * 0.02}" stdDeviation="${size * 0.03}" flood-color="${BLACK}" flood-opacity="0.15"/>
        </filter>
      </defs>
      <!-- Background -->
      <rect
        x="${padding}"
        y="${padding}"
        width="${iconSize}"
        height="${iconSize}"
        rx="${cornerRadius}"
        fill="${bgColor}"
        filter="url(#shadow)"
      />
      <!-- Temporium temporal wave icon -->
      <g transform="translate(${cx - 50 * scale}, ${cy - 50 * scale}) scale(${scale})">
        <path d="${wavePath}" stroke="${iconColor}" stroke-width="8" fill="none" stroke-linecap="round"/>
        <path d="M 15 35 Q 30 10, 50 35 Q 70 60, 85 35" stroke="${iconColor}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.6"/>
        <path d="M 15 65 Q 30 40, 50 65 Q 70 90, 85 65" stroke="${iconColor}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.6"/>
      </g>
    </svg>
  `;
}

/**
 * Generate simple favicon SVG (no shadow, optimized for small sizes)
 */
function generateFaviconSvg() {
  return `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="5" fill="${BRAND_COLOR}"/>
      <g transform="translate(3.2, 3.2) scale(0.256)">
        <path d="M 15 50 Q 30 25, 50 50 Q 70 75, 85 50" stroke="${WHITE}" stroke-width="8" fill="none" stroke-linecap="round"/>
        <path d="M 15 35 Q 30 10, 50 35 Q 70 60, 85 35" stroke="${WHITE}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.6"/>
        <path d="M 15 65 Q 30 40, 50 65 Q 70 90, 85 65" stroke="${WHITE}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.6"/>
      </g>
    </svg>
  `;
}

/**
 * Generate OG image with logo and text
 */
function generateOgImageSvg() {
  const width = 1200;
  const height = 630;
  const logoSize = 120;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0a0a0a"/>
          <stop offset="100%" style="stop-color:#1a1a2e"/>
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="20" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <!-- Background -->
      <rect width="${width}" height="${height}" fill="url(#bgGradient)"/>

      <!-- Subtle grid pattern -->
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${WHITE}" stroke-opacity="0.03" stroke-width="1"/>
      </pattern>
      <rect width="${width}" height="${height}" fill="url(#grid)"/>

      <!-- Accent glow -->
      <circle cx="${width * 0.7}" cy="${height * 0.3}" r="200" fill="${BRAND_COLOR}" opacity="0.1" filter="url(#glow)"/>

      <!-- Logo -->
      <g transform="translate(${width / 2 - logoSize / 2}, ${height / 2 - logoSize - 30})">
        <rect width="${logoSize}" height="${logoSize}" rx="${logoSize * 0.15}" fill="${BRAND_COLOR}"/>
        <g transform="translate(${logoSize * 0.15}, ${logoSize * 0.15}) scale(${logoSize * 0.007})">
          <path d="M 15 50 Q 30 25, 50 50 Q 70 75, 85 50" stroke="${WHITE}" stroke-width="8" fill="none" stroke-linecap="round"/>
          <path d="M 15 35 Q 30 10, 50 35 Q 70 60, 85 35" stroke="${WHITE}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.6"/>
          <path d="M 15 65 Q 30 40, 50 65 Q 70 90, 85 65" stroke="${WHITE}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.6"/>
        </g>
      </g>

      <!-- Text -->
      <text x="${width / 2}" y="${height / 2 + 60}" font-family="Inter, system-ui, sans-serif" font-size="48" font-weight="600" fill="${WHITE}" text-anchor="middle">Temporium</text>
      <text x="${width / 2}" y="${height / 2 + 110}" font-family="Inter, system-ui, sans-serif" font-size="24" fill="${WHITE}" opacity="0.6" text-anchor="middle">The Tempo blockchain platform</text>
    </svg>
  `;
}

/**
 * Generate Apple Touch Icon (solid background, no transparency)
 */
function generateAppleTouchIconSvg(size) {
  const cornerRadius = size * 0.15;
  const cx = size / 2;
  const cy = size / 2;
  const scale = (size / 100) * 0.7;

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="${BRAND_COLOR}"/>
      <g transform="translate(${cx - 50 * scale}, ${cy - 50 * scale}) scale(${scale})">
        <path d="M 15 50 Q 30 25, 50 50 Q 70 75, 85 50" stroke="${WHITE}" stroke-width="8" fill="none" stroke-linecap="round"/>
        <path d="M 15 35 Q 30 10, 50 35 Q 70 60, 85 35" stroke="${WHITE}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.6"/>
        <path d="M 15 65 Q 30 40, 50 65 Q 70 90, 85 65" stroke="${WHITE}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.6"/>
      </g>
    </svg>
  `;
}

async function generateLogos() {
  console.log('Generating Temporium brand logos...\n');

  // 1. Generate favicon.svg
  const faviconSvg = generateFaviconSvg();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'favicon.svg'), faviconSvg.trim());
  console.log('Generated: favicon.svg');

  // 2. Generate PNG favicons
  const faviconSizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-192x192.png', size: 192 },
    { name: 'favicon-512x512.png', size: 512 },
  ];

  for (const { name, size } of faviconSizes) {
    const svg = generateAppleTouchIconSvg(size);
    await sharp(Buffer.from(svg)).png().toFile(path.join(OUTPUT_DIR, name));
    console.log(`Generated: ${name}`);
  }

  // 3. Generate Apple Touch Icon
  const appleTouchSvg = generateAppleTouchIconSvg(180);
  await sharp(Buffer.from(appleTouchSvg))
    .png()
    .toFile(path.join(OUTPUT_DIR, 'apple-touch-icon.png'));
  console.log('Generated: apple-touch-icon.png');

  // 4. Generate logo.png (standard logo)
  const logoSvg = generateIconSvg(512);
  await sharp(Buffer.from(logoSvg)).png().toFile(path.join(OUTPUT_DIR, 'logo.png'));
  console.log('Generated: logo.png');

  // 5. Generate logo-white.png (white icon on transparent)
  const logoWhiteSvg = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(76.8, 76.8) scale(3.584)">
        <path d="M 15 50 Q 30 25, 50 50 Q 70 75, 85 50" stroke="${WHITE}" stroke-width="8" fill="none" stroke-linecap="round"/>
        <path d="M 15 35 Q 30 10, 50 35 Q 70 60, 85 35" stroke="${WHITE}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.6"/>
        <path d="M 15 65 Q 30 40, 50 65 Q 70 90, 85 65" stroke="${WHITE}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.6"/>
      </g>
    </svg>
  `;
  await sharp(Buffer.from(logoWhiteSvg)).png().toFile(path.join(OUTPUT_DIR, 'logo-white.png'));
  console.log('Generated: logo-white.png');

  // 6. Generate logo-dark.png (dark icon on transparent)
  const logoDarkSvg = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(76.8, 76.8) scale(3.584)">
        <path d="M 15 50 Q 30 25, 50 50 Q 70 75, 85 50" stroke="${BLACK}" stroke-width="8" fill="none" stroke-linecap="round"/>
        <path d="M 15 35 Q 30 10, 50 35 Q 70 60, 85 35" stroke="${BLACK}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.6"/>
        <path d="M 15 65 Q 30 40, 50 65 Q 70 90, 85 65" stroke="${BLACK}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.6"/>
      </g>
    </svg>
  `;
  await sharp(Buffer.from(logoDarkSvg)).png().toFile(path.join(OUTPUT_DIR, 'logo-dark.png'));
  console.log('Generated: logo-dark.png');

  // 7. Generate OG image
  const ogSvg = generateOgImageSvg();
  await sharp(Buffer.from(ogSvg)).png().toFile(path.join(OUTPUT_DIR, 'og-image.png'));
  console.log('Generated: og-image.png');

  console.log('\nAll logos generated successfully!');
  console.log(`Output directory: ${OUTPUT_DIR}`);
}

generateLogos().catch(console.error);
