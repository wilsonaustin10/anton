// Test parser module to extract steps from Playwright test scripts
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

/**
 * Converts a CSS selector to a more readable string for display
 * @param {string} selector - The CSS selector
 * @returns {string} A more human-readable representation
 */
function selectorToReadableString(selector) {
  if (!selector) return 'unknown element';
  
  // Extract element type from selector (if present)
  let elementType = 'element';
  const tagMatch = selector.match(/^([a-z][a-z0-9]*)/i);
  if (tagMatch) {
    elementType = tagMatch[1];
  }
  
  // Extract ID if present
  const idMatch = selector.match(/#([a-z0-9_-]+)/i);
  if (idMatch) {
    return `${elementType} with ID "${idMatch[1]}"`;
  }
  
  // Extract class if present
  const classMatch = selector.match(/\.([a-z0-9_-]+)/i);
  if (classMatch) {
    return `${elementType} with class "${classMatch[1]}"`;
  }
  
  // Check for attribute selectors
  const attrMatch = selector.match(/\[([^\]=]+)(?:=["']?([^"'\]]+)["']?)?\]/);
  if (attrMatch) {
    const attr = attrMatch[1];
    const value = attrMatch[2];
    
    if (attr === 'id' && value) {
      return `${elementType} with ID "${value}"`;
    }
    
    if (attr === 'placeholder' && value) {
      return `${elementType} with placeholder "${value}"`;
    }
    
    if (attr === 'name' && value) {
      return `${elementType} with name "${value}"`;
    }
    
    if (attr === 'class' && value) {
      return `${elementType} with class "${value}"`;
    }
    
    if (value) {
      return `${elementType} with ${attr}="${value}"`;
    } else {
      return `${elementType} with ${attr} attribute`;
    }
  }
  
  // For complex selectors, just return a simplified version
  if (selector.includes(' ') || selector.includes('>') || selector.includes('+')) {
    return 'element matching complex selector';
  }
  
  return selector;
}

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
    console.log('Parsing script AST for actions...');

    // Traverse the AST to find Playwright actions
    traverse(ast, {
      // Find all method calls that could be Playwright actions
      CallExpression(path) {
        const { node } = path;
        
        // Handle direct page method calls like page.goto(), page.click(), etc.
        if (node.callee.type === 'MemberExpression') {
          const methodName = node.callee.property.name;
          
          // Handle navigation (goto)
          if (methodName === 'goto' && node.arguments.length > 0) {
            let url = '';
            
            // Extract URL value whether it's a string literal or a variable
            if (node.arguments[0].type === 'StringLiteral') {
              url = node.arguments[0].value;
            } else if (node.arguments[0].type === 'Identifier') {
              // For variable references, we'll use the variable name
              url = `\${${node.arguments[0].name}}`;
            } else if (node.arguments[0].type === 'TemplateLiteral') {
              // Handle template literals
              url = "dynamic-url";
            }
            
            if (url) {
              console.log(`Found navigation to: ${url}`);
              steps.push({
                type: 'goto',
                data: { url }
              });
            }
          }
          
          // Handle direct click on selector: page.click('.selector')
          else if (methodName === 'click' && node.arguments.length > 0) {
            let selector = '';
            
            if (node.arguments[0].type === 'StringLiteral') {
              selector = node.arguments[0].value;
              console.log(`Found direct click on: ${selector}`);
              steps.push({
                type: 'click',
                data: { method: 'direct', selector }
              });
            }
          }
          
          // Handle direct fill: page.fill('selector', 'value')
          else if (methodName === 'fill' && node.arguments.length > 1) {
            let selector = '';
            let value = '';
            
            if (node.arguments[0].type === 'StringLiteral') {
              selector = node.arguments[0].value;
              
              if (node.arguments[1].type === 'StringLiteral') {
                value = node.arguments[1].value;
              } else if (node.arguments[1].type === 'Identifier') {
                value = `\${${node.arguments[1].name}}`;
              } else if (node.arguments[1].type === 'TemplateLiteral') {
                value = "dynamic-value";
              }
              
              console.log(`Found direct fill: ${selector} with value: ${value}`);
              steps.push({
                type: 'fill',
                data: { method: 'direct', selector, value }
              });
            }
          }
          
          // Handle direct type: page.type('selector', 'value')
          else if (methodName === 'type' && node.arguments.length > 1) {
            let selector = '';
            let value = '';
            
            if (node.arguments[0].type === 'StringLiteral') {
              selector = node.arguments[0].value;
              
              if (node.arguments[1].type === 'StringLiteral') {
                value = node.arguments[1].value;
              } else if (node.arguments[1].type === 'Identifier') {
                value = `\${${node.arguments[1].name}}`;
              }
              
              console.log(`Found type action: ${selector} with value: ${value}`);
              steps.push({
                type: 'type',
                description: `Type: ${selectorToReadableString(selector)} with '${value}'`,
                data: { method: 'direct', selector, value }
              });
            }
          }
          
          // Add another direct check for page.keyboard.type
          else if (methodName === 'keyboard' && 
                   node.callee.object && 
                   node.callee.object.property && 
                   node.callee.object.property.name === 'page') {
            // Look for chained "type" method
            if (path.parent && 
                path.parent.type === 'MemberExpression' && 
                path.parent.property && 
                path.parent.property.name === 'type') {
              // This is page.keyboard.type(), get the parent call expression
              const parentCall = path.parentPath.parentPath;
              if (parentCall && 
                  parentCall.node.type === 'CallExpression' && 
                  parentCall.node.arguments.length > 0) {
                const textArg = parentCall.node.arguments[0];
                if (textArg.type === 'StringLiteral') {
                  const value = textArg.value;
                  console.log(`Found keyboard type with value: ${value}`);
                  steps.push({
                    type: 'keyboard',
                    description: `Type using keyboard: '${value}'`,
                    data: { method: 'keyboard', value }
                  });
                }
              }
            }
          }
          
          // Handle waitForSelector, waitForNavigation
          else if (methodName === 'waitForSelector' && node.arguments.length > 0) {
            let selector = '';
            
            if (node.arguments[0].type === 'StringLiteral') {
              selector = node.arguments[0].value;
              console.log(`Found wait for selector: ${selector}`);
              steps.push({
                type: 'wait',
                data: { method: 'selector', target: selector }
              });
            }
          }
          
          else if (methodName === 'waitForNavigation') {
            console.log('Found wait for navigation');
            steps.push({
              type: 'wait',
              data: { method: 'navigation' }
            });
          }
          
          // Handle page.waitForTimeout
          else if (methodName === 'waitForTimeout' && node.arguments.length > 0) {
            let timeout = 1000;
            
            if (node.arguments[0].type === 'NumericLiteral') {
              timeout = node.arguments[0].value;
            }
            
            console.log(`Found wait timeout: ${timeout}ms`);
            steps.push({
              type: 'wait',
              data: { method: 'timeout', timeout }
            });
          }
          
          // Handle check/uncheck: page.check(), page.uncheck()
          else if ((methodName === 'check' || methodName === 'uncheck') && node.arguments.length > 0) {
            let selector = '';
            
            if (node.arguments[0].type === 'StringLiteral') {
              selector = node.arguments[0].value;
              console.log(`Found ${methodName} on: ${selector}`);
              steps.push({
                type: methodName,
                data: { method: 'direct', selector }
              });
            }
          }
          
          // Handle select option: page.selectOption('selector', 'value')
          else if (methodName === 'selectOption' && node.arguments.length > 1) {
            let selector = '';
            let value = '';
            
            if (node.arguments[0].type === 'StringLiteral') {
              selector = node.arguments[0].value;
              
              if (node.arguments[1].type === 'StringLiteral') {
                value = node.arguments[1].value;
              } else if (node.arguments[1].type === 'ArrayExpression') {
                // Handle multiple options
                value = 'multiple-options';
              }
              
              console.log(`Found select option: ${selector} with value: ${value}`);
              steps.push({
                type: 'select',
                data: { method: 'direct', selector, value }
              });
            }
          }
          
          // Handle functions chained after locators
          if (node.callee.object && node.callee.object.type === 'CallExpression') {
            const chainedCall = node.callee.object;
            
            // Check if it's something like page.locator('.selector').click()
            if (chainedCall.callee.type === 'MemberExpression' && 
                chainedCall.callee.property && chainedCall.callee.property.name) {
                
              const locatorMethod = chainedCall.callee.property.name;
              
              if (['locator', 'getByRole', 'getByText', 'getByTestId', 'getByLabel', 'getByPlaceholder'].includes(locatorMethod)) {
                let selector = '';
                
                // Extract selector from the locator method call
                if (chainedCall.arguments.length > 0) {
                  if (chainedCall.arguments[0].type === 'StringLiteral') {
                    selector = chainedCall.arguments[0].value;
                  }
                  
                  // Handle getByRole with options
                  if (locatorMethod === 'getByRole' && chainedCall.arguments.length > 1) {
                    const options = chainedCall.arguments[1];
                    if (options.type === 'ObjectExpression') {
                      const nameProp = options.properties.find(p => p.key.name === 'name');
                      if (nameProp && nameProp.value.type === 'StringLiteral') {
                        selector += ` (named: ${nameProp.value.value})`;
                      }
                    }
                  }
                }
                
                if (selector) {
                  // Process the chained method (click, fill, etc.)
                  if (methodName === 'click') {
                    console.log(`Found ${locatorMethod} click on: ${selector}`);
                    steps.push({
                      type: 'click',
                      data: { method: locatorMethod, selector }
                    });
                  } else if (methodName === 'fill' && node.arguments.length > 0) {
                    let value = '';
                    
                    if (node.arguments[0].type === 'StringLiteral') {
                      value = node.arguments[0].value;
                    } else if (node.arguments[0].type === 'Identifier') {
                      value = `\${${node.arguments[0].name}}`;
                    }
                    
                    console.log(`Found ${locatorMethod} fill: ${selector} with value: ${value}`);
                    steps.push({
                      type: 'fill',
                      data: { method: locatorMethod, selector, value }
                    });
                  } else if (methodName === 'check' || methodName === 'uncheck') {
                    console.log(`Found ${locatorMethod} ${methodName}: ${selector}`);
                    steps.push({
                      type: methodName,
                      data: { method: locatorMethod, selector }
                    });
                  } else if (methodName === 'selectOption' && node.arguments.length > 0) {
                    let value = '';
                    
                    if (node.arguments[0].type === 'StringLiteral') {
                      value = node.arguments[0].value;
                    } else if (node.arguments[0].type === 'ArrayExpression') {
                      value = 'multiple-options';
                    }
                    
                    console.log(`Found ${locatorMethod} select option: ${selector} with value: ${value}`);
                    steps.push({
                      type: 'select',
                      data: { method: locatorMethod, selector, value }
                    });
                  } else if (methodName === 'type' && node.arguments.length > 0) {
                    let value = '';
                    
                    if (node.arguments[0].type === 'StringLiteral') {
                      value = node.arguments[0].value;
                    }
                    
                    console.log(`Found ${locatorMethod} type: ${selector} with value: ${value}`);
                    steps.push({
                      type: 'type',
                      data: { method: locatorMethod, selector, value }
                    });
                  } else if (methodName === 'press' && node.arguments.length > 0) {
                    let key = '';
                    
                    if (node.arguments[0].type === 'StringLiteral') {
                      key = node.arguments[0].value;
                    }
                    
                    console.log(`Found ${locatorMethod} press: ${selector} with key: ${key}`);
                    steps.push({
                      type: 'press',
                      data: { method: locatorMethod, selector, key }
                    });
                  } else if (methodName === 'hover') {
                    console.log(`Found ${locatorMethod} hover: ${selector}`);
                    steps.push({
                      type: 'hover',
                      data: { method: locatorMethod, selector }
                    });
                  } else if (methodName === 'scrollIntoViewIfNeeded') {
                    console.log(`Found ${locatorMethod} scroll into view: ${selector}`);
                    steps.push({
                      type: 'scroll',
                      data: { method: locatorMethod, selector }
                    });
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log(`Total steps extracted: ${steps.length}`);
    return steps;
  } catch (error) {
    console.error('Error parsing test:', error);
    throw new Error(`Failed to parse test: ${error.message}`);
  }
}

module.exports = { parseTest }; 