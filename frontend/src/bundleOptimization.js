// Bundle optimization utilities and performance monitoring

// Preload critical routes
export const preloadRoutes = () => {
  // Preload critical components that are likely to be used
  const criticalImports = [
    () => import('./components/PricingPage'),
    () => import('./components/UsageDashboard'),
  ];

  // Preload on idle
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      criticalImports.forEach(importFn => importFn());
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      criticalImports.forEach(importFn => importFn());
    }, 2000);
  }
};

// Performance monitoring
export const measurePerformance = () => {
  if ('performance' in window) {
    // Measure First Contentful Paint
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          console.log('FCP:', entry.startTime);
        }
      }
    });
    
    try {
      observer.observe({ entryTypes: ['paint'] });
    } catch (e) {
      // Ignore if not supported
    }

    // Measure bundle size impact
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation && navigation.loadEventEnd > navigation.fetchStart) {
        console.log('Page Load Time:', navigation.loadEventEnd - navigation.fetchStart);
        console.log('DOM Content Loaded:', navigation.domContentLoadedEventEnd - navigation.fetchStart);
      }
    });
  }
};

// Tree shaking helpers - mark unused exports for elimination
export const optimizeImports = {
  // Only import what we need from large libraries
  reactBootstrap: {
    // Instead of: import { Button, Modal } from 'react-bootstrap'
    // Use specific imports to help tree shaking
    Button: () => import('react-bootstrap/Button'),
    Modal: () => import('react-bootstrap/Modal'),
  },
  
  mui: {
    // MUI tree shaking is already optimized with their babel plugin
    // But we can still be explicit about what we use
    icons: () => import('@mui/icons-material'),
    material: () => import('@mui/material'),
  }
};

// Bundle size monitoring
export const bundleMetrics = {
  // Track component render performance
  trackComponentRender: (componentName, renderTime) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${componentName} render time:`, renderTime);
    }
  },

  // Memory usage tracking
  trackMemoryUsage: () => {
    if ('memory' in performance) {
      const memory = performance.memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1048576), // MB
        total: Math.round(memory.totalJSHeapSize / 1048576), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1048576), // MB
      };
    }
    return null;
  }
};

// Chunk loading optimization
export const optimizeChunkLoading = () => {
  // Prefetch likely-to-be-used chunks
  const prefetchChunks = [
    '/static/js/pricing.',
    '/static/js/dashboard.',
  ];

  prefetchChunks.forEach(chunk => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = chunk;
    document.head.appendChild(link);
  });
};
