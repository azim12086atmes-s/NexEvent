#!/bin/bash
# Kill any existing server
pkill -f "next dev" 2>/dev/null
pkill -f "next start" 2>/dev/null
sleep 1

cd /home/z/my-project

# Start the dev server in background
node node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &
disown

echo "Server started, PID: $!"
