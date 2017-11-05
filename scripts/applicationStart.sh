# service awslogs start
#if ( status awslogs-upstart | grep stop ); then
#  echo "Current User:"$USER
#  start awslogs-upstart
#fi
#if ( status nodeApp | grep stop ); then
#  start nodeApp
#fi
pm2 start /var/www/src/server.js --node-args="--harmony"
exit 0
