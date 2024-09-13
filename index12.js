const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const hls = require('hls-server');
const fs = require('fs');
const path = require('path')
// const { path } = require('@ffmpeg-installer/ffmpeg');

const app = express();


app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "http://localhost:4200");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
})
// Use CORS middleware
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use(cors({
    origin: 'http://localhost:4200',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.static(path.join(__dirname, 'videos')));


app.get('/', (req, res) => {
    console.log('client connected frontend')
    return res.status(200).sendFile(`${__dirname}/index.html`)
})

// Create HTTP server using Express app
const server = createServer(app);

// Initialize HLS server
new hls(server, {
    provider: {
        // Example provider configuration
        exists: (req, cb) => {
            const ext = req.url.split('.').pop();
            if (ext !== 'm3u8' && ext !== 'ts') {
                return cb(null, true);
            }
            fs.access(__dirname + '/videos/output.m3u8', fs.constants.F_OK, function (err) {
                if (err) {
                    console.log('File not exist');
                    return cb(null, false);
                }
                cb(null, true);
            });
            // Implement exists function as needed
        },
        getManifestStream: (req, cb) => {
            const stream = fs.createReadStream(path.join(__dirname, 'videos', 'output.m3u8'))
            // console.log(stream)
            cb(null, stream);
            // Implement getManifestStream function as needed
        },
        getSegmentStream: (req, cb) => {
            const stream = fs.createReadStream(path.join(__dirname, 'videos', 'output0.ts'))
            // console.log(stream)
            cb(null, stream);
            // Implement getSegmentStream function as needed
        }
    }
});

// Other routes and server configurations...

// Start server
server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
