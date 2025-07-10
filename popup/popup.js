
// Popup script for SDG Badge extension
document.addEventListener('DOMContentLoaded', function() {
    const modeToggle = document.getElementById('mode-toggle');
    const modeIndicator = document.getElementById('mode-indicator');
    const sizeSlider = document.getElementById('size-slider');
    const sizeValue = document.getElementById('size-value');
    const testButton = document.getElementById('test-api');
    const apiStatus = document.getElementById('api-status');

    // Load saved settings
    loadSettings();

    // Mode toggle event listener
    modeToggle.addEventListener('change', function() {
        const isSelectMode = this.checked;
        const mode = isSelectMode ? 'select' : 'page';
        const modeText = isSelectMode ? 'Text Selection' : 'Page Content';
        
        modeIndicator.textContent = modeText;
        
        // Save setting
        saveSetting('mode', mode);
        
        // Notify content script
        sendToActiveTab({ action: 'updateMode', mode: mode });
    });

    // Size slider event listener
    sizeSlider.addEventListener('input', function() {
        const size = parseInt(this.value);
        sizeValue.textContent = size + 'px';
        
        // Save setting
        saveSetting('badgeSize', size);
        
        // Notify content script
        sendToActiveTab({ action: 'updateSize', size: size });
    });

    // Test API button event listener
    testButton.addEventListener('click', function() {
        testApiConnection();
    });

    // Load settings from storage
    function loadSettings() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.sync.get(['mode', 'badgeSize'], function(result) {
                const mode = result.mode || 'page';
                const size = result.badgeSize || 250;
                
                modeToggle.checked = mode === 'select';
                modeIndicator.textContent = mode === 'select' ? 'Text Selection' : 'Page Content';
                sizeSlider.value = size;
                sizeValue.textContent = size + 'px';
            });
        }
    }

    // Save individual setting
    function saveSetting(key, value) {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.sync.set({ [key]: value });
        }
    }

    // Send message to active tab
    function sendToActiveTab(message) {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, message);
                }
            });
        }
    }

    // Test API connection
    function testApiConnection() {
        const originalText = testButton.textContent;
        testButton.textContent = 'Testing...';
        testButton.disabled = true;
        
        // Send test message to background script
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
                action: 'testApi',
                text: 'This is a test message to verify API connectivity.'
            }, function(response) {
                testButton.textContent = originalText;
                testButton.disabled = false;
                
                if (response && response.success) {
                    showApiStatus('API connection successful!', 'success');
                } else {
                    showApiStatus('API connection failed. Please check your internet connection.', 'error');
                }
            });
        }
    }

    // Show API status message
    function showApiStatus(message, type) {
        apiStatus.textContent = message;
        apiStatus.className = `api-status ${type} show`;
        
        setTimeout(() => {
            apiStatus.classList.remove('show');
        }, 3000);
    }
});
