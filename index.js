const express = require("express");
const fs = require('fs');
const hls = require('hls-server');
const { getStorage, uploadBytes, ref, getDownloadURL, listAll } = require('firebase/storage')
const { getApp, initializeApp } = require('firebase/app')
const ffmpeg = require('fluent-ffmpeg')
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg')
const cors = require('cors')
const { v4: uuidv4 } = require('uuid');
const socketIo = require('socket.io')
ffmpeg.setFfmpegPath(ffmpegInstaller.path)
const multer = require('multer');
const path = require("path");
const { exists, getManifestStream } = require("hls-server/src/fsProvider");
const { Readable, PassThrough } = require("stream");
const { default: axios } = require("axios");
const storage = multer.memoryStorage()
const upload = multer({ storage })
const { createServer } = require("http");

const app = express();

// const firebaseConfig = {
//     apiKey: "YOUR API KEY",
//     authDomain: "DOMAIN",
//     projectId: "ID",
//     storageBucket: "BUCKET",
//     messagingSenderId: "MID",
//     appId: "APID",
//     measurementId: "ID",
//     storageBucket: 'ASD'
// }

const firebaseConfig = {
    apiKey: "AIzaSyDZzyFN1DdmFM6x1LyeMNKmcmH-MazVvtA",
    authDomain: "video-streaming-e4f77.firebaseapp.com",
    projectId: "video-streaming-e4f77",
    storageBucket: "video-streaming-e4f77.appspot.com",
    messagingSenderId: "747815172723",
    appId: "1:747815172723:web:3a24b119fb34e8384dc806",
    measurementId: "G-4SBCR21H6Y",
    storageBucket: 'gs://video-streaming-e4f77.appspot.com'
}


const firebaseApp = initializeApp(firebaseConfig)
const firebaseStorage = getStorage()

app.use(cors({ origin: '*' }))

const server = createServer(app)
const io = socketIo(server, {
    cors: {
        origin: '*'
    }
})


io.on('connection', (socket) => {
    console.log('new client connected')

    socket.on('seek', (time, userSeeked = false) => {
        console.log(time, userSeeked)
        io.emit('seek', { time, userSeeked })
    })

    socket.on('play-client', () => {
        console.log('play emited')
        io.emit('play')
    })

    socket.on('pause', () => {
        console.log('stop emited')
        io.emit('pause')
    })
})


const generateUniqueFileName = (extension = '') => {
    const uniqueId = uuidv4();
    return `${uniqueId}${extension}`;
};

app.post('/upload', upload.single('file'), (req, res) => {
    try {
        ffmpeg.setFfmpegPath(ffmpegInstaller.path)
        const stream = Readable.from(req.file.buffer)
        // const tempDir = 
        const segmentBasePath = 'hls-segments/'
        // const testStream = fs.createWriteStream('hls-segments/output.m3u8', 'application/vnd.apple.mpegurl')
        // const segmentStream = uploadStreamToFirebase(segmentBasePath + 'index.m3u8', 'application/vnd.apple.mpegurl');
        const filename = generateUniqueFileName()
        const command = ffmpeg().input(stream).addOptions([
            '-preset slow',
            '-profile:v high',
            '-level 4.0',
            '-start_number 0',
            '-hls_time 10',
            '-hls_list_size 0',
            '-c:v h264',
            '-filter:v fps\=24000/1001',
            '-b:v 8000K',
            '-maxrate 12000K',
            '-bufsize 20000k',
            '-crf 20',
            '-f hls',
            '-hls_playlist_type vod',
            // `-hls_base_url https://firebasestorage.googleapis.com/v0/b/video-streaming-e4f77.appspot.com/o/${encodeURIComponent(`${filename}/`)}`,
        ])
            .on('end', async () => {
                const outputPath = `${__dirname}/videos`
                // const m3u8Path = path.join(outputPath, 'output.m3u8');
                let playlistContent = fs.readdirSync(outputPath);
                const parentFileRef = ref(firebaseStorage, `${filename}/output.m3u8`)
                // const segmentFiles = fs.readdirSync(outputPath).filter(file => file.endsWith('.ts'));
                for (const file of playlistContent) {
                    const localFile = fs.readFileSync(path.join(outputPath, file))
                    const fileRef = ref(firebaseStorage, `${filename}/${file}`)
                    await uploadBytes(fileRef, localFile)
                    fs.unlink(path.join(outputPath, file), (err) => {
                        if (err) throw err
                        console.log('file deleted')
                    })
                }
                return res.send(parentFileRef.fullPath)
            }).
            on('error', (err) => {
                console.log(err)
                throw new Error(err)
            })

        command.output('videos/output.m3u8')
            .format('hls')
            .run();
    } catch (error) {
        console.log(error)
        return res.send(error)
    }
})

app.get('/test', (req, res) => {
    return res.send('success')
})


app.get('/', (req, res) => {
    console.log('client connected frontend')
    return res.status(200).sendFile(`${__dirname}/index.html`)
})

app.get('/download', async (req, res) => {
    try {
        // console.log(download)
        const pathReference = ref(firebaseStorage, '8ba1df9d-a786-45ff-a9d4-86481a59fd43')
        listAll(pathReference).then((res) => {
            res.prefixes.forEach((folderRef) => {
                const reference = ref(firebaseStorage, folderRef.fullPath)
                console.log(reference)
            });
            res.items.forEach(async (itemRef) => {
                console.log(itemRef.fullPath)
                const reference = ref(firebaseStorage, itemRef.fullPath)
                const link = await getDownloadURL(reference)
                // const writer = fs.createWriteStream(path.join(__dirname, 'videos', itemRef.fullPath.split('/')[1]), 'utf-8')
                const data = await axios({
                    method: 'get',
                    url: link,
                    responseType: 'stream'
                })
                // console.log(data)
                // data.data.pipe(writer)
                // return new Promise((resolve, reject) => {
                //     writer.on('finish', resolve);
                //     writer.on('error', reject);
                // });
            });
        })
    } catch (error) {
        console.log(error)
    }
})


const downloadFiles = async (list) => {
    try {
        list.items.forEach(async (itemRef) => {
            const reference = ref(firebaseStorage, itemRef.fullPath)
            const link = await getDownloadURL(reference)
            // console.log(link)
            const writer = fs.createWriteStream(path.join(__dirname, 'videos', itemRef.fullPath.split('/')[1]), 'utf-8')
            const data = await axios({
                method: 'get',
                url: link,
                responseType: 'stream'
            })
            // console.log(data)
            data.data.pipe(writer)
            return new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        });
    } catch (error) {
        console.log(error)
    }
}

new hls(server, {
    provider: {
        exists: async (req, cb) => {
            const ext = req.url.split('.').pop();
            if (ext !== 'm3u8' && ext !== 'ts') {
                return cb(null, true);
            }
            const pathReference = ref(firebaseStorage, req.url.split('/')[1])
            const list = await listAll(pathReference)
            if (list.items.length < 0) {
                cb(null, false)
            }
            downloadFiles(list)
            cb(null, true)

            // const storageRef = 


            // const link = getDownloadURL(pathReference).then((url) => {
            //     console.log(url)
            // })
            // fs.access(__dirname + req.url, fs.constants.F_OK, function (err) {
            //     if (err) {
            //         console.log('File not exist');
            //         return cb(null, false);
            //     }
            //     cb(null, true);
            // });
        },
        getManifestStream: async (req, cb) => {
            // const stream = fs.createReadStream(__dirname + req.url)
            const stream = fs.createReadStream(path.join(__dirname, 'videos', req.url.split('/')[2]))
            // console.log(stream)
            cb(null, stream);
        },
        getSegmentStream: async (req, cb) => {
            const stream = fs.createReadStream(path.join(__dirname, 'videos', req.url.split('/')[2]))
            cb(null, stream);
        }
    }
});


server.listen(3000, () => {
    console.log('listening on port 3000')
})



