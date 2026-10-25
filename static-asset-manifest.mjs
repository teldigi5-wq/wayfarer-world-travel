// The only static files needed by the current Wayfarer customer-facing experience.
// Root api/ serverless functions are deliberately NOT included in static output.
// Review changes to this list alongside a real Vercel preview deployment.
export const PUBLIC_ASSETS=Object.freeze([
  'index.html',
  'premium-base.css',
  'premium-motion.css',
  'experience-layer.css',
  'art-direction.css',
  'arrival-journeys.css',
  'legibility-system.css',
  'premium-motion.js',
  'travel-research.js',
  'experience-layer.js',
  'art-direction.js',
  'premium-app.js',
  'data.json',
  'wayfarer-hero-v3.webp',
  'wayfarer-hero-v3.jpg',
  'robots.txt',
  'sitemap.xml'
]);
