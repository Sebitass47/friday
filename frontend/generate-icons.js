const fs = require('fs');
const path = require('path');

// Create SVG with color for PNG generation
const createColoredSVG = (isDark = true) => {
  const color = isDark ? '#FFFFFF' : '#000000';
  return `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="256" cy="256" r="240" fill="${color}" opacity="0.1"/>
  <g transform="translate(256, 256)">
    <rect x="-90" y="-50" width="40" height="100" rx="20" fill="${color}" opacity="0.7"/>
    <rect x="-20" y="-100" width="40" height="150" rx="20" fill="${color}" opacity="0.85"/>
    <rect x="50" y="-150" width="40" height="200" rx="20" fill="${color}"/>
    <circle cx="0" cy="50" r="16" fill="${color}"/>
  </g>
</svg>`;
};

// Create icons directory
const publicDir = path.join(__dirname, 'public');

// Write dark version (for general use)
fs.writeFileSync(
  path.join(publicDir, 'icon.svg'),
  createColoredSVG(true)
);

console.log('✅ SVG icon generated');
console.log('📝 Install sharp to generate PNG icons:');
console.log('   npm install sharp');
console.log('   Then run: node generate-icons.js --png');

// If --png flag, try to generate PNGs
if (process.argv.includes('--png')) {
  try {
    const sharp = require('sharp');

    const sizes = [
      { size: 192, name: 'icon-192.png' },
      { size: 512, name: 'icon-512.png' },
      { size: 180, name: 'apple-touch-icon.png' },
      { size: 32, name: 'favicon-32x32.png' },
      { size: 16, name: 'favicon-16x16.png' },
    ];

    const svg = createColoredSVG(true);

    Promise.all(
      sizes.map(({ size, name }) =>
        sharp(Buffer.from(svg))
          .resize(size, size)
          .png()
          .toFile(path.join(publicDir, name))
          .then(() => console.log(`✅ Generated ${name}`))
      )
    ).then(() => {
      console.log('🎉 All PNG icons generated!');
    });
  } catch (err) {
    console.error('❌ sharp not installed. Run: npm install sharp');
  }
}
