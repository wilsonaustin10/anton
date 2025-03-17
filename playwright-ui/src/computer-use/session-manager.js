/**
 * Session Manager for OpenAI Computer Use integration
 * Handles persistence and management of computer use sessions
 */

const fs = require('fs').promises;
const path = require('path');

class SessionManager {
  /**
   * Create a new session manager
   * @param {Object} config - Configuration options
   */
  constructor(config) {
    this.config = config;
    this.sessionsDir = path.join(__dirname, '../../temp/sessions');
    this.activeSessions = new Map();
    this.initialize();
    console.log('Session manager initialized');
  }
  
  /**
   * Initialize the session manager
   */
  async initialize() {
    try {
      // Create sessions directory if it doesn't exist
      await fs.mkdir(this.sessionsDir, { recursive: true });
      console.log(`Sessions directory created: ${this.sessionsDir}`);
      
      // Load any existing session data
      this.loadSessions().catch(error => {
        console.error('Error loading sessions:', error);
      });
    } catch (error) {
      console.error('Error initializing session manager:', error);
    }
  }
  
  /**
   * Create a new session
   * @param {string} userId - User ID
   * @param {Object} metadata - Session metadata
   * @returns {string} - Session ID
   */
  createSession(userId, metadata = {}) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    const session = {
      id: sessionId,
      userId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      status: 'active',
      metadata,
      tasks: [],
      history: []
    };
    
    this.activeSessions.set(sessionId, session);
    console.log(`Session created: ${sessionId} for user ${userId}`);
    
    // Save the session
    this.saveSession(sessionId).catch(error => {
      console.error(`Error saving session ${sessionId}:`, error);
    });
    
    return sessionId;
  }
  
  /**
   * Add task to session
   * @param {string} sessionId - Session ID
   * @param {string} taskId - Task ID
   * @returns {boolean} - Success
   */
  addTaskToSession(sessionId, taskId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    
    session.tasks.push(taskId);
    session.lastActivity = Date.now();
    
    console.log(`Task ${taskId} added to session ${sessionId}`);
    
    // Save the session
    this.saveSession(sessionId).catch(error => {
      console.error(`Error saving session ${sessionId}:`, error);
    });
    
    return true;
  }
  
  /**
   * Add event to session history
   * @param {string} sessionId - Session ID
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   * @returns {boolean} - Success
   */
  addSessionEvent(sessionId, eventType, data = {}) {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    
    const event = {
      timestamp: Date.now(),
      type: eventType,
      data
    };
    
    session.history.push(event);
    session.lastActivity = Date.now();
    
    console.log(`Event ${eventType} added to session ${sessionId}`);
    
    // Save the session if we have accumulated enough events or it's a significant event
    if (session.history.length % 10 === 0 || 
        ['task_completed', 'session_ended', 'error'].includes(eventType)) {
      this.saveSession(sessionId).catch(error => {
        console.error(`Error saving session ${sessionId}:`, error);
      });
    }
    
    return true;
  }
  
  /**
   * End a session
   * @param {string} sessionId - Session ID
   * @param {string} reason - Reason for ending
   * @returns {boolean} - Success
   */
  endSession(sessionId, reason = 'user_request') {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    
    session.status = 'ended';
    session.endedAt = Date.now();
    session.endReason = reason;
    session.duration = session.endedAt - session.createdAt;
    
    console.log(`Session ${sessionId} ended: ${reason}`);
    
    // Add end event
    this.addSessionEvent(sessionId, 'session_ended', { reason });
    
    // Save the session
    this.saveSession(sessionId).catch(error => {
      console.error(`Error saving session ${sessionId}:`, error);
    });
    
    return true;
  }
  
  /**
   * Get a session by ID
   * @param {string} sessionId - Session ID
   * @returns {Object} - Session
   */
  getSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }
  
  /**
   * Get all sessions for a user
   * @param {string} userId - User ID
   * @returns {Array} - User sessions
   */
  getUserSessions(userId) {
    const sessions = [];
    
    for (const session of this.activeSessions.values()) {
      if (session.userId === userId) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }
  
  /**
   * Save session to disk
   * @param {string} sessionId - Session ID
   */
  async saveSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    
    const filepath = path.join(this.sessionsDir, `${sessionId}.json`);
    
    try {
      await fs.writeFile(filepath, JSON.stringify(session, null, 2));
      console.log(`Session ${sessionId} saved to ${filepath}`);
      return true;
    } catch (error) {
      console.error(`Error saving session ${sessionId}:`, error);
      throw error;
    }
  }
  
  /**
   * Load sessions from disk
   */
  async loadSessions() {
    try {
      const files = await fs.readdir(this.sessionsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filepath = path.join(this.sessionsDir, file);
            const data = await fs.readFile(filepath, 'utf8');
            const session = JSON.parse(data);
            
            // Only load active sessions
            if (session.status === 'active') {
              this.activeSessions.set(session.id, session);
              console.log(`Loaded active session: ${session.id}`);
            }
          } catch (error) {
            console.error(`Error loading session from ${file}:`, error);
          }
        }
      }
      
      console.log(`Loaded ${this.activeSessions.size} active sessions`);
    } catch (error) {
      console.error('Error loading sessions:', error);
      throw error;
    }
  }
  
  /**
   * Clean up old sessions
   * @param {number} olderThan - Age in milliseconds
   * @returns {number} - Number of sessions cleaned up
   */
  async cleanupSessions(olderThan = 86400000) { // Default: 1 day
    let cleaned = 0;
    const now = Date.now();
    
    try {
      const files = await fs.readdir(this.sessionsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filepath = path.join(this.sessionsDir, file);
            const stat = await fs.stat(filepath);
            
            // Delete files older than the specified time
            if (now - stat.mtimeMs > olderThan) {
              await fs.unlink(filepath);
              cleaned++;
              console.log(`Deleted old session file: ${file}`);
            }
          } catch (error) {
            console.error(`Error cleaning up session file ${file}:`, error);
          }
        }
      }
      
      console.log(`Cleaned up ${cleaned} old session files`);
      return cleaned;
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
      throw error;
    }
  }
}

module.exports = SessionManager; 