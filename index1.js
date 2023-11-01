const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const port = 3000;

app.use(express.static('public'));

const uploadDirectory = 'uploads';
const outputDirectory = 'output';
let thumbnailDirectory; // Define thumbnailDirectory outside the route handler

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory);
}

if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage });

app.post('/upload', upload.single('videoFile'), (req, res) => {
    const videoFile = req.file;

    if (!videoFile) {
        return res.status(400).send('No video file uploaded.');
    }

    const videoPath = path.join(uploadDirectory, videoFile.originalname);
    thumbnailDirectory = path.join(outputDirectory, 'thumbnails'); // Assign the value

    if (!fs.existsSync(thumbnailDirectory)) {
        fs.mkdirSync(thumbnailDirectory);
    }

    fs.rename(videoFile.path, videoPath, (err) => {
        if (err) {
            return res.status(500).send('Error moving the video file.');
        }

        const numSegments = 5;
        let segmentDuration = 0;

        // Get the duration of the input video
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                console.error('Error getting video duration:', err);
                res.status(500).send('Error processing the video.');
                return;
            }

            const duration = metadata.format.duration;
            segmentDuration = duration / numSegments;

            // Split the video into equal parts
            for (let i = 1; i <= numSegments; i++) {
                const startTime = (i - 1) * segmentDuration;
                const outputSegmentPath = path.join(outputDirectory, `part${i}.mp4`);

                ffmpeg(videoPath)
                    .inputOptions([`-ss ${startTime}`])
                    .outputOptions([`-t ${segmentDuration}`])
                    .on('end', () => {
                        captureThumbnail(outputSegmentPath, i);
                        if (i === numSegments) {
                            res.send('Video uploaded, divided, and thumbnails generated.');
                        }
                    })
                    .on('error', (err) => {
                        console.error('Error splitting video:', err);
                        res.status(500).send('Error processing the video.');
                    })
                    .output(outputSegmentPath)
                    .run();
            }
        });
    });
});

function captureThumbnail(segmentPath, segmentNumber) {
    

    ffmpeg(segmentPath)
        .screenshots({
            count: 1,
            folder: thumbnailDirectory,
            filename: `thumbnail${segmentNumber}.png`,
        })
        .on('end', () => {
            console.log(`Thumbnail ${segmentNumber} captured`);
        })
        .on('error', (err) => {
            console.error('Error capturing thumbnail:', err);
        });
}

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
