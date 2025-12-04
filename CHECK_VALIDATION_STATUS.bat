@echo off
REM Quick status check for ID validation

echo.
echo ====================================================
echo ID Validation Status Check
echo ====================================================
echo.

REM Check if results file exists
if exist "C:\Users\Benjamin\Desktop\ID_VALIDATION_RESULTS.txt" (
    echo [SUCCESS] Results file found!
    echo.
    echo File: C:\Users\Benjamin\Desktop\ID_VALIDATION_RESULTS.txt
    echo.
    dir /S "C:\Users\Benjamin\Desktop\ID_VALIDATION_RESULTS.txt"
    echo.
    echo First 20 lines:
    echo ------
    for /F "tokens=*" %%A in ('type "C:\Users\Benjamin\Desktop\ID_VALIDATION_RESULTS.txt" ^| findstr /C:"#" /C:"->"') do (
        echo %%A
    )
    echo.
    echo Opening file...
    start notepad "C:\Users\Benjamin\Desktop\ID_VALIDATION_RESULTS.txt"
) else (
    echo [PROCESSING] Results file not found yet.
    echo.
    echo Validation is still in progress.
    echo Expected completion: ~5-10 more minutes
    echo.
    echo Check process:
    tasklist | findstr python
    echo.
    echo Run this script again in a few minutes to check status.
)

echo.
echo ====================================================
