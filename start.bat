@echo off
chcp 65001 >nul
set PORT=3001
set VITE_PORT=5173

git fetch --all
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set branch=%%b
git reset --hard origin/%branch%
npm install && npm  run start
