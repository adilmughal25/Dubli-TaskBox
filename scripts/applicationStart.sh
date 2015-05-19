service awslogs start
if ( status nodeApp | grep stop ); then
  start nodeApp
fi
exit 0