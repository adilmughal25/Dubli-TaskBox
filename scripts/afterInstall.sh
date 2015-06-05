#!/bin/bash -x
PATH=$PATH:/usr/local/bin

source /var/scripts/env.prop

(cd $WWW_ROOT && \
  aws s3 cp --region ${AWS_REGION} s3://configs-and-scripts/${APP_NAME}/configs.${NODE_ENV}.json ./configs.json && \
  mkdir node_modules && \
  npm install --production && \
  exit 0) || exit 1
