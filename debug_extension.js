// Debug script for TubeFocus Extension
// Run this in the browser console to test extension functionality

console.log('🔍 TubeFocus Extension Debug Script');

// Test 1: Check if extension is loaded
function testExtensionLoaded() {
  console.log('1. Testing extension loading...');
  
  // Check if background script is accessible
  try {
    chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('❌ Background script not responding:', chrome.runtime.lastError);
      } else {
        console.log('✅ Background script responding');
      }
    });
  } catch (error) {
    console.log('❌ Extension not loaded or accessible:', error);
  }
}

// Test 2: Check storage
function testStorage() {
  console.log('2. Testing storage...');
  
  chrome.storage.local.get(['sessionActive', 'goal'], (result) => {
    console.log('📦 Storage contents:', result);
  });
}

// Test 3: Test API connection
async function testAPIConnection() {
  console.log('3. Testing API connection...');
  
  try {
    const response = await fetch('https://yt-scorer-api-bd5usk72uq-uc.a.run.app/health');
    const text = await response.text();
    console.log('✅ API Health Check:', text);
  } catch (error) {
    console.log('❌ API Connection failed:', error);
  }
}

// Test 4: Simulate start session
function testStartSession() {
  console.log('4. Testing start session...');
  
  const testMessage = {
    type: 'START_SESSION',
    duration: 30, // 30 minutes
    goal: 'productivity',
    scoreMode: ['title', 'description']
  };
  
  console.log('📤 Sending start session message:', testMessage);
  
  chrome.runtime.sendMessage(testMessage, (response) => {
    if (chrome.runtime.lastError) {
      console.log('❌ Start session failed:', chrome.runtime.lastError);
    } else {
      console.log('✅ Start session response:', response);
    }
  });
}

// Test 5: Check popup elements
function testPopupElements() {
  console.log('5. Testing popup elements...');
  
  const elements = [
    'goalInput',
    'sessionDuration',
    'startSession',
    'stopSession',
    'scoreDisplay'
  ];
  
  elements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      console.log(`✅ Element found: ${id}`);
    } else {
      console.log(`❌ Element missing: ${id}`);
    }
  });
}

// Run all tests
function runAllTests() {
  console.log('🚀 Running all debug tests...\n');
  
  testExtensionLoaded();
  setTimeout(testStorage, 1000);
  setTimeout(testAPIConnection, 2000);
  setTimeout(testStartSession, 3000);
  setTimeout(testPopupElements, 4000);
}

// Export functions for manual testing
window.tubeFocusDebug = {
  testExtensionLoaded,
  testStorage,
  testAPIConnection,
  testStartSession,
  testPopupElements,
  runAllTests
};

console.log('💡 Use tubeFocusDebug.runAllTests() to run all tests');
console.log('💡 Or run individual tests like tubeFocusDebug.testStartSession()'); 