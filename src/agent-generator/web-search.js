/**
 * Web search service using Firecrawl API
 */
const axios = require('axios');
require('dotenv').config();

/**
 * Firecrawl API configuration
 */
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_SEARCH_URL = 'https://api.firecrawl.dev/search';
const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/scrape';
const ENABLE_DEBUG = process.env.DEBUG === 'true';

/**
 * Perform a web search using Firecrawl's SERP API
 * 
 * @param {string} query - The search query
 * @param {object} options - Additional search options
 * @returns {Promise<object>} - Search results containing cleaned markdown content
 */
async function performWebSearch(query, options = {}) {
  // Default options
  const defaultOptions = {
    numResults: 3,           // Number of search results to fetch
    includeScrapes: true,    // Include scraped content from search results
    timeout: 30000,          // Timeout in milliseconds
  };

  // Merge default options with provided options
  const searchOptions = { ...defaultOptions, ...options };

  // Log the API key status (without revealing the actual key)
  if (!FIRECRAWL_API_KEY) {
    console.warn('Firecrawl API key not configured. Web search functionality is disabled.');
    return {
      success: false,
      error: 'Firecrawl API key not configured',
      results: []
    };
  } else if (FIRECRAWL_API_KEY === 'your_firecrawl_api_key_here') {
    console.warn('Firecrawl API key is using the placeholder value. Web search functionality is disabled.');
    return {
      success: false,
      error: 'Firecrawl API key not properly configured',
      results: []
    };
  }

  // For testing without making actual API calls
  if (process.env.MOCK_WEB_SEARCH === 'true') {
    console.log('Using mock web search data');
    return {
      success: true,
      results: [
        {
          title: 'Mock Search Result 1',
          url: 'https://example.com/result1',
          snippet: 'This is a mock result for testing purposes.',
          content: 'This is mock content for the first search result.'
        },
        {
          title: 'Mock Search Result 2',
          url: 'https://example.com/result2',
          snippet: 'Another mock result for testing.',
          content: 'This is mock content for the second search result.'
        }
      ]
    };
  }

  try {
    console.log(`Performing web search for query: "${query}"`);
    if (ENABLE_DEBUG) {
      console.log(`Using Firecrawl API key: ${FIRECRAWL_API_KEY.substring(0, 5)}...`);
      console.log(`Search options:`, JSON.stringify(searchOptions, null, 2));
    }
    
    // Prepare the request payload
    const payload = {
      query: query,
      numResults: searchOptions.numResults,
      includeScrapes: searchOptions.includeScrapes
    };
    
    if (ENABLE_DEBUG) {
      console.log('Search request payload:', JSON.stringify(payload, null, 2));
    }
    
    // Make request to Firecrawl search API
    const response = await axios.post(FIRECRAWL_SEARCH_URL, payload, {
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: searchOptions.timeout
    });

    // Process and return search results
    if (response.data && response.data.results) {
      console.log(`Web search completed successfully with ${response.data.results.length} results`);
      if (ENABLE_DEBUG) {
        console.log('First result:', response.data.results[0]?.url);
      }
      
      return {
        success: true,
        results: response.data.results.map(result => ({
          title: result.title || 'Untitled',
          url: result.url,
          content: result.content || '',
          snippet: result.snippet || result.description || ''
        }))
      };
    } else {
      console.warn('Empty or invalid response from Firecrawl API');
      if (ENABLE_DEBUG && response.data) {
        console.log('Response data:', JSON.stringify(response.data, null, 2));
      }
      
      return {
        success: false,
        error: 'Empty or invalid response from search API',
        results: []
      };
    }
  } catch (error) {
    // Detailed error logging to help with debugging
    console.error('Error performing web search:');
    if (error.response) {
      // The server responded with a status code outside of 2xx range
      console.error(`Status code: ${error.response.status}`);
      console.error(`Response message: ${error.response.statusText}`);
      if (ENABLE_DEBUG) {
        console.error(`Response data:`, error.response.data);
        console.error(`Response headers:`, error.response.headers);
      }
      
      // Handle common error codes
      if (error.response.status === 401) {
        return {
          success: false,
          error: 'Authentication failed: Invalid API key',
          results: []
        };
      } else if (error.response.status === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded for the Firecrawl API',
          results: []
        };
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from search API');
      if (ENABLE_DEBUG) {
        console.error('Request details:', error.request);
      }
    } else {
      // Error during request setup
      console.error('Error creating search request:', error.message);
    }
    
    // Provide a more user-friendly error message
    const errorMessage = error.response?.data?.message || error.message || 'Unknown search error';
    return {
      success: false,
      error: `Search failed: ${errorMessage}`,
      results: []
    };
  }
}

/**
 * Extract relevant context from search results for a specific task
 * 
 * @param {string} task - The user's task description
 * @param {Array} searchResults - Results from web search
 * @returns {string} - Condensed context extracted from search results
 */
function extractSearchContext(task, searchResults) {
  if (!searchResults || !searchResults.length) {
    return '';
  }

  // Create a markdown formatted context from search results
  let context = `# Web Search Context for: "${task}"\n\n`;
  
  searchResults.forEach((result, index) => {
    context += `## [${result.title}](${result.url})\n\n`;
    
    // Add the snippet or a portion of the content
    if (result.snippet) {
      context += result.snippet + '\n\n';
    } else if (result.content) {
      // Limit content length to avoid overwhelming the context
      const contentPreview = result.content.length > 1000 
        ? result.content.substring(0, 1000) + '...'
        : result.content;
      
      context += contentPreview + '\n\n';
    }
    
    // Add separator between results
    if (index < searchResults.length - 1) {
      context += '---\n\n';
    }
  });
  
  return context;
}

/**
 * Deep scrape a specific website using Firecrawl's API
 * Useful for getting detailed information about a specific website
 * 
 * @param {string} url - The URL to scrape
 * @param {object} options - Additional scrape options
 * @returns {Promise<object>} - Scrape results containing cleaned markdown content
 */
async function scrapeWebsite(url, options = {}) {
  // Default options
  const defaultOptions = {
    crawlLinks: false,     // Whether to crawl internal links
    maxDepth: 1,           // Maximum depth to crawl
    timeout: 40000,        // Timeout in milliseconds
    maxPages: 3,           // Maximum number of pages to crawl
  };

  // Merge default options with provided options
  const scrapeOptions = { ...defaultOptions, ...options };

  // Check API key configuration
  if (!FIRECRAWL_API_KEY || FIRECRAWL_API_KEY === 'your_firecrawl_api_key_here') {
    console.warn('Firecrawl API key not properly configured. Deep scraping is disabled.');
    return {
      success: false,
      error: 'Firecrawl API key not properly configured',
      content: ''
    };
  }

  // For testing without making actual API calls
  if (process.env.MOCK_WEB_SEARCH === 'true') {
    console.log('Using mock scrape data');
    return {
      success: true,
      url: url,
      content: `# Mock Content for ${url}\n\nThis is mock content for website scraping.`
    };
  }

  try {
    console.log(`Deep scraping website: "${url}"`);
    
    // Prepare the request payload
    const payload = {
      url: url,
      crawlLinks: scrapeOptions.crawlLinks,
      maxDepth: scrapeOptions.maxDepth,
      maxPages: scrapeOptions.maxPages
    };
    
    // Make request to Firecrawl scrape API
    const response = await axios.post(FIRECRAWL_SCRAPE_URL, payload, {
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: scrapeOptions.timeout
    });

    // Process and return scrape results
    if (response.data && response.data.content) {
      console.log(`Website scraped successfully, content length: ${response.data.content.length} chars`);
      
      return {
        success: true,
        url: url,
        title: response.data.title || 'Untitled',
        content: response.data.content
      };
    } else {
      console.warn('Empty or invalid response from Firecrawl scrape API');
      
      return {
        success: false,
        error: 'Empty or invalid response from scrape API',
        content: ''
      };
    }
  } catch (error) {
    console.error(`Error deep scraping website ${url}:`, error.message);
    
    // Provide a user-friendly error message
    const errorMessage = error.response?.data?.message || error.message || 'Unknown scrape error';
    return {
      success: false,
      error: `Scrape failed: ${errorMessage}`,
      content: ''
    };
  }
}

module.exports = {
  performWebSearch,
  extractSearchContext,
  scrapeWebsite
}; 