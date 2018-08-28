'use strict';


// Lambda@Edge で環境変数が使えないので……
const ECS_CLUSTER_NAME = "TEST-WP-ECS-FARGATE";
const ECS_WP_SERVICE_NAME = "wp";
const SNS_ACCESS_LOG_TOPIC_ARN = "arn:aws:sns:ap-northeast-1:xxxxxxxxxxxxx:AppendWpadminAccessLogTopic";
const SNS_ECS_LAUNCH_TOPIC_ARN = "arn:aws:sns:ap-northeast-1:xxxxxxxxxxxxx:LaunchEcsWpTaskTopic";

const AWS = require('aws-sdk');
const ecs = new AWS.ECS({
    region: 'ap-northeast-1'
});
const sns = new AWS.SNS({
    region: 'ap-northeast-1'
});

function launch_ecs_task(params) {
    return sns.publish({
        TopicArn: SNS_ECS_LAUNCH_TOPIC_ARN,
        Message: JSON.stringify(params)
    }).promise();
}

function append_access_log(params) {
    return sns.publish({
        TopicArn: SNS_ACCESS_LOG_TOPIC_ARN,
        Message: JSON.stringify(params)
    }).promise();
}


/**
 * 管理画面アクセス時にECSタスクを作成する
 */
exports.lambda_handler = async (event, context, callback) => {

    // TODO Basic認証でも入れといたほうが安全

    // リクエスト情報
    const req_id = event["Records"][0]["cf"]["config"]["requestId"];
    const client_ip = event["Records"][0]["cf"]["request"]["clientIp"];
    const now = Math.floor(new Date() / 1000);

    console.log(`req_id: ${req_id}`);
    console.log(`client_ip: ${client_ip}`);
    console.log(`now: ${now}`);

    const access_log = {
        req_id: req_id,
        client_ip: client_ip,
        timestamp: now
    };

    // WPタスク起動状況確認
    const services = await ecs.describeServices({
        cluster: ECS_CLUSTER_NAME,
        services: [ECS_WP_SERVICE_NAME]
    }).promise();
    const service = services.services[0];

    console.log(`service.serviceArn: ${service.serviceArn}`);
    console.log(`service.desiredCount: ${service.desiredCount}`);
    console.log(`service.runningCount: ${service.runningCount}`);
    console.log(`service.pendingCount: ${service.pendingCount}`);

    const promises = [];

    if (service.desiredCount == 0) {
        // WPタスク起動
        // TODO Aurora Serverless 使う場合は、同時にウォームアップしておいたほうがよい
        console.log("launch_ecs_task");
        promises.push(launch_ecs_task(access_log));
    }

    // アクセスログ情報記録
    console.log("append_access_log");
    promises.push(append_access_log(access_log));

    await Promise.all(promises);

    // TODO タスク起動中はローディング画面的なものを出したほうがユーザーフレンドリー
    const request = event["Records"][0]["cf"]["request"];
    callback(null, request);
};
