var fs = require('fs');
var NodeRSA = require('node-rsa');

var io = require('socket.io').listen(8080);

//io.set('transports', ['polling']);

var server_key;

var online = [];


io.sockets.on('connection', function (socket) {
    socket.enc = 0;
    socket.on('disconnect', function() {
        console.log("Disconnected!!!");
        console.log(socket.uuid);
        try {
        var i = online.indexOf(socket);
        online.splice(i, 1);
        } catch (e) {
            console.log("Error taking " + socket.uuid + " Offline");
        }
    });
    socket.on('pingy',function (data) {
        socket.emit('pong','{}');
    });

    socket.on('public-key',function (data) {
        var json = JSON.parse(data);
        key = json.key;
        var client_key=new NodeRSA(key);
        socket.client_key = client_key;
        //var output = client_key.encrypt('{"command":"ping"}');
        //socket.emit('enc',output);
    });
    socket.on('enc',function (data) {
        var output = socket.server_key.decrypt(data,'utf8');
        var json = JSON.parse(output);
        console.log(json);
        if (json.command == "pingy") {
            var output = socket.client_key.encrypt('{"command":"pong"}');
            socket.emit('enc',output);
        }
        if (json.command == "gettime") {
            var date = new Date();
            var output = socket.client_key.encrypt('{"command":"time","time":"'+date+'"}');
            socket.emit('enc',output);
        }
        if (json.command == "gettotalonlineusers") {
            var output = socket.client_key.encrypt('{"command":"online","count":"'+online.length+'"}');
            socket.emit('enc',output);
        }

        if (json.command == "relay-serverenc") {
            var users = json.user;
            console.log("Looking for: " + json.user);
            var found = false;
            var remotesock;
            online.forEach(function(entry) {
                    found = 1;
                    if (entry.uuid == json.user) {
                        remotesock=entry;
                    }
            });
            if (found == 1) {
                if (json.subcommand == "tradekeys") {
                    var output = remotesock.client_key.encrypt('{"command":"relay-serverenc","count":"1","user":"'+json.user+'","from":"'+socket.uuid+'","publickey":"'+json.publickey+'","subcommand":"tradekeys"}');
                    remotesock.emit('enc',output);
                }
                if (json.subcommand == "tradekeysresponse") {
                    var output = remotesock.client_key.encrypt('{"command":"relay-serverenc","count":"1","user":"'+json.user+'","from":"'+socket.uuid+'","publickey":"'+json.publickey+'","subcommand":"tradekeysresponse"}');
                    remotesock.emit('enc',output);
                }
                if (json.subcommand == "message") {
                    var output = remotesock.client_key.encrypt('{"command":"relay-serverenc","count":"1","user":"'+json.user+'","from":"'+socket.uuid+'","message":"'+json.message+'","subcommand":"message"}');
                    remotesock.emit('enc',output);
                }
            } else {
                var output = socket.client_key.encrypt('{"command":"verifyuser","count":"0","user":"'+json.user+'"}');
                socket.emit('enc',output);
            }
        }

        if (json.command == "verifyuser") {
            var users = json.user;
            console.log("Looking for: " + json.user);
            var found = false;
            online.forEach(function(entry) {
                    found = 1;
            });
            if (found == 1) {
                console.log("Found: " + json.user);
                var output = socket.client_key.encrypt('{"command":"verifyuser","count":"1","user":"'+json.user+'"}');
                socket.emit('enc',output);
            } else {
                var output = socket.client_key.encrypt('{"command":"verifyuser","count":"0","user":"'+json.user+'"}');
                socket.emit('enc',output);
            }
        }
        if (json.command == "tradekeys") {
            var users = json.user;
            var found = false;
            online.forEach(function(entry) {
                if (entry.uuid == json.user) {
                    found = 1;
                }
            });
            if (found == 0) {
                var output = socket.client_key.encrypt('{"command":"tradekeys","count":"0","user":"'+json.user+'"}');
                socket.emit('enc',output);                
            } else {
                    var output = socket.client_key.encrypt('{"command":"tradekeys","count":"1","user":"'+json.user+'"}');
                    socket.emit('enc',output);
            }
        }
    });
    socket.on('uuid',function (data) {
        var json = JSON.parse(data);
        var server_key_txt = fs.readFileSync('keys/my.key','utf8');
        server_key = new NodeRSA(server_key_txt);
        socket.server_key=server_key;
        var my_key = server_key.exportKey('public');
        my_key = my_key.replace(/(\r\n|\n|\r)/gm,"");
        socket.emit('server-public','{"key": "'+my_key+'"}');
        socket.enc = 1;
        socket.uuid = json.uuid;
        online.push(socket);
    });
});

