const express = require('express');
const compression = require('compression');
const Unblocker = require('unblocker');
const path = require('path');

const app = express();

// Render.com は環境変数 PORT でポート番号を指定してくる
const PORT = process.env.PORT || 3000;

// レスポンスをgzip圧縮 → 転送量が減り体感速度が上がる
app.use(compression());

// トップページ(入力フォーム)を配信。1時間キャッシュさせて再訪問を高速化
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

// /proxy/ 以下に来たリクエストをプロキシする
const unblocker = new Unblocker({
  prefix: '/proxy/',

  // Cookieのdomain/pathをプロキシ経由用に自動で書き換える設定を明示。
  // これによりログイン後のセッションCookieが正しく保存され、
  // ページ遷移してもログイン状態が維持されやすくなる。
  cookieRewrite: true,

  // 一部サイトでリダイレクトが多段になるケースに対応するため上限を緩和
  redirectFollow: true,

  requestMiddleware: [
    // 送信ヘッダを一般的なブラウザに近づけて、
    // 単純なUser-Agentチェックで弾かれるのを防ぐ
    (req) => {
      req.headers['user-agent'] =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
      req.headers['accept-language'] = 'ja,en-US;q=0.9,en;q=0.8';
    }
  ],
  responseMiddleware: []
});

app.use(unblocker);

// 相手サイトの応答が遅い場合にRender側がフリーズしないよう
// タイムアウトを明示的に設定(2分)
const server = app.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
});
server.setTimeout(120000);

// WebSocket を使うサイト(一部の動的サイト)にも対応するため必要
server.on('upgrade', unblocker.onUpgrade);
