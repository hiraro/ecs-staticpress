'use strict';


const DYNAMODB_ACCESS_LOG_TABLE = process.env.DYNAMODB_ACCESS_LOG_TABLE;
const DYNAMODB_ACCESS_LOG_TTL_SEC = process.env.DYNAMODB_ACCESS_LOG_TTL_SEC;

const util = require("util");

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB({
    region: 'ap-northeast-1'
});


/**
 * Dynamo DB にアクセス履歴レコードをTTL付きで書き込む
*/
exports.lambda_handler = async (event, context) => {
    const msg = JSON.parse(event["Records"][0]["Sns"]["Message"]);

    console.log(`msg["req_id"]: ${msg["req_id"]}`);
    console.log(`msg["client_ip"]: ${msg["client_ip"]}`);
    console.log(`msg["timestamp"]: ${msg["timestamp"]}`);

    const params = {
        TableName: DYNAMODB_ACCESS_LOG_TABLE,
        Item: {
            'req_id': {
                "S": msg["req_id"]
            },
            'client_ip': {
                "S": msg["client_ip"]
            },
            'timestamp': {
                "N": String(msg["timestamp"])
            },
            'expiration': {
                "N": String(Number(msg["timestamp"]) + Number(DYNAMODB_ACCESS_LOG_TTL_SEC))
            }
        }
    };
    const ret = await dynamodb.putItem(params).promise();

    console.log(util.inspect(ret, {
        depth: null
    }));
    console.log("Appended wpadmin access log.");
};
