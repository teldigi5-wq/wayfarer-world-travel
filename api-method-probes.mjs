/* Vercel serverless routes: inspect only their rejected HTTP method.
 * These non-executing requests are NOT a verification of real services.
 * Change this reviewed list whenever the deployed API surface changes.
 * Do not probe a route using its accepted method in the release inspector. */
export const API_METHOD_PROBES=Object.freeze([
  Object.freeze({path:'/api/intelligence',source:'api/intelligence.js',accepted:'GET',probe:'POST',allow:'GET'}),
  Object.freeze({path:'/api/explore',source:'api/explore.js',accepted:'GET',probe:'POST',allow:null}),
  Object.freeze({path:'/api/hotels',source:'api/hotels.js',accepted:'GET',probe:'POST',allow:'GET'}),
  Object.freeze({path:'/api/travel-search',source:'api/travel-search.js',accepted:'POST',probe:'GET',allow:'POST'}),
  Object.freeze({path:'/api/ai-plan',source:'api/ai-plan.mjs',accepted:'POST',probe:'GET',allow:'POST'}),
  Object.freeze({path:'/api/travel-offers',source:'api/travel-offers.mjs',accepted:'POST',probe:'GET',allow:'POST'}),
  Object.freeze({path:'/api/flight-selection',source:'api/flight-selection.mjs',accepted:'POST',probe:'GET',allow:'POST'}),
  Object.freeze({path:'/api/airline-offers',source:'api/airline-offers.mjs',accepted:'POST',probe:'GET',allow:'POST'})
]);
