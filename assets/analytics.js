/**
 * Vercel Web Analytics initialization
 * This script loads and initializes Vercel Web Analytics for the site
 */

(function() {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') return;
  
  // Initialize the analytics queue
  if (!window.va) {
    window.va = function() {
      (window.vaq = window.vaq || []).push(arguments);
    };
  }
  
  // Detect environment
  var isDev = window.location.hostname === 'localhost' || 
              window.location.hostname === '127.0.0.1' ||
              window.location.hostname.includes('dev') ||
              window.location.hostname.includes('staging');
  
  // Set mode
  window.vam = isDev ? 'development' : 'production';
  
  // Only load in production (Vercel deployment)
  if (window.vam === 'production') {
    // The script will be automatically injected by Vercel when analytics is enabled
    // This loads the /_vercel/insights/script.js endpoint created by Vercel
    var script = document.createElement('script');
    script.src = '/_vercel/insights/script.js';
    script.defer = true;
    script.setAttribute('data-sdkn', '@vercel/analytics');
    script.setAttribute('data-sdkv', '2.0.1');
    
    script.onerror = function() {
      console.log('[Vercel Web Analytics] Failed to load. Please enable Web Analytics in your Vercel dashboard.');
    };
    
    document.head.appendChild(script);
  } else {
    console.log('[Vercel Web Analytics] Development mode - analytics disabled');
  }
})();
