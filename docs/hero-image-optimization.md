# Hero image loading experiment — October 25, 2026

The production asset `wayfarer-hero-v3.jpg` is a real 1672×941 JPEG. A trusted feature-branch GitHub Actions conversion produced `wayfarer-hero-v3.webp` from the same photograph. Both are committed, with the original **untouched** as fallback.

| Property | JPEG | WebP |
| --- | ---: | ---: |
| Size | 366,140 bytes | 200,248 bytes |
| Dimensions | 1672 × 941 | 1672 × 941 |
| Measured change | Baseline | 45.31% fewer bytes |

The conversion ran with `sharp@0.34.5`, WebP quality 82 and effort 6. A sampled-pixel PSNR check produced **38.25 dB**. PSNR is a computational fidelity check and does **not** substitute for visual review of image detail or color.

The HTML uses `<picture>` to offer WebP where supported and the original JPEG as fallback, keeps its original alt text, and preloads the WebP variant. Hero framing, responsive layout and original cinematic animations are unchanged. The write-enabled one-time converter workflow was **removed from the change set** before pull request review. For local regeneration:

```bash
npm install --no-save --package-lock=false --ignore-scripts --no-audit --no-fund sharp@0.34.5
node scripts/optimize-hero.mjs
```

Original converter evidence: https://github.com/teldigi5-wq/wayfarer-world-travel/actions/runs/40156875692

**Performance release gate:** compare the local Lighthouse mobile/tablet/desktop evidence with the benchmark baseline from PR #77 before merging. The smaller byte size is verified, but LCP and overall user experience are not assumed to improve. Validate screenshots and animations on actual devices separately before claiming a production speedup. No live Vercel alias or paid provider is modified by this experiment.
