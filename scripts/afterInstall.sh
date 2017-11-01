#!/bin/bash
PATH=$PATH:/usr/local/bin

source /var/scripts/env.prop

(cd $WWW_ROOT && \
  aws s3 cp --region ${AWS_REGION} s3://configs-and-scripts/configs.${NODE_ENV}.json ./configs.json && \
  exit 0) || exit 1
