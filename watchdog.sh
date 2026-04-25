#!/bin/bash
while true; do
  cd /home/z/my-project
  node node_modules/.bin/next dev -p 3000
  echo "Server died at $(date). Restarting in 3 seconds..." >> /tmp/watchdog.log
  sleep 3
done
