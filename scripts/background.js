
// Background script for SDG Badge extension
const API_URL = 'https://aurora-sdg.labs.vu.nl/classifier/classify/aurora-sdg-multi';
const WIDGET_URL = 'https://aurora-sdg.labs.vu.nl/resources/widget.js';
const RATE_LIMIT_DELAY = 200; // 5 requests per second = 200ms between requests

let lastRequestTime = 0;
let requestQueue = [];
let isProcessingQueue = false;

// Rate limiting function
function rateLimit(fn) {
    return function(...args) {
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        
        if (timeSinceLastRequest >= RATE_LIMIT_DELAY) {
            lastRequestTime = now;
            return fn.apply(this, args);
        } else {
            return new Promise((resolve) => {
                const delay = RATE_LIMIT_DELAY - timeSinceLastRequest;
                setTimeout(() => {
                    lastRequestTime = Date.now();
                    resolve(fn.apply(this, args));
                }, delay);
            });
        }
    };
}

// Make API request to Aurora SDG classifier
async function makeApiRequest(text) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return { success: true, data: data };
    } catch (error) {
        console.error('API request failed:', error);
        return { success: false, error: error.message };
    }
}

// Rate-limited API request
const rateLimitedApiRequest = rateLimit(makeApiRequest);

// Message listener for communication with content script and popup
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'classifyText') {
            handleClassifyText(request.text, sendResponse);
            return true; // Keep message channel open for async response
        } else if (request.action === 'testApi') {
            handleTestApi(request.text, sendResponse);
            return true;
        } else if (request.action === 'openSidebar') {
            handleOpenSidebar(sender.tab.id);
        } else if (request.action === 'closeSidebar') {
            handleCloseSidebar(sender.tab.id);
        }
    });
}

// Handle text classification request
async function handleClassifyText(text, sendResponse) {
    if (!text || text.trim().length === 0) {
        sendResponse({ success: false, error: 'No text provided' });
        return;
    }

    try {
        const result = await rateLimitedApiRequest(text);
        
        if (result.success) {
            // Process the API response to create widget data
            const widgetData = processApiResponse(result.data);
            sendResponse({ success: true, data: widgetData });
        } else {
            sendResponse({ success: false, error: result.error });
        }
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

// Handle API test request
async function handleTestApi(text, sendResponse) {
    try {
        const result = await rateLimitedApiRequest(text);
        sendResponse(result);
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

// Handle opening sidebar
async function handleOpenSidebar(tabId) {
    try {
        if (typeof chrome !== 'undefined' && chrome.sidePanel) {
            await chrome.sidePanel.open({ tabId: tabId });
            console.log('Sidebar opened for tab:', tabId);
        } else {
            console.log('Side panel API not available');
        }
    } catch (error) {
        console.error('Error opening sidebar:', error);
    }
}

// Handle closing sidebar
async function handleCloseSidebar(tabId) {
    try {
        if (typeof chrome !== 'undefined' && chrome.sidePanel) {
            // Note: Chrome doesn't have a direct close method, 
            // but we can disable it or handle it differently
            console.log('Sidebar close requested for tab:', tabId);
        }
    } catch (error) {
        console.error('Error closing sidebar:', error);
    }
}

// Process API response to create widget data
function processApiResponse(apiData) {
    try {
        // Return the raw API response with proper format for the official widget
        // The official widget expects: predictions array with prediction, sdg.code, sdg.name
        if (apiData.predictions && apiData.predictions.length > 0) {
            // Transform the API response to match the widget's expected format
            const formattedPredictions = apiData.predictions.map((pred, index) => {
                return {
                    prediction: pred.prediction || pred.prediction_score || 0,
                    sdg: {
                        code: index + 1, // SDG codes are 1-17
                        name: getSDGName(index + 1)
                    }
                };
            });
            
            return {
                predictions: formattedPredictions,
                model: 'aurora-sdg-multi',
                text: apiData.text || ''
            };
        } else {
            return {
                predictions: [],
                model: 'aurora-sdg-multi',
                text: apiData.text || ''
            };
        }
    } catch (error) {
        console.error('Error processing API response:', error);
        return {
            predictions: [],
            model: 'aurora-sdg-multi',
            text: ''
        };
    }
}

// Helper function to get SDG names
function getSDGName(sdgCode) {
    const sdgNames = {
        1: 'No poverty',
        2: 'Zero hunger',
        3: 'Good health and well-being',
        4: 'Quality Education',
        5: 'Gender equality',
        6: 'Clean water and sanitation',
        7: 'Affordable and clean energy',
        8: 'Decent work and economic growth',
        9: 'Industry, innovation and infrastructure',
        10: 'Reduced inequalities',
        11: 'Sustainable cities and communities',
        12: 'Responsible consumption and production',
        13: 'Climate action',
        14: 'Life below water',
        15: 'Life in Land',
        16: 'Peace, Justice and strong institutions',
        17: 'Partnerships for the goals'
    };
    return sdgNames[sdgCode] || 'Unknown SDG';
}

// Initialize extension
function initializeExtension() {
    console.log('SDG Badge extension initialized');
    
    // Set default settings if not already set
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(['viewMode', 'mode', 'badgeSize'], function(result) {
            const defaults = {
                viewMode: result.viewMode || 'popup', // Default to popup mode
                mode: result.mode || 'page',
                badgeSize: result.badgeSize || 250
            };
            
            chrome.storage.sync.set(defaults);
        });
    }
}

// Handle installation
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onInstalled.addListener(() => {
        initializeExtension();
    });
}

// Handle extension startup
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onStartup.addListener(() => {
        initializeExtension();
    });
}
