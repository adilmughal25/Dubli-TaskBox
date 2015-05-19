if ( service awslogs status | grep running ); then
  service awslogs stop
fi
if ( status nodeApp | grep start ); then
  stop nodeApp
fi
exit 0