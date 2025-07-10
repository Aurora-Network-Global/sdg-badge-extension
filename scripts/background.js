
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

// Process API response to create widget data
function processApiResponse(apiData) {
    try {
        // Extract predictions from API response
        const predictions = apiData.predictions || [];
        
        // Find the highest scoring prediction
        let topPrediction = null;
        let maxScore = 0;
        
        predictions.forEach(prediction => {
            if (prediction.prediction_score > maxScore) {
                maxScore = prediction.prediction_score;
                topPrediction = prediction;
            }
        });

        if (topPrediction) {
            return {
                sdgGoal: topPrediction.sdg_goal,
                score: topPrediction.prediction_score,
                iconUrl: topPrediction.icon_url,
                predictions: predictions
            };
        } else {
            return {
                sdgGoal: 'No Classification',
                score: 0,
                iconUrl: null,
                predictions: []
            };
        }
    } catch (error) {
        console.error('Error processing API response:', error);
        return {
            sdgGoal: 'Processing Error',
            score: 0,
            iconUrl: null,
            predictions: []
        };
    }
}

// Initialize extension
function initializeExtension() {
    console.log('SDG Badge extension initialized');
    
    // Set default settings if not already set
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(['mode', 'badgeSize'], function(result) {
            const defaults = {
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
