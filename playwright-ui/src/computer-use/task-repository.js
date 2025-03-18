/**
 * Task Repository for storing validated task sequences
 * Stores successful action sequences validated by users
 */

const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class TaskRepository {
  constructor() {
    this.dbPath = path.join(__dirname, '../../data/validated-tasks.json');
    this.tasks = [];
    this.initialized = false;
    
    // Ensure directory exists
    this.ensureDirectory();
  }
  
  /**
   * Initialize the repository
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.ensureDirectory();
      
      try {
        const data = await fs.readFile(this.dbPath, 'utf8');
        this.tasks = JSON.parse(data);
        console.log(`Loaded ${this.tasks.length} validated tasks from repository`);
      } catch (error) {
        // File doesn't exist yet or is invalid JSON
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
          console.log('Creating new task repository');
          this.tasks = [];
          await this.saveToFile();
        } else {
          throw error;
        }
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing task repository:', error);
      throw error;
    }
  }
  
  /**
   * Ensure data directory exists
   */
  async ensureDirectory() {
    const dataDir = path.dirname(this.dbPath);
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        console.error('Error creating data directory:', error);
        throw error;
      }
    }
  }
  
  /**
   * Save current tasks to file
   */
  async saveToFile() {
    try {
      await fs.writeFile(
        this.dbPath, 
        JSON.stringify(this.tasks, null, 2), 
        'utf8'
      );
    } catch (error) {
      console.error('Error saving task repository:', error);
      throw error;
    }
  }
  
  /**
   * Add a validated task sequence
   * @param {Object} task - Task data
   * @returns {String} - ID of saved task
   */
  async saveValidatedTask(task) {
    await this.initialize();
    
    const taskId = task.id || uuidv4();
    const timestamp = new Date().toISOString();
    
    const validatedTask = {
      id: taskId,
      description: task.description,
      actions: task.actions,
      url: task.url,
      title: task.title,
      timestamp,
      validated: true,
      taskFrequency: 1
    };
    
    // Check if this task already exists (by ID)
    const existingIndex = this.tasks.findIndex(t => t.id === taskId);
    if (existingIndex >= 0) {
      // Update existing task
      this.tasks[existingIndex] = {
        ...this.tasks[existingIndex],
        ...validatedTask,
        taskFrequency: (this.tasks[existingIndex].taskFrequency || 0) + 1,
        lastUsed: timestamp
      };
    } else {
      // Add new task
      this.tasks.push(validatedTask);
    }
    
    await this.saveToFile();
    return taskId;
  }
  
  /**
   * Find task by ID
   * @param {String} taskId - Task ID
   * @returns {Object|null} - Task or null if not found
   */
  async getTaskById(taskId) {
    await this.initialize();
    return this.tasks.find(task => task.id === taskId) || null;
  }
  
  /**
   * Find similar tasks by description
   * Uses simple keyword matching - could be improved with embeddings
   * @param {String} description - Task description
   * @param {Number} limit - Maximum number of results
   * @returns {Array} - Array of matching tasks
   */
  async findSimilarTasks(description, limit = 5) {
    await this.initialize();
    
    // Simple keyword matching
    const keywords = description.toLowerCase().split(/\s+/)
      .filter(word => word.length > 3)
      .map(word => word.replace(/[^\w]/g, ''));
    
    if (keywords.length === 0) return [];
    
    // Score tasks by keyword matches
    const scoredTasks = this.tasks.map(task => {
      const taskText = `${task.description} ${task.url || ''} ${task.title || ''}`.toLowerCase();
      const score = keywords.reduce((count, keyword) => {
        return count + (taskText.includes(keyword) ? 1 : 0);
      }, 0);
      
      return { task, score };
    });
    
    // Sort by score and frequency
    return scoredTasks
      .filter(item => item.score > 0)
      .sort((a, b) => {
        // First by score
        if (b.score !== a.score) return b.score - a.score;
        // Then by frequency
        return (b.task.taskFrequency || 0) - (a.task.taskFrequency || 0);
      })
      .slice(0, limit)
      .map(item => item.task);
  }
  
  /**
   * Get all validated tasks
   * @returns {Array} - All tasks
   */
  async getAllTasks() {
    await this.initialize();
    return [...this.tasks];
  }
  
  /**
   * Delete a task by ID
   * @param {String} taskId - Task ID
   * @returns {Boolean} - Success
   */
  async deleteTask(taskId) {
    await this.initialize();
    
    const initialLength = this.tasks.length;
    this.tasks = this.tasks.filter(task => task.id !== taskId);
    
    if (this.tasks.length !== initialLength) {
      await this.saveToFile();
      return true;
    }
    
    return false;
  }
}

// Export singleton instance
const taskRepository = new TaskRepository();
module.exports = taskRepository; 