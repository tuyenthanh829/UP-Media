#!/bin/bash
set -e

# ============================================================
# deploy.sh — Tự động deploy Quiz Test Center trên AZDIGI
# Cách dùng: ./deploy.sh
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/tmp/deploy.log"
PORT="${PORT:-5175}"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"

# --- Màu sắc output (có fallback nếu terminal không hỗ trợ) ---
if [ -t 1 ] && command -v tput &>/dev/null && tput colors &>/dev/null && [ "$(tput colors)" -ge 8 ]; then
    GREEN='\033[0;32m'
    RED='\033[0;31m'
    YELLOW='\033[1;33m'
    BOLD='\033[1m'
    RESET='\033[0m'
else
    GREEN=''; RED=''; YELLOW=''; BOLD=''; RESET=''
fi

log()   { echo -e "$1" | tee -a "$LOG_FILE"; }
ok()    { log "${GREEN}[OK]${RESET}  $1"; }
warn()  { log "${YELLOW}[!!]${RESET}  $1"; }
err()   { log "${RED}[LỖI]${RESET} $1"; }
step()  { log "${BOLD}----> $1${RESET}"; }

# --- Chuẩn bị thư mục log ---
mkdir -p "$SCRIPT_DIR/tmp"
log ""
log "======================================================"
log "  DEPLOY BẮT ĐẦU: $TIMESTAMP"
log "======================================================"

# ----------------------------------------------------------
# BƯỚC 1: Kiểm tra môi trường — đang đứng đúng thư mục chưa
# ----------------------------------------------------------
step "Bước 1/7 — Kiểm tra môi trường..."

REQUIRED_FILES=("server.js" "package.json")
ALL_OK=true
for f in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$SCRIPT_DIR/$f" ]; then
        ALL_OK=false
        break
    fi
done

if [ "$ALL_OK" = false ]; then
    err "Không tìm thấy file app trong thư mục: $SCRIPT_DIR"
    err "Bạn đang đứng sai thư mục, hoặc đây không phải thư mục Quiz Test Center."
    err "Hãy cd đúng thư mục rồi chạy lại: ./deploy.sh"
    log "  DEPLOY THẤT BẠI: $TIMESTAMP"
    exit 1
fi

ok "Thư mục app hợp lệ: $SCRIPT_DIR"

# ----------------------------------------------------------
# BƯỚC 2: Git pull — kéo code mới nhất
# ----------------------------------------------------------
step "Bước 2/7 — Git pull từ remote..."

cd "$SCRIPT_DIR"

BEFORE_HASH="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"

if ! git pull 2>&1 | tee -a "$LOG_FILE"; then
    err "Git pull thất bại. Có thể do conflict hoặc mất kết nối mạng."
    err "Kiểm tra kết nối, hoặc liên hệ người quản lý code để giải quyết conflict."
    log "  DEPLOY THẤT BẠI: $TIMESTAMP"
    exit 1
fi

AFTER_HASH="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
ok "Git pull thành công. Commit hiện tại: $AFTER_HASH"

# ----------------------------------------------------------
# BƯỚC 3: Kiểm tra package.json có thay đổi không
# ----------------------------------------------------------
step "Bước 3/7 — Kiểm tra package.json thay đổi..."

NEED_INSTALL=false
PKG_HASH_FILE="$SCRIPT_DIR/tmp/.pkg_hash"

CURRENT_HASH="$(md5sum "$SCRIPT_DIR/package.json" 2>/dev/null | awk '{print $1}')"
SAVED_HASH="$(cat "$PKG_HASH_FILE" 2>/dev/null || echo '')"

if [ "$CURRENT_HASH" != "$SAVED_HASH" ]; then
    NEED_INSTALL=true
    warn "package.json thay đổi — sẽ chạy npm install."
else
    ok "package.json không đổi — bỏ qua npm install."
fi

# ----------------------------------------------------------
# BƯỚC 4: npm install (chỉ khi cần)
# ----------------------------------------------------------
step "Bước 4/7 — Cài đặt dependencies (nếu cần)..."

if [ "$NEED_INSTALL" = true ]; then
    log "  Đang chạy npm install --production ..."
    if ! npm install --production 2>&1 | tee -a "$LOG_FILE"; then
        err "npm install thất bại. Xem log chi tiết: tail -50 tmp/deploy.log"
        log "  DEPLOY THẤT BẠI: $TIMESTAMP"
        exit 1
    fi
    echo "$CURRENT_HASH" > "$PKG_HASH_FILE"
    ok "npm install hoàn tất."
else
    ok "Bỏ qua npm install."
fi

# ----------------------------------------------------------
# BƯỚC 5: Restart Passenger qua tmp/restart.txt
# ----------------------------------------------------------
step "Bước 5/7 — Restart Passenger (Node.js app)..."

mkdir -p "$SCRIPT_DIR/tmp"
touch "$SCRIPT_DIR/tmp/restart.txt"
ok "Đã touch tmp/restart.txt — Passenger sẽ restart app."

# Kiểm tra .gitignore có entry cho tmp/ chưa
GITIGNORE="$SCRIPT_DIR/.gitignore"
if [ ! -f "$GITIGNORE" ] || ! grep -qxF 'tmp/' "$GITIGNORE" 2>/dev/null; then
    echo 'tmp/' >> "$GITIGNORE"
    warn "Đã thêm 'tmp/' vào .gitignore để tránh commit file tạm."
fi

# ----------------------------------------------------------
# BƯỚC 6: Health check — kiểm tra app đang chạy
# ----------------------------------------------------------
step "Bước 6/7 — Kiểm tra app sau deploy..."

log "  Chờ Passenger khởi động lại (tối đa 15 giây)..."
DEPLOY_OK=false

for i in 1 2 3; do
    sleep 5
    HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/api/admin/me" 2>/dev/null || echo '000')"
    log "  Lần $i — HTTP status: $HTTP_CODE"
    # 200 = thành công; 401/403 = app chạy nhưng cần xác thực (vẫn OK)
    if [[ "$HTTP_CODE" =~ ^(200|401|403)$ ]]; then
        DEPLOY_OK=true
        break
    fi
done

# ----------------------------------------------------------
# BƯỚC 7: Log kết quả
# ----------------------------------------------------------
step "Bước 7/7 — Ghi kết quả deploy..."

FINISH_TIME="$(date '+%Y-%m-%d %H:%M:%S')"

if [ "$DEPLOY_OK" = true ]; then
    ok "App đang chạy bình thường (HTTP $HTTP_CODE)."
    log ""
    log "======================================================"
    log "${GREEN}  ✔ DEPLOY THÀNH CÔNG${RESET}"
    log "  Thời gian:   $FINISH_TIME"
    log "  Commit:      $AFTER_HASH"
    log "  Port:        $PORT"
    log "======================================================"
else
    err "Health check thất bại — app chưa phản hồi trên port $PORT."
    err "Có thể app cần thêm thời gian. Chờ 30 giây rồi thử: curl http://localhost:${PORT}/api/admin/me"
    log ""
    log "======================================================"
    log "${RED}  ✘ DEPLOY THẤT BẠI (health check)${RESET}"
    log "  Thời gian:   $FINISH_TIME"
    log "  Commit:      $AFTER_HASH"
    log "======================================================"
    exit 1
fi
