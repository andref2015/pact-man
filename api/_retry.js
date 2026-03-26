/**
 * Fetch wrapper with retry for transient OpenRouter errors (502, 503).
 * Retries up to 3 times with exponential backoff (1s, 2s, 4s).
 */
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.ok || attempt === maxRetries) return response;

    // Only retry on transient server errors
    if (response.status !== 502 && response.status !== 503) return response;

    const delay = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
    console.warn(`OpenRouter ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
    await new Promise(r => setTimeout(r, delay));
  }
}

module.exports = { fetchWithRetry };
