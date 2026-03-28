@echo off
echo Creating Closer Extension Icons...
echo.
echo Please follow these steps:
echo 1. Open generate_closer_icons.html in your browser
echo 2. Download all three icon sizes (16px, 48px, 128px)
echo 3. Save them as icon16.png, icon48.png, icon128.png
echo 4. Place them in the closer-extension folder
echo 5. Then load the extension in Chrome
echo.
echo Opening icon generator...
start generate_closer_icons.html
echo.
echo After downloading the icons, press any key to continue...
pause
echo.
echo Checking for icon files...
if exist "closer-extension\icon16.png" (
    echo ✅ icon16.png found
) else (
    echo ❌ icon16.png missing
)
if exist "closer-extension\icon48.png" (
    echo ✅ icon48.png found
) else (
    echo ❌ icon48.png missing
)
if exist "closer-extension\icon128.png" (
    echo ✅ icon128.png found
) else (
    echo ❌ icon128.png missing
)
echo.
echo If all icons are present, you can now load the closer extension in Chrome!
pause

