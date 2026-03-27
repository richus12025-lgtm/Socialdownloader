const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ status: 'running', message: 'API is working with yt-dlp!' });
});

app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    console.log(`📥 Received request for: ${url}`);

    if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
    }

    try {
        // Ensure yt-dlp is installed (it was installed via pip in build command)
        // Run yt-dlp to get JSON info
        const command = `yt-dlp -j --no-warnings --no-playlist "${url}"`;
        const { stdout, stderr } = await execPromise(command);
        
        if (stderr && !stderr.includes('WARNING')) {
            console.log('⚠️ yt-dlp warnings:', stderr);
        }

        const info = JSON.parse(stdout);
        console.log(`✅ Extracted: ${info.title} (${info.extractor_key})`);

        const formats = [];

        // Find best video+audio mp4 format
        const videoFormats = info.formats.filter(f => 
            f.vcodec !== 'none' && 
            f.acodec !== 'none' &&
            f.ext === 'mp4'
        );
        
        if (videoFormats.length > 0) {
            const bestVideo = videoFormats.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
            formats.push({
                quality: `${bestVideo.height || 'HD'}p Video + Audio`,
                url: bestVideo.url,
                type: 'MP4',
                size: bestVideo.filesize ? `${(bestVideo.filesize / 1024 / 1024).toFixed(1)} MB` : 'Unknown'
            });
        }

        // Find best audio only format
        const audioFormats = info.formats.filter(f => 
            f.acodec !== 'none' && 
            f.vcodec === 'none' &&
            (f.ext === 'm4a' || f.ext === 'mp3')
        );
        
        if (audioFormats.length > 0) {
            const bestAudio = audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];
            formats.push({
                quality: `Audio Only (${bestAudio.abr || 'High'} kbps)`,
                url: bestAudio.url,
                type: 'MP3',
                size: bestAudio.filesize ? `${(bestAudio.filesize / 1024 / 1024).toFixed(1)} MB` : 'Unknown'
            });
        }

        // If no combined format found, try separate video and audio
        if (formats.length === 0) {
            const videoOnly = info.formats.filter(f => f.vcodec !== 'none' && f.acodec === 'none' && f.ext === 'mp4');
            const audioOnly = info.formats.filter(f => f.acodec !== 'none' && f.vcodec === 'none' && (f.ext === 'm4a' || f.ext === 'mp3'));
            
            if (videoOnly.length > 0 && audioOnly.length > 0) {
                const bestVideo = videoOnly.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
                const bestAudio = audioOnly.sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];
                
                formats.push({
                    quality: `${bestVideo.height || 'HD'}p Video Only`,
                    url: bestVideo.url,
                    type: 'MP4'
                });
                formats.push({
                    quality: `Audio Only (${bestAudio.abr || 'High'} kbps)`,
                    url: bestAudio.url,
                    type: 'MP3'
                });
            }
        }

        if (formats.length === 0) {
            return res.json({ success: false, error: 'No downloadable formats found.' });
        }

        res.json({
            success: true,
            platform: info.extractor_key || 'unknown',
            title: info.title,
            thumbnail: info.thumbnail,
            duration: info.duration ? `${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')}` : null,
            formats
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        
        if (error.message.includes('Video unavailable')) {
            res.json({ success: false, error: 'Video is unavailable (private, deleted, or region-restricted).' });
        } else if (error.message.includes('Unsupported URL')) {
            res.json({ success: false, error: 'This platform is not supported or the URL format is incorrect.' });
        } else {
            res.json({ success: false, error: `Failed to process: ${error.message}` });
        }
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
