const express = require('express');
const cors = require('cors');
const { rebelaldwn } = require('trs-media-downloader');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ status: 'running', message: 'API is working!' });
});

app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });

    try {
        const result = await rebelaldwn(url);

        // Check if the library returned its fallback data
        if (result.developer) {
            return res.json({
                success: false,
                error: 'This link could not be processed. Make sure it is a public video from a supported platform (Instagram, TikTok, Facebook, YouTube, etc.) and that the video is not private or age-restricted.'
            });
        }

        const formats = [];

        // Function to check if a URL is likely a video/audio file
        const isMediaUrl = (str) => {
            if (typeof str !== 'string') return false;
            const mediaExtensions = /\.(mp4|webm|mov|avi|mkv|mp3|m4a|jpg|jpeg|png|gif)(\?|$)/i;
            return str.startsWith('http') && (mediaExtensions.test(str) || str.includes('video') || str.includes('media'));
        };

        // Look for video/audio in common properties
        if (result.video) {
            const videoObj = result.video;
            if (videoObj.hd && isMediaUrl(videoObj.hd)) formats.push({ quality: 'HD Video', url: videoObj.hd, type: 'MP4' });
            if (videoObj.sd && isMediaUrl(videoObj.sd)) formats.push({ quality: 'SD Video', url: videoObj.sd, type: 'MP4' });
            if (videoObj.url && isMediaUrl(videoObj.url)) formats.push({ quality: 'Video', url: videoObj.url, type: 'MP4' });
        }

        if (result.videoUrl && isMediaUrl(result.videoUrl)) {
            formats.push({ quality: 'Video', url: result.videoUrl, type: 'MP4' });
        }

        if (result.url && isMediaUrl(result.url)) {
            formats.push({ quality: 'Video', url: result.url, type: 'MP4' });
        }

        if (result.audio && isMediaUrl(result.audio)) {
            formats.push({ quality: 'Audio Only', url: result.audio, type: 'MP3' });
        }

        // Also check inside any 'links' or 'urls' arrays
        if (result.links && Array.isArray(result.links)) {
            result.links.forEach(link => {
                if (typeof link === 'string' && isMediaUrl(link)) {
                    formats.push({ quality: 'Media', url: link, type: 'FILE' });
                } else if (link.url && isMediaUrl(link.url)) {
                    formats.push({ quality: link.quality || 'Media', url: link.url, type: link.type || 'FILE' });
                }
            });
        }

        if (formats.length === 0) {
            return res.json({ success: false, error: 'No downloadable formats found. The platform may have changed or the content is not accessible.' });
        }

        res.json({
            success: true,
            platform: result.platform || 'unknown',
            title: result.title || null,
            thumbnail: result.thumbnail || null,
            formats
        });
    } catch (err) {
        console.error(err);
        res.json({ success: false, error: `Failed: ${err.message}` });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
