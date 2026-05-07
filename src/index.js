const cloudinary = require('cloudinary').v2;
require('dotenv').config();
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
const axios = require('axios');
const { google } = require('googleapis');
const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const client = await auth.getClient();

  const sheets = google.sheets({
    version: 'v4',
    auth: client,
  });

  const spreadsheetId = '1E5l7cXYe3dUnCPBCJF4t2qc3TvGn5GjZe3DG6bRxRtg';

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '動画管理!A1:Z100',
  });

  const rows = response.data.values || [];
  const dataRows = rows.slice(1);

  const videos = dataRows.map(row => ({
    title: row[0] || '',
    status: row[1] || '',
    publishDate: row[2] || '',
    memo: row[3] || '',
  }));

  const countByStatus = status => {
    return videos.filter(video => video.status === status).length;
  };

  const stockCount = videos.filter(video => video.status !== '公開済').length;

  const html = `
  <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        body {
          font-family: sans-serif;
          background: #f3f4f6;
          padding: 40px;
        }

        .report {
          width: 1000px;
          margin: auto;
          background: white;
          border-radius: 24px;
          padding: 40px;
        }

        h1 {
          font-size: 34px;
          margin-bottom: 8px;
        }

        .date {
          color: #666;
          margin-bottom: 30px;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
          margin-bottom: 30px;
        }

        .card {
          background: #f9fafb;
          border-radius: 18px;
          padding: 20px;
          text-align: center;
        }

        .label {
          font-size: 14px;
          color: #666;
          margin-bottom: 10px;
        }

        .number {
          font-size: 38px;
          font-weight: bold;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          border-bottom: 1px solid #e5e7eb;
          padding: 14px;
          text-align: left;
          font-size: 14px;
        }

        th {
          background: #f9fafb;
        }
      </style>
    </head>

    <body>
      <div class="report">
        <h1>YouTube週次レポート</h1>
        <div class="date">報告日：${new Date().toLocaleDateString('ja-JP')}</div>

        <div class="cards">
          <div class="card">
            <div class="label">動画ストック</div>
            <div class="number">${stockCount}</div>
          </div>

          <div class="card">
            <div class="label">編集中</div>
            <div class="number">${countByStatus('編集中')}</div>
          </div>

          <div class="card">
            <div class="label">監修中</div>
            <div class="number">${countByStatus('監修中')}</div>
          </div>

          <div class="card">
            <div class="label">公開待ち</div>
            <div class="number">${countByStatus('公開待ち')}</div>
          </div>

          <div class="card">
            <div class="label">撮影待ち</div>
            <div class="number">${countByStatus('撮影待ち')}</div>
          </div>
        </div>

        <h2>動画一覧</h2>

        <table>
          <thead>
            <tr>
              <th>動画タイトル</th>
              <th>ステータス</th>
              <th>公開予定日</th>
              <th>メモ</th>
            </tr>
          </thead>
          <tbody>
            ${videos.map(video => `
              <tr>
                <td>${video.title}</td>
                <td>${video.status}</td>
                <td>${video.publishDate}</td>
                <td>${video.memo}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </body>
  </html>
  `;

  fs.writeFileSync('reports/report.html', html);

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: {
      width: 1200,
      height: 900,
    },
  });

  await page.goto(`file://${process.cwd()}/reports/report.html`);

  await page.screenshot({
    path: 'reports/report.png',
    fullPage: true,
  });

  await browser.close();
  const uploadResult = await cloudinary.uploader.upload(
    'reports/report.png',
    {
      folder: 'youtube-weekly-report',
    }
  );
  
  const imageUrl = uploadResult.secure_url;
  
  await axios.post(
    'https://api.line.me/v2/bot/message/push',
    {
      to: process.env.LINE_USER_ID,
      messages: [
        {
          type: 'image',
          originalContentUrl: imageUrl,
          previewImageUrl: imageUrl,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  console.log('スプレッドシートの内容を反映したレポート画像を作成しました');
}

main();