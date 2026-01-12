@echo off
echo ========================================
echo LLM Logger 診斷測試
echo ========================================
echo.

REM 設定環境變數
set "PROJECT_ROOT=%CD%"
set "DEBUG_LLM=true"

echo 當前目錄: %CD%
echo PROJECT_ROOT: %PROJECT_ROOT%
echo DEBUG_LLM: %DEBUG_LLM%
echo.

echo 執行測試...
node test-llm-logger.js

echo.
echo 檢查 logs 資料夾...
if exist "logs" (
    echo [成功] logs 資料夾已建立
    if exist "logs\llm-debug.log" (
        echo [成功] 日誌檔案已建立
        echo.
        echo 日誌內容：
        type logs\llm-debug.log
    ) else (
        echo [失敗] 日誌檔案不存在
    )
) else (
    echo [失敗] logs 資料夾不存在
)

echo.
pause
