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

  // 動画一覧取得
  const videoResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '動画管理!A1:C100',
  });

  // 次回MTG日・次回撮影日取得
  const settingResponse = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [
      '基本設定!B2',
      '集計!B7',
    ],
  });

  const nextMeetingDate =
    settingResponse.data.valueRanges[0].values?.[0]?.[0] || '未設定';

  const nextShootDate =
    settingResponse.data.valueRanges[1].values?.[0]?.[0] || '未設定';

  const rows = videoResponse.data.values || [];

  const dataRows = rows.slice(1);

  const videos = dataRows.map(row => ({
    title: row[0] || '',
    status: row[1] || '',
    publishDate: row[2] || '',
  }));

  const stockCount = videos.filter(video =>
    [
      '公開待ち',
      '監修中',
      '編集中'
    ].includes(video.status)
  ).length;

  if (!fs.existsSync('reports')) {
    fs.mkdirSync('reports');
  }

  const html = `
  <html>
    <head>
      <meta charset="UTF-8" />

      <style>

        *{
          box-sizing:border-box;
        }

        body{
          margin:0;
          padding:40px;
          background:#f5f7fb;
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          color:#111827;
        }

        .container{
          width:1200px;
          margin:auto;
        }

        .header{
          margin-bottom:32px;
        }

        .title{
          font-size:36px;
          font-weight:700;
          margin-bottom:8px;
        }

        .date{
          color:#6b7280;
          font-size:15px;
        }

        .cards{
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:20px;
          margin-bottom:32px;
        }

        .card{
          background:white;
          border-radius:24px;
          padding:28px;
          box-shadow:
            0 4px 20px rgba(0,0,0,0.05);
        }

        .card-label{
          font-size:15px;
          color:#6b7280;
          margin-bottom:12px;
        }

        .card-value{
          font-size:42px;
          font-weight:700;
          line-height:1.2;
        }

        .table-wrap{
          background:white;
          border-radius:24px;
          overflow:hidden;
          box-shadow:
            0 4px 20px rgba(0,0,0,0.05);
        }

        table{
          width:100%;
          border-collapse:collapse;
        }

        th{
          background:#f9fafb;
          text-align:left;
          padding:20px;
          font-size:14px;
          color:#6b7280;
          border-bottom:1px solid #e5e7eb;
        }

        td{
          padding:20px;
          border-bottom:1px solid #f3f4f6;
          font-size:15px;
        }

        tr:last-child td{
          border-bottom:none;
        }

        .published-row{
          opacity:0.45;
        }

        .status{
          display:inline-block;
          padding:8px 14px;
          border-radius:999px;
          font-size:13px;
          font-weight:600;
        }

        .status-企画中{
          background:#ede9fe;
          color:#6d28d9;
        }

        .status-撮影待ち{
          background:#fef3c7;
          color:#b45309;
        }

        .status-編集中{
          background:#dbeafe;
          color:#1d4ed8;
        }

        .status-監修中{
          background:#fde2e2;
          color:#b91c1c;
        }

        .status-公開待ち{
          background:#dcfce7;
          color:#15803d;
        }

        .status-公開済{
          background:#f3f4f6;
          color:#6b7280;
        }

      </style>
    </head>

    <body>

      <div class="container">

        <div class="header">
          <div class="title">
            YouTube週次レポート
          </div>

          <div class="date">
            ${new Date().toLocaleDateString('ja-JP')}
          </div>
        </div>

        <div class="cards">

          <div class="card">
            <div class="card-label">
              動画ストック本数
            </div>

            <div class="card-value">
              ${stockCount}
            </div>
          </div>

          <div class="card">
            <div class="card-label">
              次回MTG日
            </div>

            <div class="card-value">
              ${nextMeetingDate}
            </div>
          </div>

          <div class="card">
            <div class="card-label">
              次回撮影日
            </div>

            <div class="card-value">
              ${nextShootDate}
            </div>
          </div>

        </div>

        <div class="table-wrap">

          <table>

            <thead>
              <tr>
                <th>動画タイトル</th>
                <th>ステータス</th>
                <th>公開予定日</th>
              </tr>
            </thead>

            <tbody>

              ${videos.map(video => `
                <tr class="${video.status === '公開済' ? 'published-row' : ''}">

                  <td>
                    ${video.title}
                  </td>

                  <td>
                    <span class="status status-${video.status}">
                      ${video.status}
                    </span>
                  </td>

                  <td>
                    ${video.publishDate}
                  </td>

                </tr>
              `).join('')}

            </tbody>

          </table>

        </div>

      </div>

    </body>
  </html>
  `;

  fs.writeFileSync('reports/report.html', html);

  const browser = await chromium.launch();

  const page = await browser.newPage({
    viewport: {
      width: 1400,
      height: 1200,
    },
  });

  await page.goto(
    `file://${process.cwd()}/reports/report.html`
  );

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

  console.log('レポート送信完了');
}

main().catch(error => {

  console.error(error);

  if (error.response?.data) {
    console.error(
      JSON.stringify(error.response.data, null, 2)
    );
  }

});
