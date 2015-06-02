#!/bin/bash

WWW_ROOT=/var/www
INSTANCE_ID=$(ec2-metadata -i | cut -d' ' -f2)
REGION=$(curl -s http://169.254.169.254/latest/dynamic/instance-identity/document | grep region | cut -d'"' -f4)
NODE_ENV=$(aws ec2 describe-tags --filters "Name=resource-id,Values=${INSTANCE_ID}" "Name=key,Values=env" --region ${REGION} --output text | cut -f5)
APP_NAME=$(aws ec2 describe-tags --filters "Name=resource-id,Values=${INSTANCE_ID}" "Name=key,Values=app" --region ${REGION} --output text | cut -f5)
APP_SCOPE=$(aws ec2 describe-tags --filters "Name=resource-id,Values=${INSTANCE_ID}" "Name=key,Values=scope" --region ${REGION} --output text | cut -f5)

rm -rf ${WWW_ROOT}/* 2> /dev/null

#AWS Cloudwatch Logs
service awslogs stop

#save userdata properties
cat > /var/scripts/env.prop <<EOF
WWW_ROOT=${WWW_ROOT}
NODE_ENV=${NODE_ENV}
APP_NAME=${APP_NAME}
APP_SCOPE=${APP_SCOPE}
EOF

#save userdata json
cat > /var/scripts/env.json <<EOF
{
  "WWW_ROOT":"${WWW_ROOT}",
  "NODE_ENV":"${NODE_ENV}",
  "APP_NAME":"${APP_NAME}",
  "APP_SCOPE":"${APP_SCOPE}"
}
EOF


cat > /etc/awslogs/awslogs.conf <<EOF
[general]
state_file = /var/lib/awslogs/agent-state

[/var/log/messages]
datetime_format = %b %d %H:%M:%S
file = /var/log/messages
buffer_duration = 5000
log_stream_name = {instance_id}
initial_position = start_of_file
log_group_name = ${NODE_ENV}_upstart

[${WWW_ROOT}/logs]
log_stream_name = {instance_id}
log_group_name = ${NODE_ENV}_${APP_NAME}
file = ${WWW_ROOT}/logs/*
EOF

#UPSTART section and conf
cat > /etc/init/nodeApp.conf <<EOF
description "Upstart conf for Node.js App"
author "Nick Sharp"
chdir $WWW_ROOT
start on (runlevel [345] and started network)
stop on (runlevel [!345] or stopping network)
setuid node-app-run
setgid node-app
respawn
respawn limit 10 5

pre-start script
    mkfifo applogpipe
    chmod 0666 applogpipe
    logrotate-stream ${WWW_ROOT}/logs/app.log --keep 3 --size 50m < applogpipe &
end script
script
    exec node --harmony ${WWW_ROOT}/src/server.js ${NODE_ENV} >> applogpipe 2>&1
end script
post-stop script
    rm applogpipe
end script
EOF

exit 0
