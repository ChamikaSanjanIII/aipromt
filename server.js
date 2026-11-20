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
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/story_db';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_storyverse_2026';
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
    console.log('✅ Connected to MongoDB');
    seedDefaultStories();
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err.message);
  });

// -------------------------------------------------------------
// 2. MONGOOSE SCHEMA & MODEL
// -------------------------------------------------------------
const ChapterSchema = new mongoose.Schema({
  chapterNumber: { type: Number, required: true },
  title: { type: String, required: true },
  readTime: { type: String, default: '5 min' },
  content: { type: String, required: true }
});

const StorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, default: 'Unknown Author' },
    category: { type: String, required: true, index: true },
    coverImage: { type: String, required: true },
    summary: { type: String, required: true },
    previewExcerpt: { type: String, default: '' },
    totalPages: { type: Number, default: 120 },
    currentReadingPage: { type: Number, default: 1 },
    series: { type: String, default: '' },
    volume: { type: String, default: '' },
    tags: { type: [String], default: [] },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    featured: { type: Boolean, default: false, index: true },
    popular: { type: Boolean, default: false, index: true },
    status: { type: String, enum: ['published', 'draft'], default: 'published', index: true },
    chapters: [ChapterSchema]
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

StorySchema.index({ title: 'text', author: 'text', summary: 'text', tags: 'text' });
const Story = mongoose.model('Story', StorySchema);

// -------------------------------------------------------------
// 3. SECURITY & MIDDLEWARE
// -------------------------------------------------------------
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Authentication Middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
  }
};

// -------------------------------------------------------------
// 4. CLEAN DATABASE - NO HARDCODED SEED STORIES
// -------------------------------------------------------------
function seedDefaultStories() {
  console.log('🍃 Clean Database mode: Ready for Dashboard entries.');
}

// -------------------------------------------------------------
// 5. PUBLIC APIS
// -------------------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Story Platform API', timestamp: new Date() });
});

// Get all stories with filtering & pagination
app.get('/api/stories', async (req, res) => {
  try {
    const { category, search, popular, featured, page = 1, limit = 20 } = req.query;
    const filter = { status: 'published' };

    if (category && category !== 'all') {
      filter.category = new RegExp(category, 'i');
    }
    if (popular === 'true') {
      filter.popular = true;
    }
    if (featured === 'true') {
      filter.featured = true;
    }
    if (search) {
      filter.$text = { $search: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const stories = await Story.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Story.countDocuments(filter);

    res.json({
      success: true,
      data: stories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stories', details: err.message });
  }
});

// Get single story by ID or slug
app.get('/api/stories/:id', async (req, res) => {
  try {
    const story = await Story.findOne({ id: req.params.id });
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    // Increment views
    story.views += 1;
    await story.save();

    res.json({ success: true, data: story });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch story', details: err.message });
  }
});

// Like a story
app.post('/api/stories/:id/like', async (req, res) => {
  try {
    const story = await Story.findOneAndUpdate(
      { id: req.params.id },
      { $inc: { likes: 1 } },
      { new: true }
    );
    if (!story) return res.status(404).json({ error: 'Story not found' });
    res.json({ success: true, likes: story.likes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to like story' });
  }
});

// -------------------------------------------------------------
// 6. ADMIN AUTHENTICATION
// -------------------------------------------------------------
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      success: true,
      token,
      admin: { username, role: 'admin' }
    });
  }

  return res.status(401).json({ error: 'Invalid admin credentials' });
});

// -------------------------------------------------------------
// 7. ADMIN PROTECTED APIS
// -------------------------------------------------------------
// Create Story
app.post('/api/admin/stories', authenticateAdmin, async (req, res) => {
  try {
    const { title, author, category, coverImage, summary, previewExcerpt, totalPages, series, volume, tags, chapters } = req.body;
    if (!title || !category || !coverImage || !summary) {
      return res.status(400).json({ error: 'Required fields: title, category, coverImage, summary' });
    }

    const id = 'story-' + Date.now();
    const newStory = new Story({
      id,
      title,
      author: author || 'Admin Author',
      category,
      coverImage,
      summary,
      previewExcerpt: previewExcerpt || summary.slice(0, 150) + '...',
      totalPages: totalPages || 100,
      series: series || '',
      volume: volume || '',
      tags: tags || [],
      chapters: chapters || []
    });

    await newStory.save();
    res.status(201).json({ success: true, data: newStory });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create story', details: err.message });
  }
});

// Bulk Create Stories (from JSON import)
app.post('/api/admin/stories/bulk', authenticateAdmin, async (req, res) => {
  try {
    const { stories } = req.body;
    if (!Array.isArray(stories) || stories.length === 0) {
      return res.status(400).json({ error: 'stories must be a non-empty array' });
    }

    const docs = [];
    for (let i = 0; i < stories.length; i++) {
      const item = stories[i] || {};
      const title = String(item.title || '').trim();
      const rawStory = String(item.story || item.content || '').trim();
      if (!title || (!rawStory && (!Array.isArray(item.chapters) || item.chapters.length === 0))) {
        continue;
      }

      const category =
        String(
          item.category ||
          (Array.isArray(item.categories) && item.categories[0]) ||
          'General'
        ).trim();

      const summary = String(item.summary || rawStory.slice(0, 220)).trim() || title;
      const previewExcerpt = String(item.previewExcerpt || rawStory.slice(0, 150) + (rawStory.length > 150 ? '...' : '')).trim();
      const coverImage = String(item.coverImage || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80').trim();
      const wordCount = rawStory ? rawStory.split(/\s+/).length : 200;
      const readTime = `${Math.max(1, Math.ceil(wordCount / 200))} min`;

      const chapters =
        Array.isArray(item.chapters) && item.chapters.length > 0
          ? item.chapters
          : [
              {
                chapterNumber: 1,
                title: title,
                readTime,
                content: rawStory || summary
              }
            ];

      const tags = Array.isArray(item.tags)
        ? item.tags
        : Array.isArray(item.categories)
        ? item.categories
        : [category];

      docs.push({
        id: `story-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        author: String(item.author || 'Admin Author').trim(),
        category,
        coverImage,
        summary,
        previewExcerpt,
        totalPages: Number(item.totalPages) || Math.max(1, Math.ceil(rawStory.length / 1800)),
        series: String(item.series || '').trim(),
        volume: String(item.volume || '').trim(),
        tags,
        status: item.status === 'draft' ? 'draft' : 'published',
        chapters
      });
    }

    if (docs.length === 0) {
      return res.status(400).json({ error: 'No valid stories found in payload' });
    }

    const inserted = await Story.insertMany(docs, { ordered: false });
    res.status(201).json({
      success: true,
      insertedCount: inserted.length,
      data: inserted
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to bulk import stories', details: err.message });
  }
});

// Update Story
app.put('/api/admin/stories/:id', authenticateAdmin, async (req, res) => {
  try {
    const updated = await Story.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Story not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update story' });
  }
});

// Delete Story
app.delete('/api/admin/stories/:id', authenticateAdmin, async (req, res) => {
  try {
    const deleted = await Story.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ error: 'Story not found' });
    res.json({ success: true, message: 'Story deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

// Admin Stats
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    const totalStories = await Story.countDocuments();
    const published = await Story.countDocuments({ status: 'published' });
    const totalLikes = await Story.aggregate([{ $group: { _id: null, total: { $sum: '$likes' } } }]);
    const totalViews = await Story.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]);

    res.json({
      success: true,
      stats: {
        totalStories,
        published,
        likes: totalLikes[0]?.total || 0,
        views: totalViews[0]?.total || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Story Platform API running at http://localhost:${PORT}`);
});
