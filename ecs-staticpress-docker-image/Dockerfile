FROM wordpress:latest

RUN set -ex; \
    apt-get update && apt-get install -y \
        wget \
        unzip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/wp-plugins

RUN set -ex; \
    wget -q -O staticpress.zip https://downloads.wordpress.org/plugin/staticpress.0.4.5.zip \
    && wget -q -O staticpress-s3.zip https://github.com/megumiteam/staticpress-s3/archive/master.zip \
    && wget -q -O amazon-s3-and-cloudfront.zip https://downloads.wordpress.org/plugin/amazon-s3-and-cloudfront.1.4.3.zip \
    && unzip -q -o '*.zip' -d /usr/src/wordpress/wp-content/plugins \
    && chown -R www-data:www-data /usr/src/wordpress/wp-content/plugins \
    && rm -f '*.zip'

WORKDIR /var/www/html
