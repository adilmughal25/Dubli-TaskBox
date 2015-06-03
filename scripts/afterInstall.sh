#!/bin/bash -x
source /var/scripts/env.prop

AWS_INSTANCE_ID=$(ec2-metadata -i | cut -d' ' -f2)
AWS_REGION=$(curl -s http://169.254.169.254/latest/dynamic/instance-identity/document | grep region | cut -d'"' -f4)
NODE_ENV=$(aws ec2 describe-tags --filters "Name=resource-id,Values=${AWS_INSTANCE_ID}" "Name=key,Values=env" --region ${AWS_REGION} --output text | cut -f5)
APP_NAME=$(aws ec2 describe-tags --filters "Name=resource-id,Values=${AWS_INSTANCE_ID}" "Name=key,Values=app" --region ${AWS_REGION} --output text | cut -f5)
APP_SCOPE=$(aws ec2 describe-tags --filters "Name=resource-id,Values=${AWS_INSTANCE_ID}" "Name=key,Values=scope" --region ${AWS_REGION} --output text | cut -f5)

(cd $WWW_ROOT && \
  mkdir ./node_modules logs && \
  touch ./logs/app.log && \
  npm install --production && \
  aws s3 cp s3://configs-and-scripts/${APP_NAME}/configs.${NODE_ENV}.json ./configs.json && \
  exit 0) || exit 1
