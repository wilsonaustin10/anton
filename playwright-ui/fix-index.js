/**
 * Script to fix index.html if it gets corrupted
 * Run with: node fix-index.js
 */
const fs = require('fs');
const path = require('path');

// Paths
const indexPath = path.join(__dirname, 'public', 'index.html');
const backupPath = path.join(__dirname, 'public', 'index.html.bak');

// Create a backup if one doesn't exist
if (!fs.existsSync(backupPath)) {
  console.log('Creating backup of index.html...');
  fs.copyFileSync(indexPath, backupPath);
  console.log('Backup created at public/index.html.bak');
}

// Function to check if file is corrupted
function isFileCorrupted(content) {
  // Check for key markers that should exist in a valid file
  return !content.includes('function loadExample(type)') || 
         !content.includes('function addMessage(text, isUser = false)') ||
         !content.includes('</html>');
}

// Read the current file
console.log('Checking index.html...');
const content = fs.readFileSync(indexPath, 'utf8');

// Check if corrupted
if (isFileCorrupted(content)) {
  console.log('index.html appears to be corrupted. Restoring from backup...');
  fs.copyFileSync(backupPath, indexPath);
  console.log('Restored index.html from backup.');
} else {
  console.log('index.html looks valid. No restoration needed.');
  
  // Create a new backup to ensure we have the latest working version
  console.log('Updating backup...');
  fs.copyFileSync(indexPath, backupPath);
  console.log('Backup updated.');
}

console.log('Done!'); 