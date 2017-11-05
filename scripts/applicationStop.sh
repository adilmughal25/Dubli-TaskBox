## this is the 'default' one, but we use one that has
#if ( service awslogs status | grep running ); then
#  service awslogs stop
#fi
#if ( status awslogs-upstart | grep running ); then
#  stop awslogs-upstart
#fi
#if ( status nodeApp | grep start ); then
#  stop nodeApp
#fi
pm2 stop all
exit 0
