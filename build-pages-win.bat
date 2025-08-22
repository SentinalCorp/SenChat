@echo off
echo Building SenChat for GitHub Pages...
npm run build
copy dist\index.html dist\404.html
echo Done. Push 'dist' folder to gh-pages branch if deploying manually.
