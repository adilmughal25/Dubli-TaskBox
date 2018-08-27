#!/bin/bash
cd /var/www
pm2 start /var/scripts/process.json
exit 0
