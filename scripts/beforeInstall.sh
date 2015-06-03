#!/bin/bash -x

WWW_ROOT=/var/www
AWS_INSTANCE_ID=$(/opt/aws/bin/ec2-metadata -i | cut -d' ' -f2)
AWS_REGION=$(curl -s http://169.254.169.254/latest/dynamic/instance-identity/document | grep region | cut -d'"' -f4)
NODE_ENV=$(aws ec2 describe-tags --filters "Name=resource-id,Values=${AWS_INSTANCE_ID}" "Name=key,Values=env" --region ${AWS_REGION} --output text | cut -f5)
APP_NAME=$(aws ec2 describe-tags --filters "Name=resource-id,Values=${AWS_INSTANCE_ID}" "Name=key,Values=app" --region ${AWS_REGION} --output text | cut -f5)
APP_SCOPE=$(aws ec2 describe-tags --filters "Name=resource-id,Values=${AWS_INSTANCE_ID}" "Name=key,Values=scope" --region ${AWS_REGION} --output text | cut -f5)

rm -rf ${WWW_ROOT}/* 2> /dev/null
chown node-app-files:node-app ${WWW_ROOT}
mkdir -p ${WWW_ROOT}/logs
chown node-app-run:node-app ${WWW_ROOT}/logs
chmod 750 ${WWW_ROOT}

#AWS Cloudwatch Logs
service awslogs stop

#save userdata properties
cat > /var/scripts/env.prop <<EOF
WWW_ROOT=${WWW_ROOT}
AWS_INSTANCE_ID=${AWS_INSTANCE_ID}
AWS_REGION=${AWS_REGION}
NODE_ENV=${NODE_ENV}
APP_NAME=${APP_NAME}
APP_SCOPE=${APP_SCOPE}
EOF

#save userdata json
cat > /var/scripts/env.json <<EOF
{
  "WWW_ROOT":"${WWW_ROOT}",
  "AWS_INSTANCE_ID":"${AWS_INSTANCE_ID}",
  "AWS_REGION":"${AWS_REGION}",
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
    mkfifo ${WWW_ROOT}/logs/applogpipe
    chmod 0666 ${WWW_ROOT}/logs/applogpipe
    logrotate-stream ${WWW_ROOT}/logs/app.log --keep 3 --size 50m < ${WWW_ROOT}/logs/applogpipe &
end script
script
    exec node --harmony ${WWW_ROOT}/src/server.js ${NODE_ENV} >> ${WWW_ROOT}/logs/applogpipe 2>&1
end script
post-stop script
    rm applogpipe
end script
EOF

exit 0
