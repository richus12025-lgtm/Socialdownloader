const express = require('express');
const cors = require('cors');

// Try to load the downloader library – handles different export styles
let rebelaldwn;
try {
    const trs = require('trs-media-downloader');
    rebelaldwn = trs.default || trs.rebelaldwn || trs;
} catch (e) {
    console.error('Failed to load trs-media-downloader:', e.message);
}

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint – helps Render know the app is alive
app.get('/', (req, res) => {
    res.json({ status: 'running', message: 'API is working!' });
});

// Main download endpoint
app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
    }

    if (!rebelaldwn) {
        return res.json({ success: false, error: 'Downloader module not available. Check server logs.' });
    }

    try {
        const result = await rebelaldwn(url);
        const formats = [];

        // Add video formats (HD, SD) if available
        if (result.video) {
            if (result.video.hd) formats.push({ quality: 'HD Video', url: result.video.hd, type: 'MP4' });
            if (result.video.sd) formats.push({ quality: 'SD Video', url: result.video.sd, type: 'MP4' });
        }

        // Add audio if available
        if (result.audio) formats.push({ quality: 'Audio Only', url: result.audio, type: 'MP3' });

        // Fallback for other platforms
        if (formats.length === 0 && result.links && result.links.length) {
            result.links.forEach((link, i) => formats.push({ quality: `Link ${i+1}`, url: link, type: 'MEDIA' }));
        }

        if (formats.length === 0) {
            return res.json({ success: false, error: 'No downloadable formats found.' });
        }

        res.json({ success: true, platform: result.platform || 'unknown', formats });
    } catch (err) {
        console.error('Download error:', err.message);
        res.json({ success: false, error: 'Failed to process the link. Make sure it is public.' });
    }
});

// Start the server (Render sets PORT automatically)
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));