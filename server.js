const express = require('express');
const cors = require('cors');

// Import the downloader library
let rebelaldwn;
try {
    const trs = require('trs-media-downloader');
    rebelaldwn = trs.default || trs.rebelaldwn || trs;
    console.log('✅ trs-media-downloader loaded successfully');
} catch (e) {
    console.error('❌ Failed to load trs-media-downloader:', e.message);
}

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'running', message: 'API is working!' });
});

// Main download endpoint
app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    console.log(`📥 Received request for: ${url}`);

    if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
    }

    if (!rebelaldwn) {
        return res.json({ 
            success: false, 
            error: 'Downloader module not available. Please check server logs.' 
        });
    }

    try {
        console.log(`🔄 Attempting to download from: ${url}`);
        const result = await rebelaldwn(url);
        
        // Log the full result structure to help debug
        console.log('📦 Result structure:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const formats = [];

        // Method 1: Standard video format (as per documentation)
        if (result.video) {
            if (result.video.hd) {
                formats.push({ 
                    quality: 'HD Video (1080p)', 
                    url: result.video.hd, 
                    type: 'MP4' 
                });
                console.log('✅ Found HD video');
            }
            if (result.video.sd) {
                formats.push({ 
                    quality: 'SD Video (480p)', 
                    url: result.video.sd, 
                    type: 'MP4' 
                });
                console.log('✅ Found SD video');
            }
        }

        // Method 2: Direct video URL at root level
        if (result.videoUrl || result.video_url) {
            const videoUrl = result.videoUrl || result.video_url;
            formats.push({ 
                quality: 'Video', 
                url: videoUrl, 
                type: 'MP4' 
            });
            console.log('✅ Found root-level video URL');
        }

        // Method 3: URL list from response (some platforms)
        if (result.url_list && Array.isArray(result.url_list) && result.url_list.length > 0) {
            result.url_list.forEach((item, idx) => {
                if (item.url) {
                    const quality = item.quality || item.resolution || `Format ${idx + 1}`;
                    formats.push({ 
                        quality: quality, 
                        url: item.url, 
                        type: item.ext || 'MP4' 
                    });
                }
            });
            console.log(`✅ Found ${result.url_list.length} URLs in url_list`);
        }

        // Method 4: Links array (fallback)
        if (result.links && Array.isArray(result.links) && result.links.length > 0) {
            result.links.forEach((link, idx) => {
                if (typeof link === 'string' && link.startsWith('http')) {
                    formats.push({
                        quality: `Download Link ${idx + 1}`,
                        url: link,
                        type: 'MEDIA'
                    });
                } else if (link.url) {
                    formats.push({
                        quality: link.quality || `Link ${idx + 1}`,
                        url: link.url,
                        type: link.type || 'MEDIA'
                    });
                }
            });
            console.log(`✅ Found ${result.links.length} links`);
        }

        // Method 5: Audio only (if video not found)
        if (result.audio && formats.length === 0) {
            formats.push({ 
                quality: 'Audio Only', 
                url: result.audio, 
                type: 'MP3' 
            });
            console.log('✅ Found audio (no video)');
        }

        // Method 6: Check for any URL in the response
        if (formats.length === 0) {
            // Look for any property that contains a URL
            for (const [key, value] of Object.entries(result)) {
                if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
                    formats.push({
                        quality: key.replace(/_/g, ' '),
                        url: value,
                        type: 'MEDIA'
                    });
                    console.log(`✅ Found URL in property: ${key}`);
                }
            }
        }

        if (formats.length === 0) {
            console.log('❌ No downloadable formats found in response');
            return res.json({ 
                success: false, 
                error: 'No downloadable formats found. This platform may have changed its API or the content may be private.' 
            });
        }

        console.log(`✅ Returning ${formats.length} download format(s)`);
        res.json({
            success: true,
            platform: result.platform || 'unknown',
            title: result.title || null,
            thumbnail: result.thumbnail || null,
            formats: formats
        });
        
    } catch (error) {
        console.error('❌ Download error:', error.message);
        res.json({
            success: false,
            error: `Failed to process: ${error.message}. Make sure the URL is public and valid.`
        });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/`);
    console.log(`📥 Download endpoint: http://localhost:${PORT}/api/download`);
});
