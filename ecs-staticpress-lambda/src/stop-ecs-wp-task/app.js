'use strict';


const ECS_CLUSTER_NAME = process.env.ECS_CLUSTER_NAME;
const ECS_WP_SERVICE_NAME = process.env.ECS_WP_SERVICE_NAME;
const DYNAMODB_ACCESS_LOG_TABLE = process.env.DYNAMODB_ACCESS_LOG_TABLE;
const ECS_DESIRED_WP_TASK_COUNT = process.env.ECS_DESIRED_WP_TASK_COUNT;

const util = require("util");

const AWS = require('aws-sdk');
const ecs = new AWS.ECS({
    region: 'ap-northeast-1'
});
const dynamodb = new AWS.DynamoDB({
    region: 'ap-northeast-1'
});


/**
 * CloudWatch イベントで定期的にECSタスク使用状況を監視
 * 直近のアクセスがないタスクを潰す
 */
exports.lambda_handler = async (event, context) => {
    // 直近でアクセスが有る場合は停止しない
    const latest_logs = await dynamodb.scan({
        TableName: DYNAMODB_ACCESS_LOG_TABLE,
        Select: "COUNT"
    }).promise();

    const latest_log_count = latest_logs.Count;

    console.log(`latest_log_count: ${latest_log_count}`);

    if (latest_log_count > 0) {
        console.log("Ecs task need not to be stopped.");
        return;
    }

    // そもそも止まってる場合はなにもしない
    const tasks = await ecs.describeServices({
        cluster: ECS_CLUSTER_NAME,
        services: [ECS_WP_SERVICE_NAME]
    }).promise();
    const service = tasks.services[0];

    console.log(util.inspect(service, {
        depth: null
    }));

    if (service.desiredCount == 0) {
        console.log("Ecs task need not to be stopped.");
        return;
    }

    console.log("Ecs task need to be stopped.");

    // タスク止める
    // TODO 強制的に終了せずに graceful に止めたほうが良い
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
