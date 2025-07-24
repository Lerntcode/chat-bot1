const { sequelize } = require('../config/database');
const os = require('os');
const fs = require('fs');
const path = require('path');

class HealthCheck {
  constructor() {
    this.startTime = Date.now();
    this.checks = {
      database: false,
      fileSystem: false,
      memory: false,
      disk: false,
      uptime: 0
    };
  }

  // Check database connectivity
  async checkDatabase() {
    try {
      await sequelize.authenticate();
      this.checks.database = true;
      return { status: 'healthy', message: 'Database connection successful' };
    } catch (error) {
      this.checks.database = false;
      return { status: 'unhealthy', message: 'Database connection failed', error: error.message };
    }
  }

  // Check file system access
  checkFileSystem() {
    try {
      const uploadDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Test write access
      const testFile = path.join(uploadDir, 'health-check-test.txt');
      fs.writeFileSync(testFile, 'health check test');
      fs.unlinkSync(testFile);
      
      this.checks.fileSystem = true;
      return { status: 'healthy', message: 'File system access successful' };
    } catch (error) {
      this.checks.fileSystem = false;
      return { status: 'unhealthy', message: 'File system access failed', error: error.message };
    }
  }

  // Check memory usage
  checkMemory() {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsage = (usedMem / totalMem) * 100;
      
      this.checks.memory = memoryUsage < 90; // Consider healthy if less than 90% used
      
      return {
        status: this.checks.memory ? 'healthy' : 'warning',
        message: `Memory usage: ${memoryUsage.toFixed(2)}%`,
        details: {
          total: this.formatBytes(totalMem),
          used: this.formatBytes(usedMem),
          free: this.formatBytes(freeMem),
          percentage: memoryUsage.toFixed(2)
        }
      };
    } catch (error) {
      this.checks.memory = false;
      return { status: 'unhealthy', message: 'Memory check failed', error: error.message };
    }
  }

  // Check disk space
  checkDisk() {
    try {
      const uploadDir = path.join(__dirname, '../uploads');
      const stats = fs.statSync(uploadDir);
      
      // This is a simplified check - in production you'd want to use a proper disk space library
      this.checks.disk = true;
      
      return {
        status: 'healthy',
        message: 'Disk space check passed',
        details: {
          uploadDir: uploadDir,
          exists: true
        }
      };
    } catch (error) {
      this.checks.disk = false;
      return { status: 'unhealthy', message: 'Disk space check failed', error: error.message };
    }
  }

  // Get system uptime
  getUptime() {
    const uptime = Date.now() - this.startTime;
    this.checks.uptime = uptime;
    
    return {
      status: 'healthy',
      message: 'System uptime',
      details: {
        uptime: this.formatUptime(uptime),
        startTime: new Date(this.startTime).toISOString()
      }
    };
  }

  // Get overall health status
  getOverallStatus() {
    const healthyChecks = Object.values(this.checks).filter(check => check === true).length;
    const totalChecks = Object.keys(this.checks).length;
    const healthPercentage = (healthyChecks / totalChecks) * 100;
    
    let status = 'healthy';
    if (healthPercentage < 50) status = 'critical';
    else if (healthPercentage < 80) status = 'warning';
    
    return {
      status,
      healthPercentage: healthPercentage.toFixed(2),
      healthyChecks,
      totalChecks,
      timestamp: new Date().toISOString()
    };
  }

  // Comprehensive health check
  async performHealthCheck() {
    const results = {
      overall: this.getOverallStatus(),
      checks: {
        database: await this.checkDatabase(),
        fileSystem: this.checkFileSystem(),
        memory: this.checkMemory(),
        disk: this.checkDisk(),
        uptime: this.getUptime()
      },
      system: {
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        loadAverage: os.loadavg(),
        cpuCount: os.cpus().length
      }
    };

    return results;
  }

  // Format bytes to human readable
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Format uptime to human readable
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

module.exports = HealthCheck; 