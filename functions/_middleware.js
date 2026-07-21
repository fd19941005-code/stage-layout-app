// Cloudflare Pages Functions: サイト全体をBasic認証で保護する。
// Pagesプロジェクトの環境変数 BETA_USER / BETA_PASSWORD が未設定の場合は全リクエストを拒否する。
export async function onRequest(context) {
  const { request, env, next } = context;
  const expectedUser = env.BETA_USER;
  const expectedPassword = env.BETA_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return new Response("Beta auth is not configured (BETA_USER/BETA_PASSWORD missing)", {
      status: 500,
    });
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Basic ")) {
    const decoded = atob(authHeader.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");
    const user = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);
    if (user === expectedUser && password === expectedPassword) {
      return next();
    }
  }

  return new Response("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="stage-layout-app beta"' },
  });
}
