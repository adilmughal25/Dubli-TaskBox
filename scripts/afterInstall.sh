cd /var/www && npm install
chown -R root:root /var/www/node_modules

. /var/scripts/env.prop
aws s3 cp s3://configs-and-scripts/${APP_NAME}/configs.${NODE_ENV}.json /var/www/configs.json
exit 0