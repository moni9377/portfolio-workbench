const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const qiniu = require('qiniu');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'portfolio-workbench-secret-key-2026';

// R2 Configuration (from environment variables)
const R2_ENABLED = process.env.R2_ENABLED === 'true';
const R2_BUCKET = process.env.R2_BUCKET || '';
const R2_ENDPOINT = process.env.R2_ENDPOINT || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

let s3Client = null;
if (R2_ENABLED && R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
    s3Client = new S3Client({
        region: 'auto',
        endpoint: R2_ENDPOINT,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    });
    console.log('R2 storage enabled');
} else {
    console.log('R2 storage disabled (using local storage only)');
}

// Qiniu (七牛云) Configuration
const QINIU_ENABLED = process.env.QINIU_ENABLED === 'true';
const QINIU_ACCESS_KEY = process.env.QINIU_ACCESS_KEY || '';
const QINIU_SECRET_KEY = process.env.QINIU_SECRET_KEY || '';
const QINIU_BUCKET = process.env.QINIU_BUCKET || '';
const QINIU_DOMAIN = process.env.QINIU_DOMAIN || ''; // e.g. https://xxx.bkt.clouddn.com

let qiniuMac = null;
let qiniuBucketManager = null;
if (QINIU_ENABLED && QINIU_ACCESS_KEY && QINIU_SECRET_KEY && QINIU_BUCKET) {
    qiniuMac = new qiniu.auth.digest.Mac(QINIU_ACCESS_KEY, QINIU_SECRET_KEY);
    const qiniuConfig = new qiniu.conf.Config();
    qiniuConfig.zone = qiniu.zone.Zone_z0; // 华东
    qiniuBucketManager = new qiniu.rs.BucketManager(qiniuMac, qiniuConfig);
    console.log('Qiniu storage enabled');
} else {
    console.log('Qiniu storage disabled');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Data directory (D drive by default, or env var for Docker/cloud)
const DATA_DIR = process.env.DATA_DIR || 'D:\\portfolio-workbench-data';
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Serve uploads from D drive
app.use('/uploads', express.static(UPLOADS_DIR));

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Uploads directory for multer
const uploadsDir = UPLOADS_DIR;

// Database setup - store on D drive
const db = new Database(path.join(DATA_DIR, 'database.sqlite'));

// Create tables
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS works (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('document', 'video', 'link', 'webpage')),
        description TEXT,
        file_path TEXT,
        url TEXT,
        file_name TEXT,
        file_size INTEGER,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
    );
`);

// Insert default categories if none exist
const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
if (categoryCount.count === 0) {
    const defaultCategories = [
        { id: uuidv4(), name: '剪辑类', sort_order: 1 },
        { id: uuidv4(), name: '策划类', sort_order: 2 },
        { id: uuidv4(), name: '摄影类', sort_order: 3 },
        { id: uuidv4(), name: '设计类', sort_order: 4 },
        { id: uuidv4(), name: '写作类', sort_order: 5 },
        { id: uuidv4(), name: '其他', sort_order: 6 }
    ];
    const insertCat = db.prepare('INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)');
    defaultCategories.forEach(cat => insertCat.run(cat.id, cat.name, cat.sort_order));
}

// Upload file to R2
async function uploadToR2(localFilePath, key, contentType) {
    if (!s3Client) return null;
    try {
        const fileStream = fs.createReadStream(localFilePath);
        const command = new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
            Body: fileStream,
            ContentType: contentType || 'application/octet-stream',
        });
        await s3Client.send(command);
        return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : `${R2_ENDPOINT}/${R2_BUCKET}/${key}`;
    } catch (err) {
        console.error('R2 upload error:', err);
        return null;
    }
}

// Delete file from R2
async function deleteFromR2(key) {
    if (!s3Client) return;
    try {
        const command = new DeleteObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
        });
        await s3Client.send(command);
    } catch (err) {
        console.error('R2 delete error:', err);
    }
}

// Extract R2 key from URL
function getR2KeyFromUrl(url) {
    if (!url) return null;
    if (R2_PUBLIC_URL && url.startsWith(R2_PUBLIC_URL)) {
        return url.replace(R2_PUBLIC_URL + '/', '');
    }
    return null;
}

// Upload file to Qiniu
async function uploadToQiniu(localFilePath, key, mimeType) {
    if (!qiniuMac || !QINIU_BUCKET) return null;
    try {
        const putPolicy = new qiniu.rs.PutPolicy({ scope: QINIU_BUCKET });
        const uploadToken = putPolicy.uploadToken(qiniuMac);
        const config = new qiniu.conf.Config();
        config.zone = qiniu.zone.Zone_z0;
        const formUploader = new qiniu.form_up.FormUploader(config);
        const putExtra = new qiniu.form_up.PutExtra();
        
        return new Promise((resolve, reject) => {
            formUploader.putFile(uploadToken, key, localFilePath, putExtra, (err, body, info) => {
                if (err) {
                    console.error('Qiniu upload error:', err);
                    resolve(null);
                } else if (info.statusCode === 200) {
                    const url = QINIU_DOMAIN ? `${QINIU_DOMAIN}/${key}` : `https://${QINIU_BUCKET}.bkt.clouddn.com/${key}`;
                    resolve(url);
                } else {
                    console.error('Qiniu upload failed:', info);
                    resolve(null);
                }
            });
        });
    } catch (err) {
        console.error('Qiniu upload error:', err);
        return null;
    }
}

// Delete file from Qiniu
async function deleteFromQiniu(key) {
    if (!qiniuBucketManager || !QINIU_BUCKET) return;
    try {
        await new Promise((resolve, reject) => {
            qiniuBucketManager.delete(QINIU_BUCKET, key, (err, respBody, respInfo) => {
                if (err) {
                    console.error('Qiniu delete error:', err);
                }
                resolve();
            });
        });
    } catch (err) {
        console.error('Qiniu delete error:', err);
    }
}

// Extract Qiniu key from URL
function getQiniuKeyFromUrl(url) {
    if (!url || !QINIU_DOMAIN) return null;
    if (url.startsWith(QINIU_DOMAIN + '/')) {
        return url.replace(QINIU_DOMAIN + '/', '');
    }
    return null;
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '未提供认证令牌' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '令牌无效或已过期' });
        }
        req.user = user;
        next();
    });
};

// ========== AUTH ROUTES ==========

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, display_name, password } = req.body;

        if (!username || !display_name || !password) {
            return res.status(400).json({ error: '请填写所有必填字段' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: '密码至少需要6位' });
        }

        const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existingUser) {
            return res.status(400).json({ error: '用户名已存在' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const id = uuidv4();

        db.prepare('INSERT INTO users (id, username, display_name, password_hash) VALUES (?, ?, ?, ?)')
            .run(id, username, display_name, password_hash);

        const token = jwt.sign({ id, username, display_name }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id, username, display_name } });
    } catch (err) {
        res.status(500).json({ error: '注册失败: ' + err.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user) {
            return res.status(400).json({ error: '用户名或密码错误' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(400).json({ error: '用户名或密码错误' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, display_name: user.display_name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                display_name: user.display_name
            }
        });
    } catch (err) {
        res.status(500).json({ error: '登录失败: ' + err.message });
    }
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// ========== CATEGORY ROUTES ==========

// Get all categories
app.get('/api/categories', (req, res) => {
    try {
        const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, created_at').all();
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create category (auth required)
app.post('/api/categories', authenticateToken, (req, res) => {
    try {
        const { name, sort_order } = req.body;
        if (!name) {
            return res.status(400).json({ error: '分类名称不能为空' });
        }

        const id = uuidv4();
        db.prepare('INSERT INTO categories (id, name, sort_order, created_by) VALUES (?, ?, ?, ?)')
            .run(id, name, sort_order || 0, req.user.id);

        res.json({ id, name, sort_order: sort_order || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete category (auth required)
app.delete('/api/categories/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM categories WHERE id = ?').run(id);
        res.json({ message: '分类已删除' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== WORK ROUTES ==========

// Get all works (public)
app.get('/api/works', (req, res) => {
    try {
        const { search, category } = req.query;
        let query = `
            SELECT w.*, c.name as category_name, u.display_name as creator_name
            FROM works w
            LEFT JOIN categories c ON w.category_id = c.id
            LEFT JOIN users u ON w.created_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (w.title LIKE ? OR w.description LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
            query += ` AND w.category_id = ?`;
            params.push(category);
        }

        query += ` ORDER BY w.created_at DESC`;

        const works = db.prepare(query).all(...params);
        res.json(works);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single work
app.get('/api/works/:id', (req, res) => {
    try {
        const work = db.prepare(`
            SELECT w.*, c.name as category_name, u.display_name as creator_name
            FROM works w
            LEFT JOIN categories c ON w.category_id = c.id
            LEFT JOIN users u ON w.created_by = u.id
            WHERE w.id = ?
        `).get(req.params.id);

        if (!work) {
            return res.status(404).json({ error: '作品不存在' });
        }

        res.json(work);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create work (auth required)
app.post('/api/works', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const { title, category_id, type, description, url } = req.body;

        if (!title || !category_id || !type) {
            return res.status(400).json({ error: '标题、分类和类型为必填项' });
        }

        const id = uuidv4();
        let file_path = null;
        let file_name = null;
        let file_size = null;

        if (req.file) {
            file_name = req.file.originalname;
            file_size = req.file.size;

            // Try to upload to Qiniu first
            if (qiniuMac && QINIU_BUCKET) {
                const qiniuKey = `works/${id}/${req.file.filename}`;
                const qiniuUrl = await uploadToQiniu(req.file.path, qiniuKey, req.file.mimetype);
                if (qiniuUrl) {
                    file_path = qiniuUrl;
                    console.log('Uploaded to Qiniu:', qiniuUrl);
                } else {
                    // Fallback to local storage
                    file_path = `/uploads/${req.file.filename}`;
                }
            } else if (s3Client && R2_BUCKET) {
                // Fallback to R2
                const r2Key = `works/${id}/${req.file.filename}`;
                const r2Url = await uploadToR2(req.file.path, r2Key, req.file.mimetype);
                if (r2Url) {
                    file_path = r2Url;
                    console.log('Uploaded to R2:', r2Url);
                } else {
                    file_path = `/uploads/${req.file.filename}`;
                }
            } else {
                file_path = `/uploads/${req.file.filename}`;
            }
        }

        db.prepare(`
            INSERT INTO works (id, title, category_id, type, description, file_path, url, file_name, file_size, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, title, category_id, type, description || null, file_path, url || null, file_name, file_size, req.user.id);

        const work = db.prepare(`
            SELECT w.*, c.name as category_name, u.display_name as creator_name
            FROM works w
            LEFT JOIN categories c ON w.category_id = c.id
            LEFT JOIN users u ON w.created_by = u.id
            WHERE w.id = ?
        `).get(id);

        res.json(work);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete work (auth required)
app.delete('/api/works/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const work = db.prepare('SELECT file_path FROM works WHERE id = ?').get(id);

        if (work && work.file_path) {
            // If it's a Qiniu URL, delete from Qiniu
            const qiniuKey = getQiniuKeyFromUrl(work.file_path);
            if (qiniuKey) {
                await deleteFromQiniu(qiniuKey);
            }
            // If it's an R2 URL, delete from R2
            const r2Key = getR2KeyFromUrl(work.file_path);
            if (r2Key) {
                await deleteFromR2(r2Key);
            }
            // Also delete local file if exists
            const filename = path.basename(work.file_path);
            const localPath = path.join(uploadsDir, filename);
            if (fs.existsSync(localPath)) {
                fs.unlinkSync(localPath);
            }
        }

        db.prepare('DELETE FROM works WHERE id = ?').run(id);
        res.json({ message: '作品已删除' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Download file
app.get('/api/download/:filename', (req, res) => {
    try {
        const filePath = path.join(uploadsDir, req.params.filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: '文件不存在' });
        }
        res.download(filePath);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== EXPORT ROUTES ==========

// Export all works and categories as JSON for static site generation
app.get('/api/export', (req, res) => {
    try {
        const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, created_at').all();
        const works = db.prepare(`
            SELECT w.*, c.name as category_name
            FROM works w
            LEFT JOIN categories c ON w.category_id = c.id
            ORDER BY w.created_at DESC
        `).all();

        res.json({
            exported_at: new Date().toISOString(),
            categories,
            works
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export static data to public/data/works.json for standalone showcase page
app.post('/api/export-static', authenticateToken, (req, res) => {
    try {
        const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, created_at').all();
        const works = db.prepare(`
            SELECT w.*, c.name as category_name, u.display_name as creator_name
            FROM works w
            LEFT JOIN categories c ON w.category_id = c.id
            LEFT JOIN users u ON w.created_by = u.id
            ORDER BY w.created_at DESC
        `).all();

        const exportData = {
            exported_at: new Date().toISOString(),
            categories,
            works
        };

        const publicDataDir = path.join(__dirname, 'public', 'data');
        if (!fs.existsSync(publicDataDir)) {
            fs.mkdirSync(publicDataDir, { recursive: true });
        }
        const exportPath = path.join(publicDataDir, 'works.json');
        fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf8');

        res.json({ message: '展示页数据已导出', path: '/data/works.json', works: works.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check Qiniu configuration status
app.get('/api/qiniu-status', (req, res) => {
    res.json({
        enabled: QINIU_ENABLED,
        configured: !!qiniuMac,
        bucket: QINIU_BUCKET,
        domain: QINIU_DOMAIN,
    });
});

// Check R2 configuration status
app.get('/api/r2-status', (req, res) => {
    res.json({
        enabled: R2_ENABLED,
        configured: !!s3Client,
        bucket: R2_BUCKET,
        publicUrl: R2_PUBLIC_URL,
    });
});
app.get('/api/stats', (req, res) => {
    try {
        const worksCount = db.prepare('SELECT COUNT(*) as count FROM works').get();
        const categoriesCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
        const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get();

        res.json({
            works: worksCount.count,
            categories: categoriesCount.count,
            users: usersCount.count
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Portfolio Workbench running on http://localhost:${PORT}`);
});
