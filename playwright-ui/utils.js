// ... existing code ...

/**
 * Process HTML text to make it more suitable for LLM processing
 * @param {string} pageSource - HTML source text
 * @param {string} baseUrl - URL of the HTML source
 * @param {Object} options - Configuration options
 * @returns {Promise<string>} - LLM ready input web page text
 */
async function getProcessedText(pageSource, baseUrl, options = {}) {
    // Default options
    const {
      keepImages = true,
      removeSvgImage = true,
      removeGifImage = true,
      removeImageTypes = [],
      keepWebpageLinks = true,
      removeScriptTag = true,
      removeStyleTag = true,
      removeTags = []
    } = options;
  
    try {
      // Use JSDOM instead of BeautifulSoup
      const jsdom = require('jsdom');
      const { JSDOM } = jsdom;
      const { window } = new JSDOM(pageSource);
      const { document } = window;
  
      // Remove tags
      const tagsToRemove = [...removeTags];
      if (removeScriptTag) tagsToRemove.push('script');
      if (removeStyleTag) tagsToRemove.push('style');
      
      // Remove duplicate tags
      const uniqueTagsToRemove = [...new Set(tagsToRemove)];
      
      uniqueTagsToRemove.forEach(tagName => {
        const elements = document.querySelectorAll(tagName);
        elements.forEach(element => {
          try {
            element.parentNode.removeChild(element);
          } catch (e) {
            console.error('Error while removing tag:', e);
          }
        });
      });
  
      // Process image links
      const removeImageType = [];
      if (removeSvgImage) removeImageType.push('.svg');
      if (removeGifImage) removeImageType.push('.gif');
      removeImageType.push(...removeImageTypes);
      
      // Remove duplicate image types
      const uniqueRemoveImageType = [...new Set(removeImageType)];
      
      const images = document.querySelectorAll('img');
      images.forEach(image => {
        try {
          if (!keepImages) {
            image.parentNode.replaceChild(document.createTextNode(''), image);
          } else {
            const imageLink = image.getAttribute('src');
            let typeReplaced = false;
            
            if (imageLink && uniqueRemoveImageType.length > 0) {
              for (const imageType of uniqueRemoveImageType) {
                if (!typeReplaced && imageLink.includes(imageType)) {
                  image.parentNode.replaceChild(document.createTextNode(''), image);
                  typeReplaced = true;
                }
              }
            }
            
            if (!typeReplaced && imageLink) {
              const fullUrl = new URL(imageLink, baseUrl).href;
              image.parentNode.replaceChild(
                document.createTextNode('\n' + fullUrl + ' '), 
                image
              );
            }
          }
        } catch (e) {
          console.error('Error while processing image link:', e);
        }
      });
  
      // Process website links
      const links = document.querySelectorAll('a[href]');
      links.forEach(link => {
        try {
          if (!keepWebpageLinks) {
            link.parentNode.replaceChild(document.createTextNode(''), link);
          } else {
            const href = link.getAttribute('href');
            const fullUrl = new URL(href, baseUrl).href;
            link.parentNode.replaceChild(
              document.createTextNode(link.textContent + ': ' + fullUrl + ' '),
              link
            );
          }
        } catch (e) {
          console.error('Error while processing webpage link:', e);
        }
      });
  
      // Extract text
      let text = '';
      const body = document.querySelector('body');
      
      if (body) {
        // We don't have direct equivalents for minify and inscriptis in JS
        // So we'll use a simple text extraction approach
        text = body.textContent || '';
        
        // Clean up whitespace
        text = text.replace(/\s+/g, ' ').trim();
        
        // Add line breaks for better readability
        const headings = body.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div');
        headings.forEach(heading => {
          const content = heading.textContent.trim();
          if (content) {
            text = text.replace(content, '\n' + content + '\n');
          }
        });
      } else {
        text = document.documentElement.textContent || '';
      }
  
      return text;
    } catch (e) {
      console.error('Error while getting processed text:', e);
      return '';
    }
  }
  
  // ... existing code ...
  
  module.exports = { 
    getProcessedText // Export the new function
  }; 