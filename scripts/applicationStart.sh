# service awslogs start
fetch_tags_cmd="aws --region ${AWS_REGION} autoscaling describe-auto-scaling-groups --auto-scaling-group-names ${AWS_AUTOSCALE_GROUP} --query AutoScalingGroups[0].Tags --output text"
NODE_ENV=$(${fetch_tags_cmd} | grep "^env\s" | cut -f5)
env NODE_ENV="${NODE_ENV}"
cd /var/www
pm2 start src/server.js --node-args="--harmony"
exit 0
