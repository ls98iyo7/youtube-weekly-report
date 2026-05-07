require('dotenv').config();
const axios = require('axios');

async function sendTest() {

  await axios.post(
    'https://api.line.me/v2/bot/message/push',
    {
      to: process.env.LINE_USER_ID,
      messages: [
        {
          type: 'text',
          text: 'YouTube週次レポート送信テストです',
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

  console.log('LINE送信成功');
}

sendTest();