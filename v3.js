const axios = require('axios');
const fs = require('fs').promises;

// Configuration
const BASE_URL = 'http://35.200.185.69:8000';
const V3_URL = `${BASE_URL}/v3/autocomplete`;
const MAX_REQUESTS_PER_MINUTE = 95;
const SPECIAL_CHARS = ".-+ "; // Special characters observed in v3 results

// Tracking variables
const uniqueNames = new Set();
let requestCount = 0;
let requestsInCurrentMinute = 0;
let minuteStartTime = Date.now();

// Helper functions
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  await fs.appendFile('v3_log.txt', `[${timestamp}] ${message}\n`)
    .catch(err => console.error('Error writing to log file:', err));
}

// Rate limit management
async function respectRateLimit() {
  const currentTime = Date.now();
  const elapsedTime = currentTime - minuteStartTime;
  if (elapsedTime >= 60000) {
    requestsInCurrentMinute = 0;
    minuteStartTime = currentTime;
  }
  if (requestsInCurrentMinute >= MAX_REQUESTS_PER_MINUTE) {
    const waitTime = 60000 - elapsedTime + 100;
    await log(`Rate limit approaching. Waiting ${waitTime}ms...`);
    await sleep(waitTime);
    requestsInCurrentMinute = 0;
    minuteStartTime = Date.now();
  }
  requestsInCurrentMinute++;
}

// Make API request with retries
async function makeRequest(query, retries = 3) {
  await respectRateLimit();
  requestCount++;
  try {
    const response = await axios.get(V3_URL, {
      params: { query },
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });
    return response.data.results || [];
  } catch (error) {
    if (error.response && error.response.status === 429 && retries > 0) {
      await log(`Rate limit hit. Waiting 61 seconds...`);
      await sleep(61000);
      return makeRequest(query, retries - 1);
    } else if (retries > 0) {
      await log(`Request error: ${error.message}. Retrying in 2 seconds...`);
      await sleep(2000);
      return makeRequest(query, retries - 1);
    }
    await log(`Failed after ${3 - retries} retries: ${error.message}`);
    return [];
  }
}

// Recursively explore a given prefix
async function explorePrefix(prefix) {
  await log(`Exploring prefix: "${prefix}"`);
  const results = await makeRequest(prefix);
  
  for (const name of results) {
    if (!uniqueNames.has(name)) {
      uniqueNames.add(name);
      await log(`Discovered new name: ${name}`);
      
      // Expand further if the name starts with the current prefix
      if (name.startsWith(prefix)) {
        await explorePrefix(name);
      }
    }
  }
  await saveProgress();
  await sleep(100); // Adjust for rate limits
}

// Extract all names using recursion
async function extractNames() {
  await log('Starting V3 name extraction...');
  
  // Explore single-character prefixes: a-z, 0-9, and special characters
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const startingQueries = [...alphabet, ...digits, ...SPECIAL_CHARS];
  
  for (const query of startingQueries) {
    await explorePrefix(query);
  }
  
  await saveFinalResults();
}

// Save progress to file
async function saveProgress() {
  await fs.writeFile('v3_progress.txt', Array.from(uniqueNames).join('\n'));
  await log(`Progress saved: ${uniqueNames.size} names found so far`);
}

// Save final results
async function saveFinalResults() {
  await fs.writeFile('v3_final_results.txt', Array.from(uniqueNames).join('\n'));
  await log(`V3 extraction complete! Found ${uniqueNames.size} names with ${requestCount} requests.`);
}

// Run extraction
if (require.main === module) {
  (async () => {
    try {
      await fs.writeFile('v3_log.txt', `=== V3 Extraction Started at ${new Date().toISOString()} ===\n`);
      process.on('SIGINT', async () => {
        await log('Received interrupt signal. Saving progress before exit...');
        await saveProgress();
        process.exit(0);
      });
      await extractNames();
    } catch (error) {
      await log(`Fatal error: ${error.message}`);
      await saveProgress();
    }
  })();
}

module.exports = { extractNames };