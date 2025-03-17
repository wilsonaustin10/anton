/**
 * Script repository for storing and retrieving generated scripts
 */

// In-memory storage for generated scripts
let scriptStore = {};

/**
 * Save a generated script to the repository
 * @param {string} script - The script content
 * @param {object} metadata - Metadata about the script
 * @returns {string} - The script ID
 */
function saveScript(script, metadata = {}) {
  // Generate a unique ID for the script
  const scriptId = `script_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Store the script with metadata
  scriptStore[scriptId] = {
    script,
    metadata: {
      ...metadata,
      created: new Date().toISOString(),
      id: scriptId
    }
  };
  
  console.log(`Saved script with ID: ${scriptId}`);
  return scriptId;
}

/**
 * Retrieve a script by ID
 * @param {string} scriptId - The ID of the script to retrieve
 * @returns {object|null} - The script and metadata, or null if not found
 */
function getScript(scriptId) {
  if (!scriptStore[scriptId]) {
    console.log(`Script not found: ${scriptId}`);
    return null;
  }
  
  return { ...scriptStore[scriptId] };
}

/**
 * List all saved scripts
 * @returns {Array} - Array of script objects with metadata
 */
function listScripts() {
  return Object.entries(scriptStore).map(([id, data]) => ({
    id,
    ...data.metadata,
    scriptPreview: data.script.substring(0, 100) + '...' // First 100 chars as preview
  }));
}

/**
 * Delete a script by ID
 * @param {string} scriptId - The ID of the script to delete
 * @returns {boolean} - Whether the operation succeeded
 */
function deleteScript(scriptId) {
  if (!scriptStore[scriptId]) {
    console.log(`Cannot delete: Script not found: ${scriptId}`);
    return false;
  }
  
  delete scriptStore[scriptId];
  console.log(`Deleted script with ID: ${scriptId}`);
  return true;
}

/**
 * Update an existing script
 * @param {string} scriptId - The ID of the script to update
 * @param {string} newScript - The updated script content
 * @param {object} metadata - Updated metadata (optional)
 * @returns {boolean} - Whether the update succeeded
 */
function updateScript(scriptId, newScript, metadata = {}) {
  if (!scriptStore[scriptId]) {
    console.log(`Cannot update: Script not found: ${scriptId}`);
    return false;
  }
  
  // Preserve original metadata and update with new values
  const updatedMetadata = {
    ...scriptStore[scriptId].metadata,
    ...metadata,
    updated: new Date().toISOString()
  };
  
  scriptStore[scriptId] = {
    script: newScript,
    metadata: updatedMetadata
  };
  
  console.log(`Updated script with ID: ${scriptId}`);
  return true;
}

/**
 * Search for scripts by metadata
 * @param {object} criteria - Search criteria (field/value pairs)
 * @returns {Array} - Matching scripts
 */
function findScripts(criteria = {}) {
  return Object.entries(scriptStore)
    .filter(([id, data]) => {
      // Check if all criteria match
      return Object.entries(criteria).every(([key, value]) => {
        // Special case for text search across multiple fields
        if (key === 'textSearch' && typeof value === 'string') {
          const searchTerm = value.toLowerCase();
          const meta = data.metadata;
          return (
            meta.title?.toLowerCase().includes(searchTerm) ||
            meta.description?.toLowerCase().includes(searchTerm) ||
            data.script.toLowerCase().includes(searchTerm)
          );
        }
        
        // Regular field comparison
        return data.metadata[key] === value;
      });
    })
    .map(([id, data]) => ({
      id,
      ...data.metadata,
      scriptPreview: data.script.substring(0, 100) + '...'
    }));
}

/**
 * Clear all stored scripts
 */
function clearScripts() {
  scriptStore = {};
  console.log('All scripts cleared from repository');
}

module.exports = {
  saveScript,
  getScript,
  listScripts,
  deleteScript,
  updateScript,
  findScripts,
  clearScripts
}; 