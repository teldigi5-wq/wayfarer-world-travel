// Release-safe, deterministic media encoding from our real source photo.
// Run only in the trusted feature-branch workflow with sharp@0.34.5.
import sharp from 'sharp';
import {statSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const original='wayfarer-hero-v3.jpg';
const optimized='wayfarer-hero-v3.webp';
const sourceMeta=await sharp(original).metadata();
assert.equal(sourceMeta.format,'jpeg','Expected reviewed JPEG source');
assert.ok(sourceMeta.width>600&&sourceMeta.height>300,'Unexpected hero resolution');
await sharp(original).webp({quality:82,effort:6}).toFile(optimized);
const resultMeta=await sharp(optimized).metadata();
assert.equal(resultMeta.width,sourceMeta.width,'Unexpected width');
assert.equal(resultMeta.height,sourceMeta.height,'Unexpected height');
assert.equal(resultMeta.format,'webp');

const jpegBytes=statSync(original).size;
const webpBytes=statSync(optimized).size;
const saving=(1-webpBytes/jpegBytes)*100;
assert.ok(saving>=25,'Optimization must save at least 25% without degrading fidelity');

const sourcePixels=await sharp(original).removeAlpha().toColourspace('srgb').raw().toBuffer();
const resultPixels=await sharp(optimized).removeAlpha().toColourspace('srgb').raw().toBuffer();
assert.equal(resultPixels.length,sourcePixels.length,'Raw pixel size differs');
let squares=0,n=0;
for(let i=0;i<sourcePixels.length;i+=31){
  const d=sourcePixels[i]-resultPixels[i];
  squares+=d*d;
  n++;
}
const mse=squares/n,psnr=mse===0?99:10*Math.log10(255*255/mse);
assert.ok(psnr>=32,'Image quality floor not met (PSNR <32dB)');
const report={input:original,output:optimized,width:sourceMeta.width,height:sourceMeta.height,
  jpegBytes,webpBytes,savedPercent:Number(saving.toFixed(2)),
  psnrDb:Number(psnr.toFixed(2)),quality:82,effort:6,
  note:'PSNR is a sampled pixel metric, not a visual QA replacement; original JPEG retained as fallback.'};
console.log('HERO_MEDIA_BENCH '+JSON.stringify(report));
writeFileSync('hero-optimization-summary.json',JSON.stringify(report,null,2)+'\n');
