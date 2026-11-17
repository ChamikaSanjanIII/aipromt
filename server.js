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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
// 4. SEED INITIAL STORIES (Clean original literature themes)
// -------------------------------------------------------------
async function seedDefaultStories() {
  try {
    const count = await Story.countDocuments();
    if (count === 0) {
      console.log('🌱 Seeding initial sample stories...');
      const sampleStories = [
        {
          id: 'story-1',
          title: 'The Silent Whispers of the Valley',
          author: 'Alexander Sterling',
          category: 'Fantasy & Mystery',
          coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
          summary: 'In a forgotten valley surrounded by mist-laden cliffs, an ancient library holds the records of voices long lost to the wind.',
          previewExcerpt: 'The lantern flickered against the damp stone corridor. Harvey gripped the silver key tightly. For centuries, no one had dared step past the chamber of echoes, yet the silence itself seemed to call his name with an undeniable pull.',
          totalPages: 280,
          currentReadingPage: 42,
          series: 'Chronicles of the Mist',
          volume: 'Vol 1',
          tags: ['Mystery', 'Adventure', 'Fantasy'],
          views: 1240,
          likes: 342,
          featured: true,
          popular: true,
          status: 'published',
          chapters: [
            {
              chapterNumber: 1,
              title: 'The Gates of Mist',
              readTime: '6 min',
              content: 'The valley had been quiet for three hundred years. When the clock struck midnight atop the silver spire, the heavy iron bells remained still, yet the air vibrated with an ethereal murmur.\n\nHarvey reached out his hand, brushing the cold moss that clung to the archway. Behind him, the path had completely vanished into the pale fog. Ahead lay the great library whose books were whispered to write themselves whenever a traveler stepped within.'
            },
            {
              chapterNumber: 2,
              title: 'The Chamber of Echoes',
              readTime: '8 min',
              content: 'Every footstep resounded like a bronze bell. High above, vaulted ceilings arched into shadows where golden inscriptions glistened under the dim light of his torch.'
            }
          ]
        },
        {
          id: 'story-2',
          title: 'Echoes of the Midnight Clock',
          author: 'Eleanor Vance',
          category: 'Adventure',
          coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80',
          summary: 'A thrilling voyage across uncharted seas where time flows backwards whenever the moon turns crimson.',
          previewExcerpt: 'Every hour after midnight, the stars shifted in reverse. Captain Vance adjusted the brass sextant and watched the ocean currents ripple against the impossible tide.',
          totalPages: 310,
          currentReadingPage: 154,
          series: 'Voyages Beyond the Map',
          volume: 'Vol 2',
          tags: ['Maritime', 'Adventure', 'Mystery'],
          views: 950,
          likes: 280,
          featured: false,
          popular: true,
          status: 'published',
          chapters: [
            {
              chapterNumber: 1,
              title: 'The Crimson Horizon',
              readTime: '7 min',
              content: 'The sea was glassy, reflecting an indigo sky that refused to lighten into dawn. The compass needle spun gently, pointing neither north nor south, but directly into the heart of the uncharted rift.'
            }
          ]
        },
        {
          id: 'story-3',
          title: 'The Clockwork Alchemist',
          author: 'Julian Thorne',
          category: 'Sci-Fi / Steampunk',
          coverImage: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?auto=format&fit=crop&w=600&q=80',
          summary: 'In an empire powered by steam and clockwork gears, one artisan discovers a mechanism capable of turning stone into pure energy.',
          previewExcerpt: 'Gears interlocking in perfect harmony, the bronze automaton lifted its hand and inscribed the first equation of renewal onto the brass plate.',
          totalPages: 245,
          currentReadingPage: 12,
          series: 'Gear & Stone',
          volume: 'Vol 1',
          tags: ['Steampunk', 'Science', 'Craft'],
          views: 820,
          likes: 195,
          featured: false,
          popular: true,
          status: 'published',
          chapters: [
            {
              chapterNumber: 1,
              title: 'Ticking Brass',
              readTime: '5 min',
              content: 'The workshop smelled of mineral oil, heated copper, and ozone. Master Thorne inspected the miniature escapement wheel through his jeweler lens.'
            }
          ]
        },
        {
          id: 'story-4',
          title: 'The Lost Botanist of Oakhaven',
          author: 'Clara Bennett',
          category: 'Historical Fiction',
          coverImage: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80',
          summary: 'The chronicles of a Victorian botanist documenting luminous flora that blooms only during solar eclipses.',
          previewExcerpt: 'Her journal was filled with pressed petals of translucent blue. With each specimen came a memory of the mountain path that nearly cost her life.',
          totalPages: 190,
          currentReadingPage: 78,
          series: 'The Green Realm',
          volume: 'Vol 1',
          tags: ['Botany', 'Nature', 'Historical'],
          views: 740,
          likes: 210,
          featured: false,
          popular: true,
          status: 'published',
          chapters: [
            {
              chapterNumber: 1,
              title: 'The Luminous Root',
              readTime: '6 min',
              content: 'It was on the third day of the expedition when Clara spotted the pale glow beneath the roots of the ancient yew tree.'
            }
          ]
        }
      ];
      await Story.insertMany(sampleStories);
      console.log('✅ Successfully seeded sample stories.');
    }
  } catch (err) {
    console.error('Error seeding stories:', err);
  }
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
