#!/bin/bash
PATH=$PATH:/usr/local/bin

# set up initial vars
WWW_ROOT=/var/www
FTP_ROOT=/var/tasker-ftp-root
AWS_INSTANCE_ID=$(ec2metadata --instance-id | cut -d' ' -f2)
AWS_REGION=$(curl -s http://169.254.169.254/latest/dynamic/instance-identity/document | grep region | cut -d'"' -f4)
AWS_AUTOSCALE_GROUP=$(aws --region ${AWS_REGION} autoscaling describe-auto-scaling-instances --instance-ids ${AWS_INSTANCE_ID} --query AutoScalingInstances[0].AutoScalingGroupName | cut -d'"' -f2)
fetch_tags_cmd="aws --region ${AWS_REGION} autoscaling describe-auto-scaling-groups --auto-scaling-group-names ${AWS_AUTOSCALE_GROUP} --query AutoScalingGroups[0].Tags --output text"
NODE_ENV=$(${fetch_tags_cmd} | grep "^env\s" | cut -f5)
APP_NAME=$(${fetch_tags_cmd} | grep "^app\s" | cut -f5)
APP_SCOPE=$(${fetch_tags_cmd} | grep "^scope\s" | cut -f5)
APP_ENV=$(${fetch_tags_cmd} | grep "^appenv\s" | cut -f5)

# need this during the afterInstall cleanupOldDeploys -- by the time that runs the file in deployment-instructions has changed
DEPLOYMENT_GROUP_ID=$(aws deploy get-deployment-group --region ${AWS_REGION} --application-name $APPLICATION_NAME --deployment-group-name $DEPLOYMENT_GROUP_NAME --output text | grep DEPLOYMENTGROUPINFO | awk '{print $4}')
DEP_ROOT="/opt/codedeploy-agent/deployment-root"
if [ -f "${DEP_ROOT}/deployment-instructions/${DEPLOYMENT_GROUP_ID}_last_successful_install" ]; then
  PREVIOUS_DEPLOYMENT_DIR=$(cat ${DEP_ROOT}/deployment-instructions/${DEPLOYMENT_GROUP_ID}_last_successful_install 2>/dev/null)
else
  PREVIOUS_DEPLOYMENT_DIR='/tmp/NO-PREVIOUS-DEPLOYMENT-DIR'
fi

# clean up www-root
rm -rf ${WWW_ROOT}/* 2> /dev/null
chown node-app-files:node-app ${WWW_ROOT}
mkdir -p ${WWW_ROOT}/logs ${WWW_ROOT}/var
chown node-app-run:node-app ${WWW_ROOT}/logs
chown node-app-run:node-app ${WWW_ROOT}/var
chmod 750 ${WWW_ROOT}
mkdir -p /var/lib/taskbox-taskdb
chown node-app-run:node-app /var/lib/taskbox-taskdb
chmod 750 /var/lib/taskbox-taskdb

# Add a data directory under /home/node-app-files
mkdir -p /home/node-app-files/data
chmod 777 /home/node-app-files/data

if [ ! -f ${FTP_ROOT} ]; then
  mkdir -p ${FTP_ROOT}
fi
chown -R node-app-run:node-app ${FTP_ROOT}

# claim our IP address
ec2-associate-address -i $AWS_INSTANCE_ID '52.20.12.41'

#AWS Cloudwatch Logs -- this is the "default" that doesn't run under upstart
service awslogs stop

cat > /var/scripts/process.json <<EOF
{
  "apps" : [
    {
      "name": "taskbox",
      "script": "/var/www/src/server.js",
      "node_args": ["--harmony"],
      "env": {
        "NODE_ENV": "${APP_ENV}"
      },
      "max_restarts"  : 5
    }
  ]
}
EOF

#save userdata properties
cat > /var/scripts/env.prop <<EOF
WWW_ROOT=${WWW_ROOT}
AWS_INSTANCE_ID=${AWS_INSTANCE_ID}
AWS_REGION=${AWS_REGION}
AWS_AUTOSCALE_GROUP=${AWS_AUTOSCALE_GROUP}
NODE_ENV=${NODE_ENV}
APP_NAME=${APP_NAME}
APP_SCOPE=${APP_SCOPE}
PREVIOUS_DEPLOYMENT_DIR=${PREVIOUS_DEPLOYMENT_DIR}
EOF

#save userdata json
cat > /var/scripts/env.json <<EOF
{
  "WWW_ROOT":"${WWW_ROOT}",
  "FTP_ROOT":"${FTP_ROOT}",
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
state_file = /var/awslogs/state/agent-state

[/var/log/syslog]
datetime_format = %b %d %H:%M:%S
file = /var/log/syslog
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

cat > /etc/init/awslogs-upstart.conf <<EOF
description "Upstart conf for AWS logs"
author "Rando Christensen"
start on (runlevel [345] and started network)
stop on (runlevel [!345] or stopping network)
respawn
respawn limit 10 5
env AWS_CONFIG_FILE="/var/awslogs/etc/aws.conf"
env HOME="/home/ubuntu"

script
  exec /usr/bin/nice -n 4 /var/awslogs/bin/aws logs push --config-file /var/awslogs/etc/awslogs.conf >> /var/log/awslogs.log 2>&1
end script
EOF

exit 0
