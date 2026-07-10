const express = require('express');
const Unblocker = require('unblocker');
const path = require('path');

const app = express();

// Render.com は環境変数 PORT でポート番号を指定してくる
const PORT = process.env.PORT || 3000;

// トップページ(入力フォーム)を配信
app.use(express.static(path.join(__dirname, 'public')));

// /proxy/ 以下に来たリクエストをプロキシする
// unblocker が HTML / CSS / JS 内のリンクを自動的に
// /proxy/https://... の形に書き換えてくれる
const unblocker = new Unblocker({
  prefix: '/proxy/',
  requestMiddleware: [],
  responseMiddleware: []
});

app.use(unblocker);

const server = app.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
});

// WebSocket を使うサイト(一部の動的サイト)にも対応するため必要
server.on('upgrade', unblocker.onUpgrade);
