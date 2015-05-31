cp -R /var/www/node_modules/xml2json /tmp/xml2json
rm -rf /var/www/node_modules 2> /dev/null
cp -R /tmp/xml2json /var/www/node_modules/xml2json 

rm -rf /var/www/src 2> /dev/null
rm /var/www/package.json 2> /dev/null
rm /var/www/logs/app.log 2> /dev/null
touch /var/www/logs/app.log

NODE_ENV=stage
APP_NAME=taskbox
APP_SCOPE=private

#save userdata properties
touch /var/scripts/env.prop
sh -c "cat > /var/scripts/env.prop" << EOF
NODE_ENV=${NODE_ENV}
APP_NAME=${APP_NAME}
APP_SCOPE=${APP_SCOPE}
EOF

#save userdata json
touch /var/scripts/env.json
sh -c "cat > /var/scripts/env.json" << EOF
{
  "NODE_ENV":"${NODE_ENV}",
  "APP_NAME":"${APP_NAME}",
  "APP_SCOPE":"${APP_SCOPE}",
}
EOF

#AWS Cloudwatch Logs
service awslogs stop
touch /etc/awslogs/awslogs.conf
sh -c "cat > /etc/awslogs/awslogs.conf" << EOF
[general]
state_file = /var/lib/awslogs/agent-state

[/var/log/messages]
datetime_format = %b %d %H:%M:%S
file = /var/log/messages
buffer_duration = 5000
log_stream_name = {instance_id}
initial_position = start_of_file
log_group_name = ${NODE_ENV}_upstart

[/var/www/logs]
log_stream_name = {instance_id}
log_group_name = ${NODE_ENV}_${APP_NAME}
file = /var/www/logs/*
EOF

#UPSTART section and conf
touch /etc/init/nodeApp.conf
sh -c "cat > /etc/init/nodeApp.conf" << EOF
description "Upstart conf for Node.js App"
author "Nick Sharp"
chdir /var/www/
start on (runlevel [345] and started network)
stop on (runlevel [!345] or stopping network)
respawn
respawn limit 10 5

pre-start script
    mkfifo applogpipe
    chmod 0666 applogpipe
    logrotate-stream /var/www/logs/app.log --keep 3 --size 50m < applogpipe &
end script
script
    exec node --harmony /var/www/src/server.js ${NODE_ENV} >> applogpipe 2>&1
end script
post-stop script
    rm applogpipe
end script
EOF
exit 0