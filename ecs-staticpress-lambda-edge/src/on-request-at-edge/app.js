'use strict';


// Lambda@Edge で環境変数が使えないので……
const CF_DNS_NAME = "testecswp.example.com";
const ECS_WP_TASK_DNS_NAME = "back.testecswp.example.com";

const dns = require('dns');
const util = require('util');


function dns_lookup(dns_name) {
    const dns_opt = {
        family: 4 // IPv4
    };

    return new Promise((resolve, reject) => {
        dns.lookup(dns_name, dns_opt, (err, addr, family) => {
            if (err) {
                return reject(err);
            }

            return resolve(addr);
        });
    });
}

function lookup_backend_ip() {
    return dns_lookup(ECS_WP_TASK_DNS_NAME);
}

async function is_backend_ip(client_ip) {
    const backend_ip = await lookup_backend_ip();

    console.log(`client_ip: ${client_ip}`);
    console.log(`backend_ip: ${backend_ip}`);

    return client_ip === backend_ip;
}


/**
 * WordPressからのアクセスの場合は、S3でなくWebサーバーへアクセスを流す
 */
exports.lambda_handler = async (event, context, callback) => {
    const request = event.Records[0].cf.request;
    console.log(util.inspect(request, {
        depth: null
    }));

    const client_ip = event["Records"][0]["cf"]["request"]["clientIp"];

    if (await is_backend_ip(client_ip)) {
        // Webサーバーにアクセスを流す
        // See: https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/lambda-examples.html#lambda-examples-content-based-routing-examples
        request.origin = {
            custom: {
                domainName: ECS_WP_TASK_DNS_NAME,
                customHeaders: {},
                path: '',
                port: 80,
                protocol: 'http',
                readTimeout: 30,
                keepaliveTimeout: 5,
                sslProtocols: ['TLSv1', 'TLSv1.1', 'TLSv1.2']
            }
        };
        console.log(`Rewrited origin: ${ECS_WP_TASK_DNS_NAME}`);
    }

    // TODO WPログイン関連Cookieある場合も同様にWebサーバーにアクセスを流すべき
    callback(null, request);
};
