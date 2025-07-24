const express = require('express');
const router = express.Router();
const HealthCheck = require('../monitoring/health-check');
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');
const auth = require('../middleware/auth');
const User = require('../models/User');
const TokenUsage = require('../models/TokenUsage');
const AdView = require('../models/AdView');
const Payment = require('../models/Payment');

const healthCheck = new HealthCheck();

// Basic health check endpoint
router.get('/health', async (req, res) => {
  try {
    const healthData = await healthCheck.performHealthCheck();
    const statusCode = healthData.overall.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      status: healthData.overall.status,
      message: 'Health check completed',
      data: healthData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

// Detailed system metrics (admin only)
router.get('/metrics', auth, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findByPk(req.user.id);
    if (!user || user.planStatus !== 'enterprise') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Get database metrics
    const dbMetrics = await getDatabaseMetrics();
    
    // Get application metrics
    const appMetrics = await getApplicationMetrics();
    
    // Get system metrics
    const systemMetrics = await healthCheck.performHealthCheck();

    res.json({
      status: 'success',
      message: 'System metrics retrieved',
      data: {
        database: dbMetrics,
        application: appMetrics,
        system: systemMetrics
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve metrics',
      error: error.message
    });
  }
});

// Database dashboard metrics
router.get('/dashboard', auth, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findByPk(req.user.id);
    if (!user || user.planStatus !== 'enterprise') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin privileges required.'
      });
    }

    const dashboardData = await getDashboardData();
    
    res.json({
      status: 'success',
      message: 'Dashboard data retrieved',
      data: dashboardData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve dashboard data',
      error: error.message
    });
  }
});

// Real-time monitoring endpoint
router.get('/realtime', auth, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findByPk(req.user.id);
    if (!user || user.planStatus !== 'enterprise') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin privileges required.'
      });
    }

    const realtimeData = await getRealtimeData();
    
    res.json({
      status: 'success',
      message: 'Real-time data retrieved',
      data: realtimeData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve real-time data',
      error: error.message
    });
  }
});

// Helper function to get database metrics
async function getDatabaseMetrics() {
  try {
    // Get table sizes
    const tableSizes = await sequelize.query(`
      SELECT 
        table_name,
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)',
        table_rows
      FROM information_schema.tables 
      WHERE table_schema = '${process.env.DB_NAME}'
      ORDER BY (data_length + index_length) DESC
    `, { type: QueryTypes.SELECT });

    // Get connection status
    const connectionStatus = await sequelize.authenticate();

    return {
      connectionStatus: 'connected',
      tableSizes,
      totalTables: tableSizes.length,
      totalSize: tableSizes.reduce((sum, table) => sum + parseFloat(table['Size (MB)'] || 0), 0)
    };
  } catch (error) {
    return {
      connectionStatus: 'disconnected',
      error: error.message
    };
  }
}

// Helper function to get application metrics
async function getApplicationMetrics() {
  try {
    // Get user statistics
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { isActive: true } });
    const paidUsers = await User.count({ where: { isPaidUser: true } });

    // Get usage statistics
    const totalTokenUsage = await TokenUsage.sum('tokensUsed') || 0;
    const totalAdViews = await AdView.count();
    const totalPayments = await Payment.count();
    const totalRevenue = await Payment.sum('amount') || 0;

    // Get recent activity
    const recentUsers = await User.count({
      where: {
        createdAt: {
          [sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    const recentTokenUsage = await TokenUsage.sum('tokensUsed', {
      where: {
        createdAt: {
          [sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    }) || 0;

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        paid: paidUsers,
        recent: recentUsers
      },
      usage: {
        totalTokens: totalTokenUsage,
        recentTokens: recentTokenUsage,
        totalAdViews: totalAdViews
      },
      revenue: {
        totalPayments: totalPayments,
        totalRevenue: totalRevenue
      }
    };
  } catch (error) {
    return {
      error: error.message
    };
  }
}

// Helper function to get dashboard data
async function getDashboardData() {
  try {
    // Get user growth over time
    const userGrowth = await sequelize.query(`
      SELECT 
        DATE(createdAt) as date,
        COUNT(*) as new_users
      FROM Users 
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(createdAt)
      ORDER BY date
    `, { type: QueryTypes.SELECT });

    // Get model usage statistics
    const modelUsage = await sequelize.query(`
      SELECT 
        modelUsed,
        COUNT(*) as usage_count,
        SUM(tokensUsed) as total_tokens
      FROM TokenUsage 
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY modelUsed
      ORDER BY total_tokens DESC
    `, { type: QueryTypes.SELECT });

    // Get revenue data
    const revenueData = await sequelize.query(`
      SELECT 
        DATE(createdAt) as date,
        SUM(amount) as daily_revenue,
        COUNT(*) as payment_count
      FROM Payments 
      WHERE status = 'completed' 
      AND createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(createdAt)
      ORDER BY date
    `, { type: QueryTypes.SELECT });

    return {
      userGrowth,
      modelUsage,
      revenueData
    };
  } catch (error) {
    return {
      error: error.message
    };
  }
}

// Helper function to get real-time data
async function getRealtimeData() {
  try {
    // Get current active users (users who logged in within last hour)
    const activeUsers = await User.count({
      where: {
        lastLoginAt: {
          [sequelize.Op.gte]: new Date(Date.now() - 60 * 60 * 1000)
        }
      }
    });

    // Get recent token usage (last hour)
    const recentTokenUsage = await TokenUsage.sum('tokensUsed', {
      where: {
        createdAt: {
          [sequelize.Op.gte]: new Date(Date.now() - 60 * 60 * 1000)
        }
      }
    }) || 0;

    // Get recent ad views (last hour)
    const recentAdViews = await AdView.count({
      where: {
        createdAt: {
          [sequelize.Op.gte]: new Date(Date.now() - 60 * 60 * 1000)
        }
      }
    });

    return {
      activeUsers,
      recentTokenUsage,
      recentAdViews,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      error: error.message
    };
  }
}

module.exports = router; 