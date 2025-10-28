/**
 * Test script to verify text suppression functionality
 */

// const axios = require('axios'); // Not needed for this logic test

const BASE_URL = 'http://localhost:4000';

async function testTextSuppression() {
  console.log('🧪 Testing text suppression functionality...');
  
  try {
    // Simulate signing with text suppression parameters
    const signingData = {
      signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', // Simple 1x1 pixel
      consent: true,
      placement: {
        pageNumber: 1,
        x: 0.5,
        y: 0.3,
        width: 0.25,
        height: 0.08
      },
      
      // ALL the text suppression parameters we're sending from frontend
      hideText: true,
      imageOnly: true,
      suppressText: true,
      noText: true,
      showText: false,
      cleanSignatureOnly: true,
      
      config: {
        hideText: true,
        signatureOnly: true,
        noMetadata: true
      }
    };
    
    console.log('📝 Signing data includes text suppression flags:', {
      hideText: signingData.hideText,
      imageOnly: signingData.imageOnly,
      suppressText: signingData.suppressText,
      config: signingData.config
    });
    
    // Test URL parameters as well
    const url = `${BASE_URL}/sign/test-link-123?notext=true&imageonly=true&hidetext=true`;
    
    console.log('🔗 URL with suppression parameters:', url);
    
    // This would normally make the request to test, but since we don't have a test envelope,
    // let's just verify our logic is working
    console.log('✅ Text suppression parameters ready to be tested');
    console.log('📋 Next step: Sign a real document and check if text is removed from PDF');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Check if any of the text suppression conditions would be met
function checkSuppressionLogic(params) {
  const {
    hideText, imageOnly, suppressText, noText, showText,
    config, settings, preferences
  } = params;
  
  const suppressSignatureText = (
    hideText === true ||
    imageOnly === true ||
    suppressText === true ||
    noText === true ||
    showText === false ||
    config?.hideText === true ||
    config?.signatureOnly === true ||
    config?.noMetadata === true
  );
  
  return suppressSignatureText;
}

// Test the suppression logic
console.log('🧪 Testing suppression logic:');

const testParams1 = { hideText: true };
console.log('hideText: true =>', checkSuppressionLogic(testParams1));

const testParams2 = { imageOnly: true };
console.log('imageOnly: true =>', checkSuppressionLogic(testParams2));

const testParams3 = { config: { signatureOnly: true } };
console.log('config.signatureOnly: true =>', checkSuppressionLogic(testParams3));

const testParams4 = { showText: false };
console.log('showText: false =>', checkSuppressionLogic(testParams4));

testTextSuppression();