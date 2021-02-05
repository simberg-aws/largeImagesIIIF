FROM openjdk:8-jdk-alpine

ENV CANTALOUPE_VERSION 4.1.7
EXPOSE 8182

RUN apk add --update -X http://dl-cdn.alpinelinux.org/alpine/edge/community \
    curl \
    graphicsmagick

RUN adduser -S cantaloupe

WORKDIR /tmp
RUN curl -OL https://github.com/medusa-project/cantaloupe/releases/download/v$CANTALOUPE_VERSION/cantaloupe-$CANTALOUPE_VERSION.zip \
 && mkdir -p /usr/local/ \
 && cd /usr/local \
 && unzip /tmp/cantaloupe-$CANTALOUPE_VERSION.zip \
 && ln -s cantaloupe-$CANTALOUPE_VERSION cantaloupe \
 && rm -rf /tmp/cantaloupe-$CANTALOUPE_VERSION \
 && rm /tmp/cantaloupe-$CANTALOUPE_VERSION.zip

COPY cantaloupe.properties /etc/cantaloupe.properties 
RUN mkdir -p /var/log/cantaloupe \
 && mkdir -p /var/cache/cantaloupe \
 && chown -R cantaloupe /var/log/cantaloupe \
 && chown -R cantaloupe /var/cache/cantaloupe \
 && chown cantaloupe /etc/cantaloupe.properties

USER cantaloupe
CMD ["sh", "-c", "java -Dcantaloupe.config=/etc/cantaloupe.properties -Xmx2g -jar /usr/local/cantaloupe/cantaloupe-$CANTALOUPE_VERSION.war"]
