// Test parser module to extract steps from Playwright test scripts
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

/**
 * Parse a Playwright test script and extract testable steps
 * @param {string} script - The Playwright test script content
 * @returns {Array} Array of parsed steps
 */
function parseTest(script) {
  try {
    // Parse the script using Babel parser
    const ast = parse(script, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    const steps = [];

    // Traverse the AST to find Playwright actions
    traverse(ast, {
      // Find page.goto calls
      CallExpression(path) {
        const { node } = path;
        
        // Handle page.goto for navigation
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.name === 'goto' &&
          node.arguments.length > 0
        ) {
          const url = node.arguments[0].value;
          if (url) {
            steps.push({
              type: 'goto',
              data: { url }
            });
          }
        }
        
        // Handle page.click, element.click
        else if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.name === 'click'
        ) {
          // Try to extract the selector
          let selector = '';
          let method = '';
          
          // Check if it's something like page.locator('.selector').click()
          if (node.callee.object.type === 'CallExpression') {
            const locatorCall = node.callee.object;
            if (locatorCall.callee.property && locatorCall.callee.property.name === 'locator') {
              method = 'locator';
              if (locatorCall.arguments.length > 0 && locatorCall.arguments[0].type === 'StringLiteral') {
                selector = locatorCall.arguments[0].value;
                steps.push({
                  type: 'click',
                  data: { method, selector }
                });
              }
            }
            // Handle getByRole, getByText, etc.
            else if (locatorCall.callee.property) {
              method = locatorCall.callee.property.name;
              if (
                method === 'getByRole' || 
                method === 'getByText' || 
                method === 'getByTestId' ||
                method === 'getByLabel'
              ) {
                let roleArg = locatorCall.arguments[0];
                if (roleArg.type === 'StringLiteral') {
                  selector = roleArg.value;
                } else if (
                  roleArg.type === 'ObjectExpression' &&
                  roleArg.properties.some(p => p.key.name === 'name')
                ) {
                  // Extract { name: 'value' } from getByRole('link', { name: 'value' })
                  const nameProp = roleArg.properties.find(p => p.key.name === 'name');
                  if (nameProp && nameProp.value.type === 'StringLiteral') {
                    selector = nameProp.value.value;
                  }
                }
                
                if (selector) {
                  steps.push({
                    type: 'click',
                    data: { method, selector }
                  });
                }
              }
            }
          }
        }
        
        // Handle fill operations
        else if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.name === 'fill' &&
          node.arguments.length > 0
        ) {
          // Try to extract the selector
          let selector = '';
          let method = '';
          let value = '';
          
          // Check if it's something like page.locator('.selector').fill('text')
          if (node.callee.object.type === 'CallExpression') {
            const locatorCall = node.callee.object;
            if (locatorCall.callee.property && locatorCall.callee.property.name === 'locator') {
              method = 'locator';
              if (locatorCall.arguments.length > 0 && locatorCall.arguments[0].type === 'StringLiteral') {
                selector = locatorCall.arguments[0].value;
                
                // Get the value to fill
                if (node.arguments[0].type === 'StringLiteral') {
                  value = node.arguments[0].value;
                  
                  steps.push({
                    type: 'fill',
                    data: { method, selector, value }
                  });
                }
              }
            }
          }
        }
      }
    });

    return steps;
  } catch (error) {
    console.error('Error parsing test:', error);
    throw new Error(`Failed to parse test: ${error.message}`);
  }
}

module.exports = { parseTest }; 