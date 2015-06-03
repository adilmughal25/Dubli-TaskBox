#!/bin/bash -x

# set up initial vars
WWW_ROOT=/var/www
AWS_INSTANCE_ID=$(ec2metadata --instance-id | cut -d' ' -f2)
AWS_REGION=$(curl -s http://169.254.169.254/latest/dynamic/instance-identity/document | grep region | cut -d'"' -f4)
AWS_AUTOSCALE_GROUP=$(aws --region ${AWS_REGION} autoscaling describe-auto-scaling-instances --instance-ids ${AWS_INSTANCE_ID} --query AutoScalingInstances[0].AutoScalingGroupName | cut -d'"' -f2)
AWS_AUTOSCALE_TAGDEFS=$(aws --region ${AWS_REGION} autoscaling describe-auto-scaling-groups --auto-scaling-group-names ${AWS_AUTOSCALE_GROUP} --query AutoScalingGroups[0].Tags --output text)
NODE_ENV=$(echo ${AWS_AUTOSCALE_TAGDEFS} | grep "^env\t" | cut -f5)
APP_NAME=$(echo ${AWS_AUTOSCALE_TAGDEFS} | grep "^app\t" | cut -f5)
APP_SCOPE=$(echo ${AWS_AUTOSCALE_TAGDEFS} | grep "^scope\t" | cut -f5)

# NODE_ENV=$(aws ec2 describe-tags --filters "Name=resource-id,Values=${AWS_INSTANCE_ID}" "Name=key,Values=env" --region ${AWS_REGION} --output text | cut -f5)
# APP_NAME=$(aws ec2 describe-tags --filters "Name=resource-id,Values=${AWS_INSTANCE_ID}" "Name=key,Values=app" --region ${AWS_REGION} --output text | cut -f5)
# APP_SCOPE=$(aws ec2 describe-tags --filters "Name=resource-id,Values=${AWS_INSTANCE_ID}" "Name=key,Values=scope" --region ${AWS_REGION} --output text | cut -f5)

# need to set up defaults here-- this is a problem, but apparently tags don't
# get set on the instances until after the initial code deploy. i'm not sure
# how to fix this, googling got me precisely nowhere.
#NODE_ENV=${NODE_ENV:-stage}
#APP_NAME=${APP_NAME:-taskbox}
#APP_SCOPE=${APP_SCOPE:-private}

# clean up www-root
rm -rf ${WWW_ROOT}/* 2> /dev/null
chown node-app-files:node-app ${WWW_ROOT}
mkdir -p ${WWW_ROOT}/logs ${WWW_ROOT}/var
chown node-app-run:node-app ${WWW_ROOT}/logs
chown node-app-run:node-app ${WWW_ROOT}/var
chmod 750 ${WWW_ROOT}

#AWS Cloudwatch Logs
service awslogs stop

#save userdata properties
cat > /var/scripts/env.prop <<EOF
WWW_ROOT=${WWW_ROOT}
AWS_INSTANCE_ID=${AWS_INSTANCE_ID}
AWS_REGION=${AWS_REGION}
AWS_AUTOSCALE_GROUP=${AWS_AUTOSCALE_GROUP}
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
  "AWS_AUTOSCALE_GROUP":"${AWS_AUTOSCALE_GROUP}",
  "NODE_ENV":"${NODE_ENV}",
  "APP_NAME":"${APP_NAME}",
  "APP_SCOPE":"${APP_SCOPE}"
}
EOF


cat > /var/awslogs/etc/awslogs.conf <<EOF
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
env NODE_ENV="${NODE_ENV}"

pre-start script
    mkfifo ${WWW_ROOT}/var/applogpipe
    chmod 0666 ${WWW_ROOT}/var/applogpipe
    logrotate-stream ${WWW_ROOT}/logs/app.log --keep 3 --size 50m < ${WWW_ROOT}/var/applogpipe &
end script

script
    exec node --harmony ${WWW_ROOT}/src/server.js >> ${WWW_ROOT}/var/applogpipe 2>&1
end script

post-stop script
    rm ${WWW_ROOT}/var/applogpipe
end script
EOF

exit 0
