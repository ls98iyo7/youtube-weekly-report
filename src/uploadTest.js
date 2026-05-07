require('dotenv').config();

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadTest() {
  const result = await cloudinary.uploader.upload('reports/report.png', {
    folder: 'youtube-weekly-report',
  });

  console.log('アップロード成功');
  console.log(result.secure_url);
}

uploadTest();