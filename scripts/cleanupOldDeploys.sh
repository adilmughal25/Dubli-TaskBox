#!/bin/bash
PATH=$PATH:/usr/local/bin
source /var/scripts/env.prop

function get_real_dir {
  D=$1
  if [ -z "$D" ]; then return; fi
  if [ ! -d "$D" ]; then return; fi
  echo $( cd $1 && pwd )
}

DEPLOYMENT_GROUP_ID=$(aws deploy get-deployment-group --region ${AWS_REGION} --application-name $APPLICATION_NAME --deployment-group-name $DEPLOYMENT_GROUP_NAME --output text | grep DEPLOYMENTGROUPINFO | awk '{print $4}')
DEP_ROOT=$(get_real_dir "/opt/codedeploy-agent/deployment-root")
if [ ! -d "$DEP_ROOT" ]; then
  echo "Can't find required dir DEP_ROOT:$DEP_ROOT"
  exit
fi
CURRENT_GROUP_ROOT=$(get_real_dir "${DEP_ROOT}/${DEPLOYMENT_GROUP_ID}")
if [ ! -d "$CURRENT_GROUP_ROOT" ]; then
  echo "Can't find required dir CURRENT_GROUP_ROOT:$CURRENT_GROUP_ROOT"
  exit
fi
CURRENT_DEPLOYMENT_DIR=$(get_real_dir "${CURRENT_GROUP_ROOT}/${DEPLOYMENT_ID}")
if [ ! -d "$CURRENT_DEPLOYMENT_DIR" ]; then
  echo "Can't find required dir CURRENT_DEPLOYMENT_DIR:$CURRENT_DEPLOYMENT_DIR"
  exit
fi

# previous deployment dir is set by beforeInstall.sh -- by the time this script runs, the file on disk is already updated to the current deploy
PREVIOUS_DEPLOYMENT_DIR=$(get_real_dir ${PREVIOUS_DEPLOYMENT_DIR})
DEPLOYMENTS_LIST=$(find ${CURRENT_GROUP_ROOT} -type d -mindepth 1 -maxdepth 1)

echo "CURRENT DEPLOYMENT: ${CURRENT_DEPLOYMENT_DIR}"
echo "PREVIOUS DEPLOYMENT: ${PREVIOUS_DEPLOYMENT_DIR}"

for DIR in $DEPLOYMENTS_LIST; do
  REAL_PATH=$(get_real_dir $DIR)
  if [ \
    ! -z "${REAL_PATH}" -a \
    "${REAL_PATH}" != "${CURRENT_DEPLOYMENT_DIR}" -a \
    "${REAL_PATH}" != "${PREVIOUS_DEPLOYMENT_DIR}" -a \
    "${REAL_PATH:0:${#CURRENT_GROUP_ROOT}}" == $CURRENT_GROUP_ROOT \
  ]; then
    echo "Deleting previous deployment ${REAL_PATH}"
    rm -rf $REAL_PATH
  fi
done

find /tmp -mindepth 1 -maxdepth 1 -type d -user node-app-files -name 'npm-*' -ctime +0 -exec rm -rf {} \;
