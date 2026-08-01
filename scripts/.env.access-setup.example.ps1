# このファイルをコピーして scripts/.env.access-setup.ps1 を作り、実際の値を入れてください。
# scripts/.env.access-setup.ps1 は .gitignore 済みでコミットされません。
#
#   Copy-Item scripts/.env.access-setup.example.ps1 scripts/.env.access-setup.ps1
#
# Cloudflare Dashboard > My Profile > API Tokens で発行するトークンには
# 以下の権限が必要です:
#   - Access: Apps and Policies Write
#   - Access: Organizations, Identity Providers, and Groups Write

$env:CLOUDFLARE_API_TOKEN = "ここにAPIトークンを貼り付け"
$env:CLOUDFLARE_ACCOUNT_ID = "ここにAccount IDを貼り付け"
$env:ACCESS_ALLOWED_EMAILS = "tester1@example.com,tester2@example.com"
