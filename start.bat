git fetch --all
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set branch=%%b
git reset --hard origin/%branch%
npm  run start