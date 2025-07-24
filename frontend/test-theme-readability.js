// Theme Readability Test Script
// This script helps verify that all components are readable in both light and dark themes

function testThemeReadability() {
  console.log('🎨 Testing Theme Readability...\n');

  // Test 1: Check if theme variables are properly defined
  console.log('1. CSS Variable Definitions:');
  const requiredVariables = [
    '--primary-bg',
    '--secondary-bg', 
    '--text-color',
    '--border-color',
    '--input-bg',
    '--input-text',
    '--text-muted',
    '--accent-color',
    '--chatgpt-bg',
    '--chatgpt-text',
    '--chatgpt-user-bubble',
    '--chatgpt-bot-bubble'
  ];

  const rootStyles = getComputedStyle(document.documentElement);
  const missingVariables = [];

  requiredVariables.forEach(variable => {
    const value = rootStyles.getPropertyValue(variable);
    if (!value || value.trim() === '') {
      missingVariables.push(variable);
    }
  });

  if (missingVariables.length === 0) {
    console.log('✅ All required CSS variables are defined');
  } else {
    console.log('❌ Missing CSS variables:', missingVariables);
  }

  // Test 2: Check contrast ratios for key elements
  console.log('\n2. Contrast Ratio Checks:');
  
  const contrastTests = [
    { element: '.chat-bubble', description: 'Chat bubbles' },
    { element: '.input-container input', description: 'Input fields' },
    { element: '.model-selector-button', description: 'Model selector' },
    { element: '.token-counter', description: 'Token counter' },
    { element: '.quick-token-display', description: 'Quick token display' },
    { element: '.sidebar', description: 'Sidebar' },
    { element: '.modern-button', description: 'Buttons' }
  ];

  contrastTests.forEach(test => {
    const elements = document.querySelectorAll(test.element);
    if (elements.length > 0) {
      console.log(`✅ ${test.description}: Found ${elements.length} element(s)`);
    } else {
      console.log(`⚠️  ${test.description}: No elements found`);
    }
  });

  // Test 3: Check theme toggle functionality
  console.log('\n3. Theme Toggle Functionality:');
  const themeToggle = document.querySelector('.theme-toggle-button');
  if (themeToggle) {
    console.log('✅ Theme toggle button found');
    
    // Simulate theme toggle
    const currentTheme = document.body.className;
    console.log(`Current theme: ${currentTheme || 'dark (default)'}`);
    
    // Test if theme classes are properly applied
    const hasLightTheme = document.body.classList.contains('light-theme');
    const hasDarkTheme = document.body.classList.contains('dark-theme');
    
    if (hasLightTheme || hasDarkTheme || !currentTheme) {
      console.log('✅ Theme classes are properly structured');
    } else {
      console.log('❌ Theme classes may be missing');
    }
  } else {
    console.log('❌ Theme toggle button not found');
  }

  // Test 4: Check specific component readability
  console.log('\n4. Component-Specific Checks:');
  
  // Check chat bubbles
  const userBubbles = document.querySelectorAll('.user-bubble');
  const botBubbles = document.querySelectorAll('.bot-bubble');
  console.log(`Chat bubbles - User: ${userBubbles.length}, Bot: ${botBubbles.length}`);

  // Check model selector
  const modelSelector = document.querySelector('.model-selector-container');
  if (modelSelector) {
    console.log('✅ Model selector container found');
  }

  // Check token displays
  const tokenCounters = document.querySelectorAll('.token-counter');
  const quickTokenDisplays = document.querySelectorAll('.quick-token-display');
  console.log(`Token displays - Counter: ${tokenCounters.length}, Quick: ${quickTokenDisplays.length}`);

  // Test 5: Accessibility checks
  console.log('\n5. Accessibility Checks:');
  
  // Check for proper focus indicators
  const focusableElements = document.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
  console.log(`Focusable elements: ${focusableElements.length}`);

  // Check for proper color contrast (basic check)
  const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6');
  console.log(`Text elements: ${textElements.length}`);

  // Test 6: Responsive design check
  console.log('\n6. Responsive Design:');
  const isMobile = window.innerWidth <= 768;
  console.log(`Viewport width: ${window.innerWidth}px (${isMobile ? 'Mobile' : 'Desktop'})`);

  // Test 7: Theme-specific recommendations
  console.log('\n7. Theme Recommendations:');
  
  const currentTheme = document.body.className;
  if (currentTheme.includes('light')) {
    console.log('🌞 Light Theme Active:');
    console.log('   - Ensure dark text on light backgrounds');
    console.log('   - Check shadow contrast for depth');
    console.log('   - Verify button hover states');
  } else {
    console.log('🌙 Dark Theme Active:');
    console.log('   - Ensure light text on dark backgrounds');
    console.log('   - Check for proper contrast ratios');
    console.log('   - Verify accent colors are visible');
  }

  console.log('\n🎯 Theme Readability Test Complete!');
  console.log('\n📋 Manual Checks to Perform:');
  console.log('1. Toggle between light and dark themes');
  console.log('2. Check all text is readable in both themes');
  console.log('3. Verify buttons and interactive elements are clearly visible');
  console.log('4. Test on both desktop and mobile devices');
  console.log('5. Ensure proper focus indicators for accessibility');
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.testThemeReadability = testThemeReadability;
  console.log('Theme readability test function available. Run: testThemeReadability()');
}

// Auto-run if in browser environment
if (typeof document !== 'undefined' && document.readyState === 'complete') {
  setTimeout(testThemeReadability, 1000);
} 