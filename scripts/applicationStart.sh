# service awslogs start
cd /var/www
NODE_ENV=${NODE_ENV} pm2 start src/server.js --node-args="--harmony" 
exit 0
