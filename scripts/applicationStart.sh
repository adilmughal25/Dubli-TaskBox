# service awslogs start
if ( status awslogs-upstart | grep stop ); then
  start awslogs-upstart
fi
if ( status nodeApp | grep stop ); then
  start nodeApp
fi
exit 0
