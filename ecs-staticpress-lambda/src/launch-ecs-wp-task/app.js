'use strict';


const ECS_CLUSTER_NAME = process.env.ECS_CLUSTER_NAME;
const ECS_WP_SERVICE_NAME = process.env.ECS_WP_SERVICE_NAME;
const ECS_DESIRED_WP_TASK_COUNT = process.env.ECS_DESIRED_WP_TASK_COUNT;

const util = require("util");

const AWS = require('aws-sdk');
const ecs = new AWS.ECS({
    region: 'ap-northeast-1'
});


/**
 * ECSタスクを作成
 */
exports.lambda_handler = async (event, context) => {
    // タスク起動
    const updated_service = await ecs.updateService({
        cluster: ECS_CLUSTER_NAME,
        service: ECS_WP_SERVICE_NAME,
        desiredCount: ECS_DESIRED_WP_TASK_COUNT
    }).promise();

    console.log("updated_service: ");
    console.log(util.inspect(updated_service, {
        depth: null
    }));

    console.log("Updated desired service count of ECS.");
};
