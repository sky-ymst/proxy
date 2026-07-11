const express = require('express');
const compression = require('compression');
const Unblocker = require('unblocker');
const path = require('path');
const http = require('http');
const https = require('https');

const app = express();

// Render.com は環境変数 PORT でポート番号を指定してくる
const PORT = process.env.PORT || 3000;

// 接続の使い回し(keep-alive)を有効化して、毎回のTCP/TLSハンドシェイクを
// 省略できるようにする。特にhttps先への接続が多い場合に効果が大きい。
http.globalAgent = new http.Agent({ keepAlive: true, maxSockets: 64 });
https.globalAgent = new https.Agent({ keepAlive: true, maxSockets: 64 });

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
      // 接続を使い回すよう明示
      req.headers['connection'] = 'keep-alive';

      // ログインフォーム送信時、Origin/RefererがRenderのドメインのままだと
      // 送信先サイトのCSRF対策(送信元ドメインの検証)に弾かれてログインに
      // 失敗することがある。実際の宛先ドメインに書き換えて一致させる。
      if (req.headers.host) {
        const targetOrigin = `https://${req.headers.host}`;
        if (req.headers['origin']) {
          req.headers['origin'] = targetOrigin;
        }
        if (req.headers['referer']) {
          req.headers['referer'] = targetOrigin + '/';
        }
      }
    }
  ],

  responseMiddleware: [
    // 相手サイトが返すキャッシュ関連ヘッダをできるだけ尊重する。
    // これにより「戻る」で表示するときブラウザ自身のキャッシュから
    // 即座に復元されやすくなり、体感速度が上がる。
    (data) => {
      const headers = data.headers;
      if (headers && !headers['cache-control']) {
        headers['cache-control'] = 'private, max-age=60';
      }
    }
  ]
});

app.use(unblocker);

// 相手サイトの応答が遅い場合にRender側がフリーズしないよう
// タイムアウトを明示的に設定(2分)
const server = app.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
});
server.setTimeout(120000);
server.keepAliveTimeout = 65000;

// WebSocket を使うサイト(一部の動的サイト)にも対応するため必要
server.on('upgrade', unblocker.onUpgrade);
