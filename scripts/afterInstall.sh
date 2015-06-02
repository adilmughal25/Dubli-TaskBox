#!/bin/bash
source /var/scripts/env.prop

(cd $WWW_ROOT && \
  mkdir ./node_modules logs && \
  touch ./logs/app.log && \
  npm install --production && \
  aws s3 cp s3://configs-and-scripts/${APP_NAME}/configs.${NODE_ENV}.json ./configs.json && \
  exit 0) || exit 1
