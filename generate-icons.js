// 图标生成脚本
// 需要安装 canvas: npm install canvas

const fs = require('fs');
const { createCanvas } = require('canvas');

// 创建基础图标
function createBaseIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // 背景渐变
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#3b82f6');
  gradient.addColorStop(1, '#1d4ed8');

  // 圆角矩形背景
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // 云朵图标
  ctx.fillStyle = 'white';
  ctx.font = `${size * 0.5}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('☁️', size / 2, size / 2);

  return canvas;
}

// 生成不同尺寸的图标
const sizes = [16, 32, 48, 128];
const iconsDir = './icons';

// 创建 icons 目录
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

sizes.forEach(size => {
  const canvas = createBaseIcon(size);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`${iconsDir}/icon${size}.png`, buffer);
  console.log(`Generated icon${size}.png`);
});

console.log('All icons generated successfully!');