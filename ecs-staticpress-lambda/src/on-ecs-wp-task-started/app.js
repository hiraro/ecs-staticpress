'use strict';


const ECS_CLUSTER_NAME = process.env.ECS_CLUSTER_NAME;
const ECS_WP_SERVICE_NAME = process.env.ECS_WP_SERVICE_NAME;
const ECS_WP_TASK_DEF_ARN_PREFIX = process.env.ECS_WP_TASK_DEF_ARN_PREFIX;
const ECS_WP_TASK_STAT_RUNNING = process.env.ECS_WP_TASK_STAT_RUNNING;
const R53_HOSTED_ZONE_ID = process.env.R53_HOSTED_ZONE_ID;
const R53_ECS_WP_BACK_DNS_NAME = process.env.R53_ECS_WP_BACK_DNS_NAME;

const util = require("util");

const AWS = require('aws-sdk');
const ecs = new AWS.ECS({
    region: 'ap-northeast-1'
});
const ec2 = new AWS.EC2({
    region: 'ap-northeast-1'
});

const Route53 = require('nice-route53');
const r53 = new Route53();

function is_ecs_wp_task_start_event(event) {
    const task_def_arn = event["detail"]["taskDefinitionArn"];
    const desired_stat = event["detail"]["desiredStatus"];
    const last_stat = event["detail"]["lastStatus"];

    const task_def_arn_regexp = new RegExp(`^${ECS_WP_TASK_DEF_ARN_PREFIX}`);
    if (!task_def_arn_regexp.test(task_def_arn)) {
        return false;
    }

    if (desired_stat != ECS_WP_TASK_STAT_RUNNING || last_stat != ECS_WP_TASK_STAT_RUNNING) {
        return false;
    }

    return true;
}

function set_r53_record(rec) {
    return new Promise(function (resolve, reject) {
        r53.setRecord(rec, function (err, res) {
            if (err) {
                console.dir(err);
                return reject(err);
            }
            console.dir(res);
            return resolve(res);
        });
    });
}

async function retrieve_task_public_ip(task_arn, cluster_name) {
    const task_desc_list = await ecs.describeTasks({
        tasks: [task_arn],
        cluster: cluster_name
    }).promise();

    const wp_task_desc = task_desc_list["tasks"][0];

    console.log(util.inspect(wp_task_desc, {
        depth: null
    }));

    let wp_task_eni_info = {};
    wp_task_desc["attachments"].forEach(element => {
        if (element["type"] == "ElasticNetworkInterface") {
            wp_task_eni_info = element["details"];
        }
    });

    console.log(util.inspect(wp_task_eni_info, {
        depth: null
    }));

    let wp_task_eni_id = "";
    wp_task_eni_info.forEach(element => {
        if (element["name"] == "networkInterfaceId") {
            wp_task_eni_id = element["value"];
        }
    });

    console.log(`wp_task_eni_id: ${wp_task_eni_id}`);

    const eni_desc_list = await ec2.describeNetworkInterfaces({
        NetworkInterfaceIds: [wp_task_eni_id]
    }).promise();

    const eni_desc = eni_desc_list["NetworkInterfaces"][0];

    console.log(util.inspect(eni_desc, {
        depth: null
    }));

    const public_ip = eni_desc["Association"]["PublicIp"];

    console.log(`public_ip:${public_ip}`);

    return public_ip;
}


/**
 * ECSタスク起動後にタスクのパブリックIPを取得してR53のレコードセットを更新
 */
exports.lambda_handler = async (event, context) => {
    console.log(util.inspect(event, {
        depth: null
    }));

    const task_def_arn = event["detail"]["taskDefinitionArn"];
    const task_arn = event["detail"]["taskArn"];
    const desired_stat = event["detail"]["desiredStatus"];
    const last_stat = event["detail"]["lastStatus"];

    console.log(`task_def_arn: ${task_def_arn}`);
    console.log(`task_arn: ${task_arn}`);
    console.log(`desired_stat: ${desired_stat}`);
    console.log(`last_stat: ${last_stat}`);

    // 起動イベント以外は無視
    if (!is_ecs_wp_task_start_event(event)) {
        return;
    }

    // タスクENIのパブリックIPを見つけてR53に登録
    const public_ip = await retrieve_task_public_ip(task_arn, ECS_CLUSTER_NAME);
    const rec = {
        zoneId: R53_HOSTED_ZONE_ID,
        name: R53_ECS_WP_BACK_DNS_NAME,
        type: 'A',
        ttl: 10,
        values: [
            public_ip
        ],
    };

    await set_r53_record(rec);
};
