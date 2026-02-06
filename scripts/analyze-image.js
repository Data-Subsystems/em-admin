// Script to analyze scoreboard image pixel colors
// Run with: node scripts/analyze-image.js

const https = require('https');
const { createCanvas, loadImage } = require('canvas');

const IMAGE_URL = 'https://img.electro-mech.com/images/lx1020-tcart.png';

async function analyzeImage() {
  console.log('Fetching image from:', IMAGE_URL);

  const img = await loadImage(IMAGE_URL);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Collect unique colors
  const colorCounts = new Map();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 10) continue; // Skip transparent

    const key = `${r},${g},${b}`;
    colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
  }

  // Sort by frequency
  const sorted = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`\nImage dimensions: ${img.width}x${img.height}`);
  console.log(`Total pixels: ${img.width * img.height}`);
  console.log(`Unique colors: ${colorCounts.size}`);
  console.log('\nTop 50 most common colors:');
  console.log('Count\t\tRGB\t\t\tHex\t\tCategory');
  console.log('-'.repeat(70));

  sorted.slice(0, 50).forEach(([rgb, count]) => {
    const [r, g, b] = rgb.split(',').map(Number);
    const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');

    // Categorize
    let category = '';
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2 / 255;
    const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1)) / 255;

    if (l < 0.1) category = 'BLACK (LED bg)';
    else if (l > 0.9 && s < 0.1) category = 'WHITE (border/label?)';
    else if (r > 200 && g < 100 && b < 100) category = 'RED (LED)';
    else if (r > 200 && g > 100 && g < 200 && b < 100) category = 'AMBER (LED)';
    else if (r > g && r > b && l < 0.4) category = 'MAROON (label?)';
    else category = 'FACE?';

    console.log(`${count}\t\t${rgb.padEnd(15)}\t${hex}\t\t${category}`);
  });

  // Also sample specific regions
  console.log('\n\nSampling specific regions:');

  // Sample center (likely face color)
  const centerX = Math.floor(img.width / 2);
  const centerY = Math.floor(img.height / 2);
  sampleRegion(data, img.width, centerX - 20, centerY - 20, 40, 40, 'Center region');

  // Sample top edge (likely border)
  sampleRegion(data, img.width, centerX - 20, 2, 40, 5, 'Top edge');

  // Sample a quarter in (where labels might be)
  sampleRegion(data, img.width, img.width / 4, img.height / 4, 40, 20, 'Quarter region');
}

function sampleRegion(data, width, x, y, w, h, name) {
  const colors = new Map();

  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const i = (py * width + px) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = `${r},${g},${b}`;
      colors.set(key, (colors.get(key) || 0) + 1);
    }
  }

  console.log(`\n${name} (${x},${y} ${w}x${h}):`);
  const sorted = [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  sorted.forEach(([rgb, count]) => {
    const hex = '#' + rgb.split(',').map(c => parseInt(c).toString(16).padStart(2, '0')).join('');
    console.log(`  ${count} pixels: rgb(${rgb}) ${hex}`);
  });
}

analyzeImage().catch(console.error);
