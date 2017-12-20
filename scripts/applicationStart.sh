# service awslogs start
cd /var/www
pm2 start src/server.js --node-args="--harmony"
exit 0
