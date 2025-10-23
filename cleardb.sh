#!/bin/bash

# 清空数据库和项目脚本

echo "======================================"
echo "清空数据库和项目"
echo "======================================"

# 数据库路径
DB_PATH="$HOME/Library/Application Support/read-translate/database/app.db"

# 项目目录路径
PROJECTS_DIR="./projects"

# 检查数据库是否存在
if [ -f "$DB_PATH" ]; then
    echo "📁 找到数据库: $DB_PATH"

    # 清空 segments 表
    echo "🗑️  清空 segments 表..."
    sqlite3 "$DB_PATH" "DELETE FROM segments;"

    # 清空 projects 表
    echo "🗑️  清空 projects 表..."
    sqlite3 "$DB_PATH" "DELETE FROM projects;"

    echo "✅ 数据库清空完成"
else
    echo "⚠️  数据库不存在: $DB_PATH"
fi

# 检查项目目录是否存在
if [ -d "$PROJECTS_DIR" ]; then
    echo "📁 找到项目目录: $PROJECTS_DIR"

    # 计算项目数量
    project_count=$(find "$PROJECTS_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l | xargs)

    if [ "$project_count" -gt 0 ]; then
        echo "🗑️  删除 $project_count 个项目..."
        rm -rf "$PROJECTS_DIR"/*
        echo "✅ 项目目录清空完成"
    else
        echo "ℹ️  项目目录为空，无需清理"
    fi
else
    echo "⚠️  项目目录不存在: $PROJECTS_DIR"
fi

echo "======================================"
echo "✅ 清理完成！"
echo "======================================"
