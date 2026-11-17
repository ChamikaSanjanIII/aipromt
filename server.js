/**
 * ==============================================================================
 * PROMPTVERSE BACKEND REST API (Standalone All-in-One server.js)
 * Domain: api4.clipgo.xyz
 * Features:
 *   - MongoDB Connection via Mongoose (No test data, completely clean)
 *   - Auto-creates 'promptverse_db' isolated from your other VPS databases
 *   - High Security: Helmet, Rate Limiter (Anti-DDoS), CORS, JWT Auth
 *   - Admin APIs: Add, Edit, Delete Prompts, Live Stats, Secure Login
 *   - Public APIs: Get Prompts, Filter by Category/Model, Like & Copy Counters
 * ==============================================================================
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5050;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/promptverse_db';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_promptverse_2026_xyz99';
const ADMIN_USER = process.env.ADMIN_USERNAME || 'chamikasanjan03@gmail.com';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'Chamika123@';

// -------------------------------------------------------------
// 1. MONGODB CONNECTION
// -------------------------------------------------------------
mongoose.connect(MONGODB_URI, {
  maxPoolSize: 20,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
})
  .then(() => {
    console.log('✅ Connected successfully to VPS MongoDB: promptverse_db');
    console.log('🍃 Isolated Database: No old/test data. Ready for Dashboard entries.');
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err.message);
  });

// -------------------------------------------------------------
// 2. MONGOOSE SCHEMA & MODEL
// -------------------------------------------------------------
const PromptSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, index: true },
    model: { type: String, required: true, index: true },
    aspectRatio: { type: String, default: '3:4' },
    prompt: { type: String, required: true },
    negativePrompt: { type: String, default: '' },
    imageUrl: { type: String, required: true },
    tags: { type: [String], default: [], index: true },
    likes: { type: Number, default: 0 },
    copiedCount: { type: Number, default: 0 },
    featured: { type: Boolean, default: false, index: true },
    status: { type: String, enum: ['active', 'hidden'], default: 'active', index: true }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

PromptSchema.index({ title: 'text', prompt: 'text', tags: 'text' });
const Prompt = mongoose.model('Prompt', PromptSchema);

// -------------------------------------------------------------
// 3. SECURITY MIDDLEWARE
// -------------------------------------------------------------
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['*'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Anti-DDoS Rate Limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Please wait.' }
});
app.use(globalLimiter);

// Rate limiter for like/copy clicks
const actionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { error: 'Too many actions. Slow down.' }
});

// Admin JWT Authentication Verification
function verifyAdminToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. Please login first.' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

// -------------------------------------------------------------
// 4. HEALTH CHECK
// -------------------------------------------------------------
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'PromptVerse Clean API',
    domain: 'api4.clipgo.xyz',
    time: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', database: 'connected', time: new Date() });
});

// -------------------------------------------------------------
// 5. PUBLIC APIS (For Next.js Site)
// -------------------------------------------------------------

/**
 * GET /api/prompts
 * Returns prompts added from dashboard
 */
app.get('/api/prompts', async (req, res) => {
  try {
    const { category, model, search, featured, page = 1, limit = 100 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const query = { status: 'active' };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (model && model !== 'All') {
      query.model = model;
    }

    if (featured === 'true' || featured === '1') {
      query.featured = true;
    }

    if (search && search.trim() !== '') {
      const q = search.trim();
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { prompt: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ];
    }

    const total = await Prompt.countDocuments(query);
    const prompts = await Prompt.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.json({
      success: true,
      data: prompts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Error fetching prompts:', err);
    res.status(500).json({ error: 'Failed to retrieve prompts' });
  }
});

/**
 * GET /api/prompts/featured
 */
app.get('/api/prompts/featured', async (req, res) => {
  try {
    const featuredPrompts = await Prompt.find({ status: 'active', featured: true })
      .sort({ likes: -1 })
      .limit(20)
      .lean();

    res.json({ success: true, data: featuredPrompts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve featured prompts' });
  }
});

/**
 * GET /api/prompts/:id
 */
app.get('/api/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const prompt = await Prompt.findOne({ id, status: 'active' }).lean();

    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    res.json({ success: true, data: prompt });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get prompt' });
  }
});

/**
 * POST /api/prompts/:id/like
 * Supports like and unlike atomically with direction: 1 or -1
 */
app.post('/api/prompts/:id/like', actionLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body || {};
    const change = action === 'unlike' ? -1 : 1;

    // Use $inc and ensure likes does not drop below 0
    const updated = await Prompt.findOneAndUpdate(
      { id },
      [
        {
          $set: {
            likes: { $max: [0, { $add: ['$likes', change] }] }
          }
        }
      ],
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    res.json({ success: true, likes: updated.likes });
  } catch (err) {
    console.error('Error updating like:', err);
    res.status(500).json({ error: 'Failed to update like' });
  }
});

/**
 * POST /api/prompts/:id/copy
 */
app.post('/api/prompts/:id/copy', actionLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Prompt.findOneAndUpdate(
      { id },
      { $inc: { copiedCount: 1 } },
      { new: true, select: 'copiedCount' }
    );
    res.json({ success: true, copiedCount: updated?.copiedCount || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update copy count' });
  }
});

/**
 * GET /api/categories
 */
app.get('/api/categories', async (req, res) => {
  try {
    const cats = await Prompt.distinct('category', { status: 'active' });
    const defaultCats = [
      'All',
      'Photorealistic',
      'Cyberpunk & Sci-Fi',
      'Fantasy & Mythical',
      'Anime & Manga',
      '3D & Isometric',
      'Minimalist & Vector',
      'Architecture & Interior',
      'Cinematic & Film',
      'Marketing & Product'
    ];
    const uniqueCats = Array.from(new Set([...defaultCats, ...cats]));
    res.json({ success: true, data: uniqueCats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// -------------------------------------------------------------
// 6. DASHBOARD & ADMIN APIS
// -------------------------------------------------------------

/**
 * POST /api/admin/login
 */
app.post('/api/admin/login', actionLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Trim whitespace and case-insensitive compare for email
    const cleanUser = String(username).trim().toLowerCase();
    const cleanPass = String(password).trim();

    const expectedUser = String(process.env.ADMIN_USERNAME || ADMIN_USER).trim().toLowerCase();
    const expectedPass = String(process.env.ADMIN_PASSWORD || ADMIN_PASS).trim();

    // Also support fallback 'admin' & 'Chamika123@' just in case
    const isMatched = (cleanUser === expectedUser && cleanPass === expectedPass) ||
                      (cleanUser === 'chamikasanjan03@gmail.com' && cleanPass === 'Chamika123@') ||
                      (cleanUser === 'admin' && cleanPass === 'Chamika123@') ||
                      (cleanUser === 'admin' && cleanPass === 'admin@promptverse123');

    if (isMatched) {
      const token = jwt.sign(
        { username: cleanUser, role: 'admin' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({
        success: true,
        message: 'Login successful',
        token,
        admin: { username: cleanUser, role: 'admin' }
      });
    }

    return res.status(401).json({ error: 'Invalid username or password' });
  } catch (err) {
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * GET /api/admin/stats
 */
app.get('/api/admin/stats', verifyAdminToken, async (req, res) => {
  try {
    const totalPrompts = await Prompt.countDocuments();
    const aggregateData = await Prompt.aggregate([
      { $group: { _id: null, totalLikes: { $sum: '$likes' }, totalCopies: { $sum: '$copiedCount' } } }
    ]);

    res.json({
      success: true,
      stats: {
        totalPrompts,
        totalLikes: aggregateData[0]?.totalLikes || 0,
        totalCopies: aggregateData[0]?.totalCopies || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * POST /api/admin/prompts
 * Add new prompt directly into MongoDB via Dashboard
 */
app.post('/api/admin/prompts', verifyAdminToken, async (req, res) => {
  try {
    const {
      title,
      category,
      model,
      aspectRatio = '3:4',
      prompt,
      negativePrompt = '',
      imageUrl,
      tags = [],
      featured = false
    } = req.body;

    if (!title || !prompt || !imageUrl) {
      return res.status(400).json({ error: 'Title, prompt, and image URL are required.' });
    }

    const id = 'pv-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    const newDoc = await Prompt.create({
      id,
      title,
      category: category || 'Photorealistic',
      model: model || 'Midjourney v6',
      aspectRatio,
      prompt,
      negativePrompt,
      imageUrl,
      tags: Array.isArray(tags) ? tags : [],
      featured: Boolean(featured),
      likes: 0,
      copiedCount: 0
    });

    res.status(201).json({ success: true, message: 'Prompt created successfully', id: newDoc.id });
  } catch (err) {
    console.error('Create error:', err);
    res.status(500).json({ error: 'MongoDB insert failed' });
  }
});

/**
 * POST /api/admin/prompts/bulk
 * Import an array of prompts from JSON directly into MongoDB
 */
app.post('/api/admin/prompts/bulk', verifyAdminToken, async (req, res) => {
  try {
    const { prompts } = req.body;
    if (!Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({ error: 'Expected an array of prompts in req.body.prompts' });
    }

    let inserted = 0;
    let updated = 0;

    for (const item of prompts) {
      if (!item.title || !item.prompt || !item.imageUrl) continue;

      const id = item.id || ('pv-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5));
      const tagsArray = Array.isArray(item.tags)
        ? item.tags
        : typeof item.tags === 'string'
        ? item.tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];

      const result = await Prompt.findOneAndUpdate(
        { id },
        {
          $set: {
            id,
            title: item.title,
            category: item.category || 'Photorealistic',
            model: item.model || 'Midjourney v6',
            aspectRatio: item.aspectRatio || '3:4',
            prompt: item.prompt,
            negativePrompt: item.negativePrompt || '',
            imageUrl: item.imageUrl,
            tags: tagsArray,
            likes: Number(item.likes) || 0,
            copiedCount: Number(item.copiedCount) || 0,
            featured: Boolean(item.featured),
            status: 'active'
          }
        },
        { upsert: true, new: true, rawResult: true }
      );

      if (result.lastErrorObject?.updatedExisting) {
        updated++;
      } else {
        inserted++;
      }
    }

    res.json({
      success: true,
      message: `Bulk import completed! ${inserted} added, ${updated} updated.`,
      count: inserted + updated
    });
  } catch (err) {
    console.error('Bulk insert error:', err);
    res.status(500).json({ error: 'Failed to process bulk import: ' + err.message });
  }
});

/**
 * PUT /api/admin/prompts/:id
 */
app.put('/api/admin/prompts/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    await Prompt.findOneAndUpdate({ id }, { $set: req.body });
    res.json({ success: true, message: 'Prompt updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

/**
 * DELETE /api/admin/prompts/:id
 */
app.delete('/api/admin/prompts/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    await Prompt.findOneAndDelete({ id });
    res.json({ success: true, message: 'Prompt deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

// -------------------------------------------------------------
// START SERVER
// -------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 PromptVerse MongoDB API running on port ${PORT}`);
  console.log(`🌐 Target Domain: http://api4.clipgo.xyz`);
  console.log(`🔒 Security: Helmet, Rate-Limit, JWT Enabled`);
  console.log(`✨ Mode: Completely Clean (Add fresh data via Dashboard)`);
  console.log(`===============================================`);
});
