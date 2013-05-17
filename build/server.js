// Generated by CoffeeScript 1.4.0
(function() {
  var app, config, connectCounter, express, io, isPrizeWon, moment, redis, redisClient, redisPublishClient, server, slideBuffer;

  express = require("express");

  app = express();

  server = require("http").createServer(app);

  io = require("socket.io").listen(server);

  redis = require("redis");

  config = require('./libs/config');

  moment = require('moment');

  require('./libs/routes').config(app, __dirname);

  server.listen(config.port);

  slideBuffer = void 0;

  isPrizeWon = false;

  redisClient = redis.createClient(config.redis.port, config.redis.host);

  redisPublishClient = redis.createClient(config.redis.port, config.redis.host);

  connectCounter = 0;

  io.sockets.on("connection", function(socket) {
    console.log('welcome');
    socket.on('connect', function() {
      return connectCounter++;
    });
    socket.on('disconnect', function() {
      return connectCounter--;
    });
    socket.on("subscribe", function(data) {
      var n;
      console.log('[subscribe] ' + data.channel);
      if (data.channel === 'chat') {
        n = 5;
        redisPublishClient.llen(config.redis.msgList, function(err, res) {
          var endIndex, startIndex;
          endIndex = res;
          startIndex = Math.max(endIndex - n, 0);
          return redisPublishClient.lrange(config.redis.msgList, startIndex, endIndex, function(err, res) {
            var counter, dataToPub, json, _i, _len;
            counter = 0;
            dataToPub = [];
            for (_i = 0, _len = res.length; _i < _len; _i++) {
              json = res[_i];
              data = JSON.parse(json);
              data.id = startIndex + counter;
              if (data.ts != null) {
                data.ts = moment.unix(data.ts).format('HH:mm:ss YYYY-MM-DD');
              }
              counter++;
              dataToPub.unshift(data);
            }
            return socket.emit("chat", dataToPub);
          });
        });
      } else if (data.channel === 'slide') {
        if (slideBuffer != null) {
          socket.emit(data.channel, slideBuffer);
        }
      }
      return socket.join(data.channel);
    });
    socket.on("admin-slide", function(data) {
      if (!(data.id != null)) {
        return;
      }
      console.log('[slide] ' + data);
      return redisPublishClient.publish(config.redis.channel, JSON.stringify({
        channel: 'slide',
        data: data
      }));
    });
    socket.on("chat", function(data) {
      if (!(data.msg != null)) {
        return;
      }
      data.ts = moment().unix();
      console.log('[chat] ' + JSON.stringify(data));
      return redisPublishClient.rpush(config.redis.msgList, JSON.stringify(data), function(err, res) {
        data.id = res;
        data.ts = moment.unix(data.ts).format('HH:mm:ss YYYY-MM-DD');
        return redisPublishClient.publish(config.redis.channel, JSON.stringify({
          channel: 'chat',
          data: data
        }));
      });
    });
    socket.on("chat-append", function(data) {
      var endIndex, n, startIndex;
      if (!(data.id != null)) {
        return;
      }
      n = 10;
      endIndex = data.id;
      startIndex = Math.max(endIndex - n, 0);
      return redisPublishClient.lrange(config.redis.msgList, startIndex, endIndex, function(err, res) {
        var counter, dataToPub, json, _i, _len;
        counter = 0;
        dataToPub = [];
        for (_i = 0, _len = res.length; _i < _len; _i++) {
          json = res[_i];
          data = JSON.parse(json);
          data.id = startIndex + counter;
          if (data.ts != null) {
            data.ts = moment.unix(data.ts).format('HH:mm:ss YYYY-MM-DD');
          }
          counter++;
          dataToPub.unshift(data);
        }
        return socket.emit("chat-append", dataToPub);
      });
    });
    return socket.on("prize", function(data) {
      if (!isPrizeWon) {
        isPrizeWon = true;
        return socket.broadcast.emit("prize", data);
      }
    });
  });

  redisClient.on("ready", function() {
    return redisClient.subscribe(config.redis.channel);
  });

  redisClient.on("message", function(channel, message) {
    var data, dataToPub;
    data = JSON.parse(message);
    if (!(data.channel != null)) {
      return;
    }
    dataToPub = void 0;
    if (data.channel === 'chat') {
      if (!(data.data.msg != null)) {
        return;
      }
      dataToPub = [data.data];
    } else if (data.channel === 'slide') {
      if (!(data.data.id != null)) {
        return;
      }
      slideBuffer = data.data;
      dataToPub = data.data;
    }
    if (dataToPub != null) {
      return io.sockets["in"](data.channel).emit(data.channel, dataToPub);
    }
  });

}).call(this);
