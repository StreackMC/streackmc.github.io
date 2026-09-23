#!/bin/bash
# 视频压缩脚本：输出 MP4 (H.265) 和 WebM (AV1)，无音频，为流式播放优化
# 用法: ./compressVideo.bash <输入文件> [高度] [宽度]

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "用法: $0 <输入文件> [高度] [宽度]"
    echo "  无缩放参数: 保持原始尺寸"
    echo "  一个参数:   等比高度缩放"
    echo "  两个参数:   拉伸缩放 (宽度 高度)"
    exit 1
fi

INPUT="$1"
SCALE_ARG1="${2:-}"
SCALE_ARG2="${3:-}"

if [ ! -f "$INPUT" ]; then
    echo "错误: 文件不存在: $INPUT" >&2
    exit 1
fi

if ! command -v ffmpeg &> /dev/null; then
    echo "错误: 未找到 ffmpeg，请先安装。" >&2
    exit 1
fi

SCALE_FILTER=""
if [ -n "$SCALE_ARG1" ] && [ -z "$SCALE_ARG2" ]; then
    SCALE_FILTER="scale=-2:${SCALE_ARG1}"
elif [ -n "$SCALE_ARG1" ] && [ -n "$SCALE_ARG2" ]; then
    SCALE_FILTER="scale=${SCALE_ARG1}:${SCALE_ARG2}"
fi

BASENAME="${INPUT%.*}"
MP4_OUTPUT="${BASENAME}_h265.mp4"
WEBM_OUTPUT="${BASENAME}_av1.webm"

get_size() {
    if stat -f%z "$1" >/dev/null 2>&1; then
        stat -f%z "$1"
    else
        stat -c%s "$1"
    fi
}

INPUT_SIZE=$(get_size "$INPUT")

echo "开始压缩: $INPUT"
if [ -n "$SCALE_FILTER" ]; then
    echo "缩放滤镜: $SCALE_FILTER"
else
    echo "缩放滤镜: 无（保持原始尺寸）"
fi
echo ""

# ---------- 截取首帧 ----------
THUMB_OUTPUT="${BASENAME}_thumb.jpg"
echo "正在截取首帧..."
if [ -n "$SCALE_FILTER" ]; then
    ffmpeg -y -i "$INPUT" -vf "${SCALE_FILTER},select=eq(n\,0)" \
        -frames:v 1 -q:v 2 \
        "$THUMB_OUTPUT"
else
    ffmpeg -y -i "$INPUT" -vf "select=eq(n\,0)" \
        -frames:v 1 -q:v 2 \
        "$THUMB_OUTPUT"
fi

# ---------- 生成 MP4 (H.265) ----------
echo "正在生成 MP4 (H.265)..."
if [ -n "$SCALE_FILTER" ]; then
    ffmpeg -y -i "$INPUT" -vf "$SCALE_FILTER" \
        -an \
        -c:v libx265 -crf 28 -preset medium \
        -profile:v main -tag:v hvc1 \
        -pix_fmt yuv420p \
        -movflags +faststart \
        "$MP4_OUTPUT"
else
    ffmpeg -y -i "$INPUT" \
        -an \
        -c:v libx265 -crf 28 -preset medium \
        -profile:v main -tag:v hvc1 \
        -pix_fmt yuv420p \
        -movflags +faststart \
        "$MP4_OUTPUT"
fi

# ---------- 生成 WebM (AV1) ----------
echo "正在生成 WebM (AV1)..."
if [ -n "$SCALE_FILTER" ]; then
    ffmpeg -y -i "$INPUT" -vf "$SCALE_FILTER" \
        -an \
        -c:v libsvtav1 -crf 40 -preset 6 \
        -svtav1-params tune=1 \
        -pix_fmt yuv420p \
        "$WEBM_OUTPUT"
else
    ffmpeg -y -i "$INPUT" \
        -an \
        -c:v libsvtav1 -crf 40 -preset 6 \
        -svtav1-params tune=1 \
        -pix_fmt yuv420p \
        "$WEBM_OUTPUT"
fi

# ---------- 压缩报告 ----------
format_size() {
    local bytes=$1
    if [ "$bytes" -ge 1073741824 ]; then
        awk "BEGIN {printf \"%.2f GiB\", $bytes/1073741824}"
    elif [ "$bytes" -ge 1048576 ]; then
        awk "BEGIN {printf \"%.2f MiB\", $bytes/1048576}"
    elif [ "$bytes" -ge 1024 ]; then
        awk "BEGIN {printf \"%.2f KiB\", $bytes/1024}"
    else
        echo "$bytes bytes"
    fi
}

MP4_SIZE=$(get_size "$MP4_OUTPUT")
WEBM_SIZE=$(get_size "$WEBM_OUTPUT")
THUMB_SIZE=$(get_size "$THUMB_OUTPUT")

MP4_RATIO=$(awk "BEGIN {printf \"%.2f%%\", ($MP4_SIZE / $INPUT_SIZE) * 100}")
WEBM_RATIO=$(awk "BEGIN {printf \"%.2f%%\", ($WEBM_SIZE / $INPUT_SIZE) * 100}")

echo ""
echo "========== 压缩报告 =========="
echo "输入文件: $INPUT"
echo "输入大小: $(format_size $INPUT_SIZE)"
echo ""
echo "MP4 (H.265):  $MP4_OUTPUT"
echo "  输出大小: $(format_size $MP4_SIZE)"
echo "  压缩率:   $MP4_RATIO  (输出/输入)"
echo ""
echo "WebM (AV1):   $WEBM_OUTPUT"
echo "  输出大小: $(format_size $WEBM_SIZE)"
echo "  压缩率:   $WEBM_RATIO  (输出/输入)"
echo ""
echo "首帧截图:     $THUMB_OUTPUT"
echo "  文件大小: $(format_size $THUMB_SIZE)"
echo ""
echo "完成。"