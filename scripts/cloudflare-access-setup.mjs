#!/usr/bin/env node
// Cloudflare Access (Zero Trust) を stage-layout-app.pages.dev に設定する冪等スクリプト。
//
// 使い方:
//   計画のみ表示(何も変更しない):
//     CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=xxx ACCESS_ALLOWED_EMAILS=a@x.com,b@y.com \
//       node scripts/cloudflare-access-setup.mjs
//
//   実際に適用する:
//     ... node scripts/cloudflare-access-setup.mjs --apply
//
// 許可メールアドレスは環境変数 ACCESS_ALLOWED_EMAILS(カンマ区切り)か
// 実行時引数 --emails=a@x.com,b@y.com のどちらでも渡せる(引数が優先)。

const API_BASE = "https://api.cloudflare.com/client/v4";

const APP_NAME = "舞台配置図アプリ β";
const APP_DOMAIN = "stage-layout-app.pages.dev";
const APP_SESSION_DURATION = "24h";
const POLICY_NAME = "βテスター";
const OTP_IDP_NAME = "One-time PIN login";

function parseArgs(argv) {
  const args = { apply: false, emails: null };
  for (const arg of argv) {
    if (arg === "--apply") args.apply = true;
    else if (arg.startsWith("--emails=")) args.emails = arg.slice("--emails=".length);
  }
  return args;
}

function resolveEmails(cliEmails) {
  const raw = cliEmails ?? process.env.ACCESS_ALLOWED_EMAILS ?? "";
  const emails = raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (emails.length === 0) {
    throw new Error(
      "許可メールアドレスが指定されていません。環境変数 ACCESS_ALLOWED_EMAILS か --emails=a@x.com,b@y.com を指定してください。"
    );
  }
  return emails;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません。`);
  }
  return value;
}

async function cf(token, method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(
      `Cloudflare API error (${method} ${path}): ${JSON.stringify(json.errors ?? json)}`
    );
  }
  return json.result;
}

function sameEmailSet(includeRules, emails) {
  const existing = (includeRules ?? [])
    .map((rule) => rule.email?.email)
    .filter(Boolean)
    .sort();
  return JSON.stringify(existing) === JSON.stringify([...emails].sort());
}

function sameAllowedIdps(existing, desired) {
  const a = [...(existing ?? [])].sort();
  const b = [...(desired ?? [])].sort();
  return JSON.stringify(a) === JSON.stringify(b);
}

async function ensureOtpIdentityProvider(token, accountId, apply) {
  const idps = await cf(token, "GET", `/accounts/${accountId}/access/identity_providers`);
  const existing = idps.find((idp) => idp.type === "onetimepin");
  if (existing) {
    console.log(`[IdP] One-time PIN は既に存在します (id: ${existing.id})`);
    return existing.id;
  }

  console.log(`[IdP] 作成予定: name="${OTP_IDP_NAME}", type=onetimepin`);
  if (!apply) return null;

  const created = await cf(token, "POST", `/accounts/${accountId}/access/identity_providers`, {
    name: OTP_IDP_NAME,
    type: "onetimepin",
    config: {},
  });
  console.log(`[IdP] 作成しました (id: ${created.id})`);
  return created.id;
}

async function planAndApplyApp(token, accountId, otpIdpId, apply) {
  const apps = await cf(token, "GET", `/accounts/${accountId}/access/apps?per_page=100`);
  const existing = apps.find((app) => app.name === APP_NAME);

  const desired = {
    name: APP_NAME,
    type: "self_hosted",
    domain: APP_DOMAIN,
    session_duration: APP_SESSION_DURATION,
    allowed_idps: otpIdpId ? [otpIdpId] : existing?.allowed_idps ?? [],
  };

  if (!existing) {
    console.log(`[Application] 作成予定:`);
    console.log(JSON.stringify(desired, null, 2));
    if (!apply) return null;
    const created = await cf(token, "POST", `/accounts/${accountId}/access/apps`, desired);
    console.log(`[Application] 作成しました (id: ${created.id})`);
    return created.id;
  }

  const needsUpdate =
    existing.domain !== desired.domain ||
    existing.session_duration !== desired.session_duration ||
    !sameAllowedIdps(existing.allowed_idps, desired.allowed_idps);

  if (!needsUpdate) {
    console.log(`[Application] 既存設定のまま変更不要です (id: ${existing.id})`);
    return existing.id;
  }

  console.log(`[Application] 更新予定 (id: ${existing.id}):`);
  console.log(`  domain: ${existing.domain} -> ${desired.domain}`);
  console.log(`  session_duration: ${existing.session_duration} -> ${desired.session_duration}`);
  console.log(
    `  allowed_idps: ${JSON.stringify(existing.allowed_idps)} -> ${JSON.stringify(desired.allowed_idps)}`
  );
  if (!apply) return existing.id;

  const { id, aud, created_at, updated_at, ...rest } = existing;
  await cf(token, "PUT", `/accounts/${accountId}/access/apps/${id}`, { ...rest, ...desired });
  console.log(`[Application] 更新しました (id: ${id})`);
  return id;
}

async function planAndApplyPolicy(token, accountId, appId, emails, apply) {
  if (!appId) {
    console.log(`[Policy] Application未作成のため計画のみ表示します。`);
  }

  const desiredInclude = emails.map((email) => ({ email: { email } }));

  if (!appId) {
    console.log(`[Policy] 作成予定: name="${POLICY_NAME}", decision=allow`);
    console.log(`  include: ${JSON.stringify(desiredInclude)}`);
    return;
  }

  const policies = await cf(token, "GET", `/accounts/${accountId}/access/apps/${appId}/policies`);
  const existing = policies.find((policy) => policy.name === POLICY_NAME);

  if (!existing) {
    console.log(`[Policy] 作成予定: name="${POLICY_NAME}", decision=allow`);
    console.log(`  include: ${JSON.stringify(desiredInclude)}`);
    if (!apply) return;
    const created = await cf(
      token,
      "POST",
      `/accounts/${accountId}/access/apps/${appId}/policies`,
      { name: POLICY_NAME, decision: "allow", include: desiredInclude }
    );
    console.log(`[Policy] 作成しました (id: ${created.id})`);
    return;
  }

  if (existing.decision === "allow" && sameEmailSet(existing.include, emails)) {
    console.log(`[Policy] 既存設定のまま変更不要です (id: ${existing.id})`);
    return;
  }

  console.log(`[Policy] 更新予定 (id: ${existing.id}):`);
  console.log(`  include: ${JSON.stringify(existing.include)} -> ${JSON.stringify(desiredInclude)}`);
  if (!apply) return;

  const { id, created_at, updated_at, ...rest } = existing;
  await cf(token, "PUT", `/accounts/${accountId}/access/apps/${appId}/policies/${id}`, {
    ...rest,
    decision: "allow",
    include: desiredInclude,
  });
  console.log(`[Policy] 更新しました (id: ${id})`);
}

async function verify(token, accountId) {
  console.log("\n=== 検証: 現在の設定を再取得 ===");
  const apps = await cf(token, "GET", `/accounts/${accountId}/access/apps?per_page=100`);
  const app = apps.find((a) => a.name === APP_NAME);
  if (!app) {
    console.log("Application が見つかりません。");
    return;
  }
  console.log(
    `Application: name=${app.name}, domain=${app.domain}, session_duration=${app.session_duration}, allowed_idps=${JSON.stringify(app.allowed_idps)}`
  );

  const policies = await cf(token, "GET", `/accounts/${accountId}/access/apps/${app.id}/policies`);
  const policy = policies.find((p) => p.name === POLICY_NAME);
  if (!policy) {
    console.log("Policy が見つかりません。");
    return;
  }
  const emails = (policy.include ?? []).map((r) => r.email?.email).filter(Boolean);
  console.log(`Policy: name=${policy.name}, decision=${policy.decision}, emails=${JSON.stringify(emails)}`);
}

async function main() {
  const { apply, emails: cliEmails } = parseArgs(process.argv.slice(2));
  const token = requireEnv("CLOUDFLARE_API_TOKEN");
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const emails = resolveEmails(cliEmails);

  console.log(`モード: ${apply ? "APPLY(変更を実行します)" : "PLAN(表示のみ、変更なし)"}`);
  console.log(`許可メールアドレス: ${emails.join(", ")}\n`);

  const otpIdpId = await ensureOtpIdentityProvider(token, accountId, apply);
  const appId = await planAndApplyApp(token, accountId, otpIdpId, apply);
  await planAndApplyPolicy(token, accountId, appId, emails, apply);

  if (apply) {
    await verify(token, accountId);
  } else {
    console.log("\n--apply を付けずに実行したため、変更は行っていません。");
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
