## this is the 'default' one, but we use one that has
if ( service awslogs status | grep running ); then
  service awslogs stop
fi
if ( status awslogs-upstart | grep start ); then
  stop awslogs-upstart
fi
if ( status nodeApp | grep start ); then
  stop nodeApp
fi
exit 0
