import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const source = path.resolve('assets-src/illustrations/study-desk.png');
const output = path.resolve('public/illustrations');
const widths = [480, 960, 1600];

await fs.mkdir(output, { recursive: true });
for (const name of await fs.readdir(output))
  if (/^study-desk-.*\.(avif|webp|jpg)$/.test(name))
    await fs.rm(path.join(output, name), { force: true });
const generated = [];

for (const width of widths) {
  const resize = sharp(source).rotate().resize({ width });
  const avifPath = path.join(output, `study-desk-${width}.avif`);
  const webpPath = path.join(output, `study-desk-${width}.webp`);
  await Promise.all([
    resize.clone().avif({ quality: 46, effort: 6 }).toFile(avifPath),
    resize.clone().webp({ quality: 56, effort: 6 }).toFile(webpPath),
  ]);
  generated.push(avifPath, webpPath);
}

const fallbackPath = path.join(output, 'study-desk-960.jpg');
await sharp(source)
  .flatten({ background: '#145d42' })
  .resize({ width: 960, withoutEnlargement: true })
  .jpeg({ quality: 78, mozjpeg: true })
  .toFile(fallbackPath);
generated.push(fallbackPath);

const sizes = await Promise.all(generated.map(async (file) => [file, (await fs.stat(file)).size]));
const modernVariants = sizes.filter(([file]) => /\.(avif|webp)$/.test(file));
const largest = Math.max(...modernVariants.map(([, size]) => size));
const average = Math.round(
  modernVariants.reduce((total, [, size]) => total + size, 0) / modernVariants.length,
);
for (const [file, size] of sizes)
  console.log(`${path.relative(process.cwd(), file)}: ${(size / 1024).toFixed(1)} KB`);
if (largest > 150 * 1024 || average > 60 * 1024)
  throw new Error(
    `Modern image budget exceeded: largest ${largest} bytes, average ${average} bytes.`,
  );
