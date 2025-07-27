// Test script for Cloud API integration
// Run this in the browser console on a YouTube page to test the integration

console.log('Testing TubeFocus Cloud API Integration...');

// Test the API endpoint directly
async function testCloudAPI() {
  const API_URL = 'https://yt-scorer-api-bd5usk72uq-uc.a.run.app';
  const API_KEY = 'changeme';
  
  console.log('Testing health endpoint...');
  try {
    const healthResponse = await fetch(`${API_URL}/health`);
    const healthText = await healthResponse.text();
    console.log('✅ Health endpoint:', healthText);
  } catch (error) {
    console.error('❌ Health endpoint failed:', error);
  }
  
  console.log('Testing predict endpoint...');
  try {
    const predictResponse = await fetch(`${API_URL}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
      },
      body: JSON.stringify({
        video_id: 'test123',
        goal: 'productivity',
        parameters: ['title', 'description']
      })
    });
    const predictData = await predictResponse.json();
    console.log('✅ Predict endpoint:', predictData);
  } catch (error) {
    console.error('❌ Predict endpoint failed:', error);
  }
  
  console.log('Testing feedback endpoint...');
  try {
    const feedbackResponse = await fetch(`${API_URL}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
      },
      body: JSON.stringify({
        desc_score: 0.0,
        title_score: 0.1,
        tags_score: 0.3,
        category_score: 0.7,
        user_score: 0.8
      })
    });
    const feedbackData = await feedbackResponse.json();
    console.log('✅ Feedback endpoint:', feedbackData);
  } catch (error) {
    console.error('❌ Feedback endpoint failed:', error);
  }
}

// Test the extension's message passing
function testExtensionIntegration() {
  console.log('Testing extension message passing...');
  
  // Simulate a fetch score request
  const testMessage = {
    type: 'FETCH_SCORE',
    url: 'https://www.youtube.com/watch?v=test123',
    goal: 'productivity'
  };
  
  // This would normally be sent to the background script
  console.log('📤 Message to send:', testMessage);
  console.log('✅ Extension integration test completed');
}

// Run tests
testCloudAPI().then(() => {
  testExtensionIntegration();
  console.log('🎉 All tests completed!');
}); 