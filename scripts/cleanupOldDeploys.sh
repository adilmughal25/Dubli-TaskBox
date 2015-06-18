#!/bin/bash -x
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
PREVIOUS_DEPLOYMENT_DIR=$(get_real_dir $(cat ${DEP_ROOT}/deployment-instructions/${DEPLOYMENT_GROUP_ID}_last_successful_install 2>/dev/null))
DEPLOYMENTS_LIST=$(find ${CURRENT_GROUP_ROOT} -type d -mindepth 1 -maxdepth 1)


for DIR in $DEPLOYMENTS_LIST; do
  REAL_PATH=$(get_real_dir $DIR)
  if [ \
    ! -z "${REAL_PATH}" -a \
    "${REAL_PATH}" != "${CURRENT_DEPLOYMENT_DIR}" -a \
    "${REAL_PATH}" != "${PREVIOUS_DEPLOYMENT_DIR}" -a \
    "${REAL_PATH:0:${#CURRENT_GROUP_ROOT}}" == $CURRENT_GROUP_ROOT \
  ]; then
    echo "TEST: RM-DASH-R-F ${REAL_PATH}"
  fi
done
