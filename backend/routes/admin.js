const express = require('express');
const router = express.Router();
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');
const auth = require('../middleware/auth');
const User = require('../models/User');
const ModelTokenBalance = require('../models/ModelTokenBalance');
const TokenUsage = require('../models/TokenUsage');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const AdView = require('../models/AdView');
const Payment = require('../models/Payment');
const FileUpload = require('../models/FileUpload');
const Memory = require('../models/Memory');

// Middleware to check admin privileges
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. User not found.'
      });
    }
    
    // Enforce enterprise plan for admin access
    if (user.planStatus !== 'enterprise') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin privileges required (enterprise plan).'
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Authentication failed',
      error: error.message
    });
  }
};

// Apply admin middleware to all routes
router.use(auth);
router.use(requireAdmin);

// =====================================================
// SYSTEM STATS
// =====================================================

// Get system overview stats
router.get('/system/stats', async (req, res) => {
  try {
    // Get user count
    const userCount = await User.count();
    
    // Get conversation count
    const conversationCount = await Conversation.count();
    
    // Get message count
    const messageCount = await Message.count();
    
    // Get ad view count
    const adViewCount = await AdView.count();
    
    // Get payment count
    const paymentCount = await Payment.count();
    
    // Get file upload count
    const fileUploadCount = await FileUpload.count();

    res.json({
      status: 'success',
      data: {
        users: userCount,
        conversations: conversationCount,
        messages: messageCount,
        adViews: adViewCount,
        payments: paymentCount,
        fileUploads: fileUploadCount
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch system stats',
      error: error.message
    });
  }
});

// =====================================================
// USER MANAGEMENT
// =====================================================

const { query, body, param } = require('express-validator');
const validate = require('../middleware/validate');

// Get all users with pagination
router.get('/users', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().isString().trim().isLength({ max: 100 })
], validate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    const whereClause = search ? {
      [sequelize.Op.or]: [
        { email: { [sequelize.Op.like]: `%${search}%` } },
        { name: { [sequelize.Op.like]: `%${search}%` } }
      ]
    } : {};

    const users = await User.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['password'] }
    });

    res.json({
      status: 'success',
      data: {
        users: users.rows,
        pagination: {
          page,
          limit,
          total: users.count,
          totalPages: Math.ceil(users.count / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// Get user details
router.get('/users/:userId', [param('userId').isUUID()], validate, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId, {
      attributes: { exclude: ['password'] },
      include: [
        { model: ModelTokenBalance },
        { model: TokenUsage, limit: 10, order: [['createdAt', 'DESC']] },
        { model: Conversation, limit: 5, order: [['createdAt', 'DESC']] },
        { model: AdView, limit: 10, order: [['createdAt', 'DESC']] },
        { model: Payment, limit: 10, order: [['createdAt', 'DESC']] }
      ]
    });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.json({
      status: 'success',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user details',
      error: error.message
    });
  }
});

// Update user
router.put('/users/:userId', [
  param('userId').isUUID(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('email').optional().isEmail(),
  body('planStatus').optional().isIn(['free', 'pro', 'enterprise']),
  body('isActive').optional().isBoolean(),
  body('isPaidUser').optional().isBoolean(),
], validate, async (req, res) => {
  try {
    const { name, email, planStatus, isActive, isPaidUser } = req.body;
    
    const user = await User.findByPk(req.params.userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    await user.update({
      name: name || user.name,
      email: email || user.email,
      planStatus: planStatus || user.planStatus,
      isActive: isActive !== undefined ? isActive : user.isActive,
      isPaidUser: isPaidUser !== undefined ? isPaidUser : user.isPaidUser
    });

    res.json({
      status: 'success',
      message: 'User updated successfully',
      data: { user: { ...user.toJSON(), password: undefined } }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user',
      error: error.message
    });
  }
});

// Delete user
router.delete('/users/:userId', [param('userId').isUUID()], validate, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    await user.destroy();

    res.json({
      status: 'success',
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete user',
      error: error.message
    });
  }
});

// =====================================================
// TOKEN MANAGEMENT
// =====================================================

// Get all token balances
router.get('/tokens', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
], validate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const tokenBalances = await ModelTokenBalance.findAndCountAll({
      include: [{ model: User, attributes: ['id', 'email', 'name'] }],
      limit,
      offset,
      order: [['balance', 'DESC']]
    });

    res.json({
      status: 'success',
      data: {
        tokenBalances: tokenBalances.rows,
        pagination: {
          page,
          limit,
          total: tokenBalances.count,
          totalPages: Math.ceil(tokenBalances.count / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch token balances',
      error: error.message
    });
  }
});

// Update user token balance
router.put('/tokens/:userId/:modelId', [
  param('userId').isUUID(),
  param('modelId').isString().trim().isLength({ min: 1, max: 100 }),
  body('balance').isInt({ min: 0 })
], validate, async (req, res) => {
  try {
    const { balance } = req.body;
    
    const [tokenBalance, created] = await ModelTokenBalance.findOrCreate({
      where: {
        userId: req.params.userId,
        modelId: req.params.modelId
      },
      defaults: { balance: 0 }
    });

    await tokenBalance.update({ balance: parseInt(balance) });

    res.json({
      status: 'success',
      message: 'Token balance updated successfully',
      data: tokenBalance
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update token balance',
      error: error.message
    });
  }
});

// Get token usage statistics
router.get('/tokens/usage', [query('days').optional().isInt({ min: 1, max: 90 }).toInt()], validate, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    
    const usageStats = await sequelize.query(`
      SELECT 
        modelUsed,
        DATE(createdAt) as date,
        COUNT(*) as usage_count,
        SUM(tokensUsed) as total_tokens,
        AVG(tokensUsed) as avg_tokens
      FROM TokenUsage 
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
      GROUP BY modelUsed, DATE(createdAt)
      ORDER BY date DESC, total_tokens DESC
    `, { type: QueryTypes.SELECT });

    res.json({
      status: 'success',
      data: usageStats
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch token usage statistics',
      error: error.message
    });
  }
});

// =====================================================
// ANALYTICS & REPORTS
// =====================================================

// Get comprehensive analytics
router.get('/analytics', [query('days').optional().isInt({ min: 1, max: 180 }).toInt()], validate, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    
    // User analytics
    const userAnalytics = await sequelize.query(`
      SELECT 
        DATE(createdAt) as date,
        COUNT(*) as new_users,
        SUM(CASE WHEN isPaidUser = 1 THEN 1 ELSE 0 END) as paid_users
      FROM Users 
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
      GROUP BY DATE(createdAt)
      ORDER BY date
    `, { type: QueryTypes.SELECT });

    // Revenue analytics
    const revenueAnalytics = await sequelize.query(`
      SELECT 
        DATE(createdAt) as date,
        SUM(amount) as daily_revenue,
        COUNT(*) as payment_count
      FROM Payments 
      WHERE status = 'completed' 
      AND createdAt >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
      GROUP BY DATE(createdAt)
      ORDER BY date
    `, { type: QueryTypes.SELECT });

    // Model usage analytics
    const modelAnalytics = await sequelize.query(`
      SELECT 
        modelUsed,
        COUNT(*) as total_usage,
        SUM(tokensUsed) as total_tokens,
        AVG(tokensUsed) as avg_tokens
      FROM TokenUsage 
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
      GROUP BY modelUsed
      ORDER BY total_tokens DESC
    `, { type: QueryTypes.SELECT });

    res.json({
      status: 'success',
      data: {
        userAnalytics,
        revenueAnalytics,
        modelAnalytics
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

// =====================================================
// SYSTEM ADMINISTRATION
// =====================================================

// Get system statistics
router.get('/system/stats', async (req, res) => {
  try {
    const stats = {
      users: await User.count(),
      conversations: await Conversation.count(),
      messages: await Message.count(),
      adViews: await AdView.count(),
      payments: await Payment.count(),
      fileUploads: await FileUpload.count(),
      memories: await Memory.count()
    };

    res.json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch system statistics',
      error: error.message
    });
  }
});

// Get database table sizes
router.get('/system/database', async (req, res) => {
  try {
    const tableSizes = await sequelize.query(`
      SELECT 
        table_name,
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)',
        table_rows
      FROM information_schema.tables 
      WHERE table_schema = '${process.env.DB_NAME}'
      ORDER BY (data_length + index_length) DESC
    `, { type: QueryTypes.SELECT });

    res.json({
      status: 'success',
      data: tableSizes
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch database information',
      error: error.message
    });
  }
});

// =====================================================
// PAYMENT MANAGEMENT
// =====================================================

// Get all payments
router.get('/payments', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
], validate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const payments = await Payment.findAndCountAll({
      include: [{ model: User, attributes: ['id', 'email', 'name'] }],
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      status: 'success',
      data: {
        payments: payments.rows,
        pagination: {
          page,
          limit,
          total: payments.count,
          totalPages: Math.ceil(payments.count / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
});

// Update payment status
router.put('/payments/:paymentId', [
  param('paymentId').isUUID(),
  body('status').isIn(['pending', 'completed', 'failed', 'refunded'])
], validate, async (req, res) => {
  try {
    const { status } = req.body;
    
    const payment = await Payment.findByPk(req.params.paymentId);
    if (!payment) {
      return res.status(404).json({
        status: 'error',
        message: 'Payment not found'
      });
    }

    await payment.update({ status });

    res.json({
      status: 'success',
      message: 'Payment status updated successfully',
      data: payment
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update payment status',
      error: error.message
    });
  }
});

module.exports = router; 